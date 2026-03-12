import { NextResponse } from "next/server";
import { getDb, initDb, ensureContactSchema } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth/session";

/**
 * POST /api/auth/claim — Set password for authenticated user
 *
 * Requires an active session (user logged in via magic code).
 * Allows them to set a password for future direct login.
 *
 * Body: { password: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "You must be logged in to set a password" },
        { status: 401 }
      );
    }

    initDb();
    ensureContactSchema();
    const db = getDb();
    const body = await request.json();

    if (!body.password || body.password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(body.password, 10);

    db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(hash, session.userId);

    return NextResponse.json({ success: true, message: "Password set successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
