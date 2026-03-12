import { NextResponse } from "next/server";
import { getDb, ensureContactSchema } from "@/lib/db";
import { batchComputeEngagement, computeEngagement } from "@/lib/contacts/engagement";

export async function POST(request: Request) {
  try {
    ensureContactSchema();
    const db = getDb();
    const body = await request.json().catch(() => ({}));

    // Single contact scoring
    if (body.contactId) {
      const result = computeEngagement(db, body.contactId);
      // Also persist
      db.prepare(`
        UPDATE contacts SET
          engagement_score = ?, score_attendance = ?, score_communication = ?,
          score_progression = ?, score_community = ?, score_financial = ?,
          risk_level = ?, risk_factors = ?,
          scored_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(
        result.score,
        result.components.attendance.score,
        result.components.communication.score,
        result.components.progression.score,
        result.components.community.score,
        result.components.financial.score,
        result.risk_level,
        JSON.stringify(result.risk_factors),
        body.contactId
      );
      return NextResponse.json({ success: true, result });
    }

    // Batch scoring (all contacts)
    const result = batchComputeEngagement(db);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    ensureContactSchema();
    const db = getDb();

    const scored = (db.prepare(
      "SELECT COUNT(*) as count FROM contacts WHERE scored_at IS NOT NULL"
    ).get() as any).count;
    const total = (db.prepare("SELECT COUNT(*) as count FROM contacts").get() as any).count;
    const lastScored = (db.prepare(
      "SELECT MAX(scored_at) as last FROM contacts"
    ).get() as any)?.last;
    const distribution = db.prepare(`
      SELECT risk_level, COUNT(*) as count, ROUND(AVG(engagement_score), 1) as avg_score
      FROM contacts WHERE risk_level IS NOT NULL
      GROUP BY risk_level
    `).all();

    return NextResponse.json({ scored, total, lastScored, distribution });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
