import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
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

    // Reset users to just Rodrigo + Kyle + Dan (no fake student-linked users)
    db.exec(`DELETE FROM magic_codes`);
    db.exec(`DELETE FROM users`);

    // Hash default passwords for staff accounts
    const adminHash = bcrypt.hashSync("supremacy2026", 10);
    const managerHash = bcrypt.hashSync("supremacy2026", 10);

    const insertUser = db.prepare(
      `INSERT INTO users (email, phone, password_hash, role, student_id, display_name, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertUser.run("rodrigo@supremacyjj.com", "727-555-0001", adminHash, "admin", null, "Rodrigo", 1);
    insertUser.run("kyle@supremacyjj.com", "727-555-0002", managerHash, "manager", null, "Kyle", 1);
    insertUser.run("dan@supremacyjj.com", null, adminHash, "admin", null, "Dan Kemp", 1);

    return NextResponse.json({
      success: true,
      message: "Demo data cleared. Kept: class types, schedule, techniques, channels, survey templates. Users reset to Rodrigo + Kyle + Dan with default password.",
    });
  } catch (error) {
    console.error("API Error [POST /api/seed-reset]:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
