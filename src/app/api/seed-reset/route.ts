import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    // ADMIN ONLY — this is a destructive operation
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Require explicit confirmation
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== "RESET_ALL_DATA") {
      return NextResponse.json(
        { error: "Confirmation required. Send { confirm: 'RESET_ALL_DATA' } to proceed." },
        { status: 400 }
      );
    }

    const db = initDb();

    // Temporarily disable FK checks so we can delete in any order
    db.pragma("foreign_keys = OFF");

    // Clear fake demo data
    // Keep: class_types, schedule, techniques, channels, survey_templates
    db.exec(`
      DELETE FROM attendance;
      DELETE FROM lesson_techniques;
      DELETE FROM messages;
      DELETE FROM channel_members;
      DELETE FROM follow_ups;
      DELETE FROM notes;
      DELETE FROM classes;
      DELETE FROM lesson_plans;
      DELETE FROM survey_responses;
      DELETE FROM survey_sends;
      DELETE FROM student_profiles;
      DELETE FROM chat_messages;
      DELETE FROM chat_sessions;
      DELETE FROM instructor_insights;
      DELETE FROM content_revisions;
      DELETE FROM content_pieces;
      DELETE FROM leads;
      DELETE FROM students;
    `);

    db.pragma("foreign_keys = ON");

    // Reset users to just Rodrigo + Kyle + Dan with random passwords
    db.exec(`DELETE FROM magic_codes`);
    db.exec(`DELETE FROM users`);

    // Generate random passwords for staff accounts
    const adminPassword = crypto.randomBytes(16).toString("hex");
    const managerPassword = crypto.randomBytes(16).toString("hex");
    const adminHash = bcrypt.hashSync(adminPassword, 10);
    const managerHash = bcrypt.hashSync(managerPassword, 10);

    const insertUser = db.prepare(
      `INSERT INTO users (email, phone, password_hash, role, student_id, display_name, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertUser.run("rodrigo@supremacyjj.com", "727-555-0001", adminHash, "admin", null, "Rodrigo", 1);
    insertUser.run("kyle@supremacyjj.com", "727-555-0002", managerHash, "manager", null, "Kyle", 1);
    insertUser.run("dan@supremacyjj.com", null, adminHash, "admin", null, "Dan Kemp", 1);

    return NextResponse.json({
      success: true,
      message: "Data reset complete. Change these passwords immediately.",
      credentials: {
        admin: { accounts: ["rodrigo@supremacyjj.com", "dan@supremacyjj.com"], tempPassword: adminPassword },
        manager: { accounts: ["kyle@supremacyjj.com"], tempPassword: managerPassword },
      },
    });
  } catch (error) {
    console.error("API Error [POST /api/seed-reset]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
