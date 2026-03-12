import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { getUsers, updateUserRole } from "@/lib/queries";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export const GET = apiHandler(() => getUsers(), { minRole: "admin" });

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const { displayName, email, role, password } = body;

  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!["admin", "manager", "member", "guest"].includes(role)) {
    return NextResponse.json({ error: "Valid role required" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const db = getDb();

  // Check for duplicate email
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    `INSERT INTO users (email, role, password_hash, display_name, is_active) VALUES (?, ?, ?, ?, 1)`
  ).run(email.trim().toLowerCase(), role, hash, displayName.trim());

  return NextResponse.json({ success: true, userId: result.lastInsertRowid });
}, { minRole: "admin" });

export const PATCH = apiHandler(async (request) => {
  const body = await request.json();
  const { userId, role } = body;

  if (!userId || !["admin", "manager", "member", "guest"].includes(role)) {
    return NextResponse.json({ error: "Valid userId and role required" }, { status: 400 });
  }

  updateUserRole(userId, role);
  return NextResponse.json({ success: true });
}, { minRole: "admin" });
