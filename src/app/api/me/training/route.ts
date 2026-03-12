import { NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/me/training — Member's training history and knowledge map
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.studentId) {
      return NextResponse.json({ error: "Unauthorized or no student linked" }, { status: 401 });
    }

    initDb();
    const db = getDb();

    // Full attendance history
    const attendance = db.prepare(`
      SELECT a.checked_in_at, c.date, c.start_time, ct.name as class_type,
             ct.is_gi, c.instructor, lp.title as lesson_title,
             lp.position_area, lp.belt_level
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      LEFT JOIN lesson_plans lp ON c.lesson_plan_id = lp.id
      WHERE a.student_id = ?
      ORDER BY c.date DESC, c.start_time DESC
    `).all(session.studentId);

    // Knowledge map: techniques exposed to through attended classes
    const techniqueExposure = db.prepare(`
      SELECT t.id, t.name, t.category, t.subcategory, t.belt_level, t.is_gi,
             COUNT(DISTINCT a.class_id) as times_exposed,
             MAX(c.date) as last_exposed
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      JOIN lesson_techniques lt ON c.lesson_plan_id = lt.lesson_plan_id
      JOIN techniques t ON lt.technique_id = t.id
      WHERE a.student_id = ?
      GROUP BY t.id
      ORDER BY t.category, t.name
    `).all(session.studentId);

    // Category summary
    const categorySummary = db.prepare(`
      SELECT t.category, COUNT(DISTINCT t.id) as techniques_seen,
             (SELECT COUNT(*) FROM techniques t2 WHERE t2.category = t.category) as total_in_category
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      JOIN lesson_techniques lt ON c.lesson_plan_id = lt.lesson_plan_id
      JOIN techniques t ON lt.technique_id = t.id
      WHERE a.student_id = ?
      GROUP BY t.category
      ORDER BY t.category
    `).all(session.studentId);

    // Monthly attendance trend (last 12 months)
    const monthlyTrend = db.prepare(`
      SELECT strftime('%Y-%m', c.date) as month, COUNT(*) as classes
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE a.student_id = ?
        AND c.date >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `).all(session.studentId);

    // Student belt info
    const student = db.prepare(
      "SELECT belt_rank, stripes, start_date FROM students WHERE id = ?"
    ).get(session.studentId) as any;

    return NextResponse.json({
      student: {
        beltRank: student?.belt_rank,
        stripes: student?.stripes,
        startDate: student?.start_date,
      },
      attendance,
      techniqueExposure,
      categorySummary,
      monthlyTrend,
      totalClasses: attendance.length,
      uniqueTechniques: techniqueExposure.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
