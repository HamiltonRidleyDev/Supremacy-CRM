import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = initDb();
  const status = req.nextUrl.searchParams.get("status");

  let query = "SELECT * FROM feedback";
  const params: string[] = [];
  if (status && status !== "all") {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC";

  const rows = db.prepare(query).all(...params);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { page, tab, feedback_type, message } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const db = initDb();
  const result = db
    .prepare(
      `INSERT INTO feedback (page, tab, user_name, user_role, feedback_type, message)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      page || "unknown",
      tab || null,
      session.displayName,
      session.role,
      feedback_type || "general",
      message.trim()
    );

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, status, admin_notes } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const db = initDb();
  db.prepare(
    `UPDATE feedback SET status = ?, admin_notes = ?, reviewed_at = datetime('now') WHERE id = ?`
  ).run(status || "reviewed", admin_notes || null, id);

  return NextResponse.json({ success: true });
}
