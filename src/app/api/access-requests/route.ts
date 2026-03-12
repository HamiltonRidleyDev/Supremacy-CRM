import { NextRequest, NextResponse } from "next/server";
import { initDb, getDb } from "@/lib/db";
import { getSession, hasRole } from "@/lib/auth/session";

// POST — submit a new access request (unauthenticated, from login page)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, message } = body;

  if (!name?.trim() || (!email?.trim() && !phone?.trim())) {
    return NextResponse.json(
      { error: "Name and at least one contact method (email or phone) required" },
      { status: 400 }
    );
  }

  const db = initDb();
  const result = db
    .prepare(
      `INSERT INTO access_requests (name, email, phone, message) VALUES (?, ?, ?, ?)`
    )
    .run(name.trim(), email?.trim() || null, phone?.trim() || null, message?.trim() || null);

  return NextResponse.json({ id: result.lastInsertRowid, success: true }, { status: 201 });
}

// GET — list access requests (admin/manager only)
export async function GET() {
  const session = await getSession();
  if (!session || !hasRole(session.role, "manager")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = initDb();
  const rows = db.prepare(
    "SELECT * FROM access_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC"
  ).all();

  return NextResponse.json(rows);
}

// PATCH — resolve an access request (admin/manager only)
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasRole(session.role, "manager")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, status, resolved_note, linked_contact_id } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const db = initDb();
  db.prepare(
    `UPDATE access_requests
     SET status = ?, resolved_by = ?, resolved_note = ?, linked_contact_id = ?, resolved_at = datetime('now')
     WHERE id = ?`
  ).run(
    status || "resolved",
    session.displayName,
    resolved_note || null,
    linked_contact_id || null,
    id
  );

  return NextResponse.json({ success: true });
}
