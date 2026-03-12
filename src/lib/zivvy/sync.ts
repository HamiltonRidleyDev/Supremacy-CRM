import { getDb } from "../db";
import { fetchAllSyncData } from "./client";
import { mapToStudent, mapToLead } from "./mapper";
import type { ZivvyContact } from "./types";
import type { SyncResult } from "./types";

/**
 * Run a full sync from Zivvy → local SQLite.
 *
 * Steps:
 * 1. Authenticate via Playwright (handled by client → auth)
 * 2. Fetch all students, prospects, and former members from Zivvy API
 * 3. Upsert into zivvy_contacts (raw mirror)
 * 4. Upsert into students table (active + former)
 * 5. Upsert into leads table (prospects)
 * 6. Log the sync run
 */
export async function runSync(): Promise<SyncResult> {
  const start = Date.now();
  const db = getDb();

  // Create sync log entry
  const logInsert = db.prepare(
    `INSERT INTO sync_log (started_at, status) VALUES (datetime('now'), 'running')`
  );
  const logResult = logInsert.run();
  const syncLogId = logResult.lastInsertRowid;

  try {
    // Fetch from Zivvy API
    const { students, prospects, former } = await fetchAllSyncData();

    // Upsert raw contacts
    const upsertRaw = db.prepare(`
      INSERT INTO zivvy_contacts (id, contact_type, first_name, last_name, email, phone, mobile,
        age_group, source, current_program, current_rank, tuition_amount, billing_method,
        total_classes_taken, last_attend, date_contact_added, on_trial, on_vacation,
        quit_date, prospect_stage, raw_json, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        contact_type=excluded.contact_type, first_name=excluded.first_name, last_name=excluded.last_name,
        email=excluded.email, phone=excluded.phone, mobile=excluded.mobile, age_group=excluded.age_group,
        source=excluded.source, current_program=excluded.current_program, current_rank=excluded.current_rank,
        tuition_amount=excluded.tuition_amount, billing_method=excluded.billing_method,
        total_classes_taken=excluded.total_classes_taken, last_attend=excluded.last_attend,
        date_contact_added=excluded.date_contact_added, on_trial=excluded.on_trial,
        on_vacation=excluded.on_vacation, quit_date=excluded.quit_date, prospect_stage=excluded.prospect_stage,
        raw_json=excluded.raw_json, synced_at=datetime('now')
    `);

    // Upsert students (active)
    const upsertStudent = db.prepare(`
      INSERT INTO students (zivvy_id, first_name, last_name, email, phone, belt_rank, stripes,
        membership_type, membership_status, monthly_rate, start_date, last_attendance, notes,
        age_group, age, address, city, state, zip, parent_name, parent_phone, source,
        current_program, total_classes, billing_method, on_vacation, date_added,
        created_at, updated_at)
      VALUES (@zivvy_id, @first_name, @last_name, @email, @phone, @belt_rank, @stripes,
        @membership_type, @membership_status, @monthly_rate, @start_date, @last_attendance, @notes,
        @age_group, @age, @address, @city, @state, @zip, @parent_name, @parent_phone, @source,
        @current_program, @total_classes, @billing_method, @on_vacation, @date_added,
        datetime('now'), datetime('now'))
      ON CONFLICT(zivvy_id) DO UPDATE SET
        first_name=excluded.first_name, last_name=excluded.last_name, email=excluded.email,
        phone=excluded.phone, belt_rank=excluded.belt_rank, stripes=excluded.stripes,
        membership_type=excluded.membership_type, membership_status=excluded.membership_status,
        monthly_rate=excluded.monthly_rate, last_attendance=excluded.last_attendance,
        age_group=excluded.age_group, age=excluded.age, address=excluded.address,
        city=excluded.city, state=excluded.state, zip=excluded.zip,
        parent_name=excluded.parent_name, parent_phone=excluded.parent_phone,
        source=excluded.source, current_program=excluded.current_program,
        total_classes=excluded.total_classes, billing_method=excluded.billing_method,
        on_vacation=excluded.on_vacation, date_added=excluded.date_added,
        updated_at=datetime('now')
    `);

    // Upsert leads (prospects)
    const upsertLead = db.prepare(`
      INSERT INTO leads (zivvy_id, first_name, last_name, email, phone, source, interest,
        status, notes, created_at, updated_at)
      VALUES (@zivvy_id, @first_name, @last_name, @email, @phone, @source, @interest,
        @status, @notes, datetime('now'), datetime('now'))
      ON CONFLICT(zivvy_id) DO UPDATE SET
        first_name=excluded.first_name, last_name=excluded.last_name, email=excluded.email,
        phone=excluded.phone, source=excluded.source, interest=excluded.interest,
        notes=excluded.notes, updated_at=datetime('now')
    `);

    // Run all upserts in a transaction
    const syncTransaction = db.transaction(() => {
      // Raw mirror — all contacts
      const allContacts: ZivvyContact[] = [...students, ...prospects, ...former];
      for (const c of allContacts) {
        upsertRaw.run(
          c.id, c.contactType, c.firstName, c.lastName.trim(), c.emailAddress,
          c.phone, c.mobile, c.ageGroup, c.source, null /* currentProgram not in list */,
          null /* currentRank not in list */, null /* tuitionAmount not in list */, null /* billingMethod not in list */,
          null /* totalClassesTaken not in list */, null /* lastAttend not in list */, c.entered,
          c.onTrial ? 1 : 0, c.vacationStart && !c.vacationReturn ? 1 : 0,
          c.quitDate, c.prospectStage, JSON.stringify(c)
        );
      }

      // Students (active)
      for (const c of students) {
        const mapped = mapToStudent(c, "active");
        upsertStudent.run(mapped);
      }

      // Former members → also into students table as inactive
      for (const c of former) {
        const mapped = mapToStudent(c, "inactive");
        upsertStudent.run(mapped);
      }

      // Prospects → leads table
      for (const c of prospects) {
        const mapped = mapToLead(c);
        upsertLead.run(mapped);
      }
    });

    syncTransaction();

    const result: SyncResult = {
      status: "success",
      students_synced: students.length,
      leads_synced: prospects.length,
      former_synced: former.length,
      total_contacts: students.length + prospects.length + former.length,
      duration_ms: Date.now() - start,
    };

    // Update sync log
    db.prepare(`
      UPDATE sync_log SET
        completed_at = datetime('now'),
        status = 'success',
        students_synced = ?,
        leads_synced = ?,
        former_synced = ?,
        total_contacts = ?
      WHERE id = ?
    `).run(result.students_synced, result.leads_synced, result.former_synced, result.total_contacts, syncLogId);

    // Refresh contact graph after sync
    try {
      const { ensureContactSchema } = require("../db");
      ensureContactSchema();
      const { populateContacts } = require("../contacts/populate");
      populateContacts(db);
    } catch (_) { /* contact schema not yet initialized — skip */ }

    return result;

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Update sync log with error
    db.prepare(`
      UPDATE sync_log SET
        completed_at = datetime('now'),
        status = 'error',
        error_message = ?
      WHERE id = ?
    `).run(errorMsg, syncLogId);

    return {
      status: "error",
      students_synced: 0,
      leads_synced: 0,
      former_synced: 0,
      total_contacts: 0,
      duration_ms: Date.now() - start,
      error: errorMsg,
    };
  }
}

/** Get the last sync log entry */
export function getLastSync(): {
  status: string;
  started_at: string;
  completed_at: string | null;
  students_synced: number;
  leads_synced: number;
  former_synced: number;
  total_contacts: number;
  error_message: string | null;
} | null {
  const db = getDb();
  return db.prepare(
    `SELECT status, started_at, completed_at, students_synced, leads_synced, former_synced, total_contacts, error_message
     FROM sync_log ORDER BY id DESC LIMIT 1`
  ).get() as ReturnType<typeof getLastSync>;
}
