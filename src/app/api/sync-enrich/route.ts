import { NextResponse } from "next/server";
import { getDb, ensureZivvySchema, ensureContactSchema } from "@/lib/db";
import {
  enrichAttendanceBatch,
  enrichRanksBatch,
  fetchAllPayments,
} from "@/lib/zivvy/enrich";
import { batchComputeEngagement } from "@/lib/contacts/engagement";
import { populateContacts, refreshAllContacts } from "@/lib/contacts/populate";
import { getSession, hasRole } from "@/lib/auth/session";

/**
 * GET /api/sync-enrich — Status of enrichment data
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    ensureZivvySchema();
    const db = getDb();

    const total = (db.prepare(
      "SELECT COUNT(*) as c FROM students WHERE membership_status = 'active'"
    ).get() as any).c;

    const withAttendance = (db.prepare(
      "SELECT COUNT(*) as c FROM students WHERE last_attendance IS NOT NULL AND last_attendance != ''"
    ).get() as any).c;

    const withRate = (db.prepare(
      "SELECT COUNT(*) as c FROM students WHERE monthly_rate IS NOT NULL AND monthly_rate > 0"
    ).get() as any).c;

    const withBelt = (db.prepare(
      "SELECT COUNT(*) as c FROM students WHERE belt_rank IS NOT NULL AND belt_rank != '' AND belt_rank != 'white'"
    ).get() as any).c;

    const avgRate = (db.prepare(
      "SELECT ROUND(AVG(monthly_rate), 2) as avg FROM students WHERE monthly_rate > 0"
    ).get() as any)?.avg;

    return NextResponse.json({
      activeStudents: total,
      withAttendanceData: withAttendance,
      withMonthlyRate: withRate,
      withBeltRank: withBelt,
      avgMonthlyRate: avgRate,
      coverage: {
        attendance: total > 0 ? Math.round((withAttendance / total) * 100) : 0,
        billing: total > 0 ? Math.round((withRate / total) * 100) : 0,
        rank: total > 0 ? Math.round((withBelt / total) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("API Error [GET /api/sync-enrich]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/sync-enrich — Run enrichment sync
 *
 * Scopes:
 *   "all"        — payments + attendance + re-score (default regular sync)
 *   "payments"   — bulk payment data only (fast, 1-2 API calls)
 *   "attendance"  — per-student attendance only (210 calls, ~2 min)
 *   "ranks"      — per-student ranks only (210 calls, one-time backfill)
 *   "full"       — everything including ranks backfill
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    ensureZivvySchema();
    ensureContactSchema();
    const db = getDb();

    // Prevent concurrent enrichment runs
    const lock = db.prepare(
      "SELECT value FROM app_settings WHERE key = 'enrich_lock'"
    ).get() as { value: string } | undefined;
    if (lock) {
      const lockTime = parseInt(lock.value, 10);
      // Lock expires after 30 minutes
      if (Date.now() - lockTime < 30 * 60 * 1000) {
        return NextResponse.json(
          { error: "Enrichment sync is already in progress" },
          { status: 409 }
        );
      }
    }
    // Set lock
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('enrich_lock', ?)"
    ).run(String(Date.now()));

    const body = await request.json().catch(() => ({ scope: "all" }));
    const scope = body.scope || "all";
    const results: Record<string, any> = {};

    // Phase 1: Payments (bulk JSON, fast)
    if (["all", "full", "payments"].includes(scope)) {
      // Fetch recent payments for monthly_rate (3 months)
      console.log("[enrich] Fetching recent payments (3 months)...");
      const recentPayments = await fetchAllPayments(3);

      // Fetch all-time payments for total_collected (actual LTV)
      // Use a large lookback (120 months / 10 years) to capture full history
      console.log("[enrich] Fetching all-time payments for LTV...");
      const allTimePayments = await fetchAllPayments(120);

      results.payments = {
        recent_transactions: recentPayments.payments.length,
        alltime_transactions: allTimePayments.payments.length,
        unique_contacts: allTimePayments.total_collected.size,
      };

      const updateRate = db.prepare(
        "UPDATE students SET monthly_rate = ? WHERE zivvy_id = ?"
      );
      const updateCollected = db.prepare(
        "UPDATE students SET total_collected = ? WHERE zivvy_id = ?"
      );
      const insertPayment = db.prepare(`
        INSERT OR IGNORE INTO zivvy_payments (id, contact_id, date_processed, amount, description, payment_type, method, payment_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const rateTransaction = db.transaction(() => {
        let rateUpdated = 0;
        for (const [contactId, rate] of recentPayments.monthly_rates) {
          const result = updateRate.run(rate, contactId);
          rateUpdated += result.changes;
        }
        let ltvUpdated = 0;
        for (const [contactId, total] of allTimePayments.total_collected) {
          const result = updateCollected.run(total, contactId);
          ltvUpdated += result.changes;
        }
        // Persist individual payment records for trend analysis
        let paymentsStored = 0;
        for (const p of allTimePayments.payments) {
          const r = insertPayment.run(
            p.id, p.contact_id, p.date_processed, p.amount,
            p.description, p.payment_type, p.method, p.payment_status
          );
          paymentsStored += r.changes;
        }
        return { rateUpdated, ltvUpdated, paymentsStored };
      });
      const { rateUpdated, ltvUpdated, paymentsStored } = rateTransaction();
      results.payments.rates_updated = rateUpdated;
      results.payments.ltv_updated = ltvUpdated;
      results.payments.transactions_stored = paymentsStored;
      console.log(`[enrich] Updated ${rateUpdated} rates, ${ltvUpdated} LTV, stored ${paymentsStored} transactions`);
    }

    // Phase 2: Attendance (per-student, 210 calls at concurrency 3)
    if (["all", "full", "attendance"].includes(scope)) {
      const activeStudents = db.prepare(
        "SELECT id, zivvy_id FROM students WHERE membership_status = 'active' AND zivvy_id IS NOT NULL"
      ).all() as Array<{ id: number; zivvy_id: number }>;

      const contactIds = activeStudents.map((s) => s.zivvy_id);
      const zivvyToStudentId = new Map(activeStudents.map((s) => [s.zivvy_id, s.id]));

      console.log(`[enrich] Fetching attendance for ${contactIds.length} students...`);
      const attendanceResults = await enrichAttendanceBatch(contactIds, 3, (done, total) => {
        if (done % 20 === 0 || done === total) {
          console.log(`[enrich] Attendance progress: ${done}/${total}`);
        }
      });

      const updateAttendance = db.prepare(
        "UPDATE students SET last_attendance = ?, total_classes = ? WHERE id = ?"
      );
      const insertAttendanceLog = db.prepare(`
        INSERT OR IGNORE INTO zivvy_attendance_log (contact_id, parsed_date, entry_method, roster_name, style)
        VALUES (?, ?, ?, ?, ?)
      `);
      let attendanceUpdated = 0;
      let attendanceRecordsStored = 0;

      const attendanceTransaction = db.transaction(() => {
        for (const [contactId, data] of attendanceResults) {
          const studentId = zivvyToStudentId.get(contactId);
          if (!studentId) continue;
          if (data.last_attendance) {
            updateAttendance.run(data.last_attendance, data.total_classes, studentId);
            attendanceUpdated++;
          }
          // Persist individual attendance records for trend analysis
          for (const rec of data.attendance) {
            const r = insertAttendanceLog.run(
              rec.contact_id, rec.parsed_date, rec.entry_method, rec.roster_name, rec.style
            );
            attendanceRecordsStored += r.changes;
          }
        }
      });
      attendanceTransaction();

      results.attendance = {
        students_processed: attendanceResults.size,
        attendance_updated: attendanceUpdated,
        records_stored: attendanceRecordsStored,
      };
      console.log(`[enrich] Attendance updated: ${attendanceUpdated}, stored ${attendanceRecordsStored} records`);
    }

    // Phase 3: Ranks (one-time backfill or on-demand — NOT in regular "all" sync)
    if (["full", "ranks"].includes(scope)) {
      const activeStudents = db.prepare(
        "SELECT id, zivvy_id FROM students WHERE membership_status = 'active' AND zivvy_id IS NOT NULL"
      ).all() as Array<{ id: number; zivvy_id: number }>;

      const contactIds = activeStudents.map((s) => s.zivvy_id);
      const zivvyToStudentId = new Map(activeStudents.map((s) => [s.zivvy_id, s.id]));

      console.log(`[enrich] Fetching ranks for ${contactIds.length} students (backfill)...`);
      const rankResults = await enrichRanksBatch(contactIds, 3, (done, total) => {
        if (done % 20 === 0 || done === total) {
          console.log(`[enrich] Ranks progress: ${done}/${total}`);
        }
      });

      const updateRank = db.prepare(
        "UPDATE students SET belt_rank = ?, stripes = ? WHERE id = ?"
      );
      let rankUpdated = 0;

      const rankTransaction = db.transaction(() => {
        for (const [contactId, ranks] of rankResults) {
          const studentId = zivvyToStudentId.get(contactId);
          if (!studentId || ranks.length === 0) continue;
          const current = ranks[0]; // sorted desc, most recent first
          updateRank.run(current.belt_color, current.stripes, studentId);
          rankUpdated++;
        }
      });
      rankTransaction();

      results.ranks = {
        students_processed: rankResults.size,
        ranks_updated: rankUpdated,
      };
      console.log(`[enrich] Ranks updated: ${rankUpdated}`);
    }

    // Phase 4: Refresh contacts + re-score engagement
    if (["all", "full"].includes(scope)) {
      console.log("[enrich] Refreshing contacts and re-scoring...");
      const db2 = getDb();
      populateContacts(db2);
      refreshAllContacts(db2);
      const scoreResult = batchComputeEngagement(db2);
      results.engagement = scoreResult;
      console.log(`[enrich] Scored ${scoreResult.contacts_scored} contacts`);
    }

    // Release lock
    db.prepare("DELETE FROM app_settings WHERE key = 'enrich_lock'").run();

    return NextResponse.json({ success: true, scope, ...results });
  } catch (error) {
    // Release lock on error
    try {
      const db = getDb();
      db.prepare("DELETE FROM app_settings WHERE key = 'enrich_lock'").run();
    } catch { /* ignore cleanup errors */ }
    console.error("API Error [POST /api/sync-enrich]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
