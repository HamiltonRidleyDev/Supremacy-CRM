import { NextResponse } from "next/server";
import { getDb, ensureContactSchema } from "@/lib/db";
import { populateContacts } from "@/lib/contacts/populate";
import { getSession, hasRole } from "@/lib/auth/session";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    ensureContactSchema();
    const db = getDb();
    const result = populateContacts(db);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("API Error [POST /api/contacts/populate]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    ensureContactSchema();
    const db = getDb();

    const total = (db.prepare("SELECT COUNT(*) as count FROM contacts").get() as any).count;
    const byType = db.prepare(
      "SELECT contact_type, COUNT(*) as count FROM contacts GROUP BY contact_type"
    ).all();
    const households = (db.prepare("SELECT COUNT(*) as count FROM household_links").get() as any).count;
    const withStudent = (db.prepare(
      "SELECT COUNT(*) as count FROM contacts WHERE student_id IS NOT NULL"
    ).get() as any).count;
    const withLead = (db.prepare(
      "SELECT COUNT(*) as count FROM contacts WHERE lead_id IS NOT NULL"
    ).get() as any).count;
    const withMM = (db.prepare(
      "SELECT COUNT(*) as count FROM contacts WHERE mm_id IS NOT NULL AND mm_id != ''"
    ).get() as any).count;
    const withZivvy = (db.prepare(
      "SELECT COUNT(*) as count FROM contacts WHERE zivvy_id IS NOT NULL AND zivvy_id != ''"
    ).get() as any).count;

    return NextResponse.json({
      total,
      byType,
      households,
      linkCoverage: { withStudent, withLead, withMM, withZivvy },
    });
  } catch (error) {
    console.error("API Error [GET /api/contacts/populate]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
