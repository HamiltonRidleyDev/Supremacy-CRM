import { NextResponse } from "next/server";
import { initDb, ensureContactSchema, ensureZivvySchema, ensureMMSchema } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getStudentKnowledgeMap, getStudentAttendanceHistory } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    initDb();
    seed();
    ensureContactSchema();
    ensureZivvySchema();
    ensureMMSchema();
    const { id } = await params;
    const studentId = parseInt(id);
    const db = getDb();

    const student = db.prepare("SELECT * FROM students WHERE id = ?").get(studentId) as any;
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const knowledge = getStudentKnowledgeMap(studentId);
    const attendance = getStudentAttendanceHistory(studentId);

    // Contact record with engagement scores
    const contact = db.prepare(`
      SELECT id, engagement_score, risk_level, risk_factors,
        score_attendance, score_communication, score_progression,
        score_community, score_financial, monthly_revenue, mm_id,
        contact_type, zivvy_id, scored_at
      FROM contacts WHERE student_id = ?
    `).get(studentId) as any;

    // Student profile (motivation, goals, quit reason, etc.)
    const profile = db.prepare(`
      SELECT motivation, goals, quit_reason, willing_to_return,
        injuries_concerns, schedule_preference, training_frequency_target,
        prior_training, prior_gym, gi_or_nogi, occupation,
        instagram_handle, household_members
      FROM student_profiles WHERE student_id = ?
    `).get(studentId) as any;

    // Household members
    const household = contact ? db.prepare(`
      SELECT
        c2.id, c2.first_name, c2.last_name, c2.contact_type,
        c2.engagement_score, c2.risk_level, c2.monthly_revenue, c2.age_group,
        h.relationship, h.parent_is_student,
        s2.belt_rank, s2.membership_status, s2.last_attendance
      FROM household_links h
      JOIN contacts c2 ON c2.id = CASE
        WHEN h.parent_contact_id = ? THEN h.child_contact_id
        ELSE h.parent_contact_id
      END
      LEFT JOIN students s2 ON s2.id = c2.student_id
      WHERE h.parent_contact_id = ? OR h.child_contact_id = ?
    `).all(contact.id, contact.id, contact.id) : [];

    // Conversation history from Market Muscles
    let conversations = null;
    let recentMessages: any[] = [];
    if (contact?.mm_id) {
      conversations = db.prepare(`
        SELECT thread_id, message_count, inbound_count, outbound_count,
          has_replied, response_time_avg_hrs, last_message_at, first_message_at,
          unread_count, workflow_touches
        FROM mm_conversations WHERE contact_id = ?
        ORDER BY last_message_at DESC LIMIT 1
      `).get(contact.mm_id);

      recentMessages = db.prepare(`
        SELECT direction, content, created_at, source, status
        FROM mm_messages WHERE contact_id = ?
        ORDER BY created_at DESC LIMIT 20
      `).all(contact.mm_id);
    }

    // Monthly attendance trend (for sparkline)
    const attendanceTrend = db.prepare(`
      SELECT strftime('%Y-%m', parsed_date) as month, COUNT(*) as classes
      FROM zivvy_attendance_log
      WHERE contact_id = ?
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all(contact?.zivvy_id || student.zivvy_id || -1);

    // Monthly payment trend
    const paymentTrend = db.prepare(`
      SELECT strftime('%Y-%m', date_processed) as month, SUM(amount) as paid
      FROM zivvy_payments
      WHERE contact_id = ?
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all(contact?.zivvy_id || student.zivvy_id || -1);

    return NextResponse.json({
      student,
      knowledge,
      attendance,
      contact,
      profile,
      household,
      conversations,
      recentMessages,
      attendanceTrend,
      paymentTrend,
    });
  } catch (error) {
    console.error("API Error [GET /api/students/[id]]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
