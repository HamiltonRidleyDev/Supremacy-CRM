import { NextResponse } from "next/server";
import { getDb, initDb, ensureContactSchema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/me/dashboard — Member's personal dashboard data
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    initDb();
    ensureContactSchema();
    const db = getDb();

    const result: Record<string, any> = {
      user: {
        displayName: session.displayName,
        role: session.role,
      },
    };

    // Get student data if linked
    if (session.studentId) {
      const student = db.prepare(
        "SELECT id, first_name, last_name, belt_rank, stripes, membership_type, membership_status, start_date, last_attendance FROM students WHERE id = ?"
      ).get(session.studentId) as any;

      if (student) {
        result.student = student;

        // Days since last training
        if (student.last_attendance) {
          const last = new Date(student.last_attendance);
          const now = new Date();
          result.daysSinceLastTraining = Math.floor(
            (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        // Recent attendance (last 10 classes)
        const recentAttendance = db.prepare(`
          SELECT a.checked_in_at, c.date, c.start_time, ct.name as class_type,
                 lp.title as lesson_title, lp.position_area
          FROM attendance a
          JOIN classes c ON a.class_id = c.id
          JOIN class_types ct ON c.class_type_id = ct.id
          LEFT JOIN lesson_plans lp ON c.lesson_plan_id = lp.id
          WHERE a.student_id = ?
          ORDER BY c.date DESC, c.start_time DESC
          LIMIT 10
        `).all(session.studentId);
        result.recentAttendance = recentAttendance;

        // Attendance count this month
        const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const monthCount = db.prepare(`
          SELECT COUNT(*) as count FROM attendance a
          JOIN classes c ON a.class_id = c.id
          WHERE a.student_id = ? AND c.date LIKE ?
        `).get(session.studentId, `${thisMonth}%`) as any;
        result.classesThisMonth = monthCount?.count || 0;
      }
    }

    // Get contact engagement data if linked
    if (session.contactId) {
      const contact = db.prepare(
        "SELECT engagement_score, risk_level, score_attendance, score_progression FROM contacts WHERE id = ?"
      ).get(session.contactId) as any;

      if (contact) {
        result.engagement = {
          score: contact.engagement_score,
          riskLevel: contact.risk_level,
          attendance: contact.score_attendance,
          progression: contact.score_progression,
        };
      }
    }

    // Upcoming schedule (next 7 days)
    const today = new Date();
    const nextWeek: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const dateStr = d.toISOString().slice(0, 10);

      const classes = db.prepare(`
        SELECT s.id, s.start_time, s.end_time, s.instructor,
               ct.name as class_type, ct.is_gi, ct.min_belt
        FROM schedule s
        JOIN class_types ct ON s.class_type_id = ct.id
        WHERE s.day_of_week = ?
        ORDER BY s.start_time
      `).all(dow);

      if (classes.length > 0) {
        nextWeek.push({ date: dateStr, dayOfWeek: dow, classes });
      }
    }
    result.upcomingSchedule = nextWeek;

    // Announcements (pinned community messages)
    const announcements = db.prepare(`
      SELECT m.content, m.created_at, ch.name as channel_name
      FROM messages m
      JOIN channels ch ON m.channel_id = ch.id
      WHERE m.is_pinned = 1 AND ch.type = 'announcement'
      ORDER BY m.created_at DESC
      LIMIT 5
    `).all();
    result.announcements = announcements;

    return NextResponse.json(result);
  } catch (error) {
    console.error("API Error [GET /api/me/dashboard]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
