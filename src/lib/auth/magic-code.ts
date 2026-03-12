/**
 * Magic code authentication for members.
 *
 * Flow:
 *   1. Student enters email or phone
 *   2. We find their contact/student record
 *   3. Generate a 6-digit code, store in DB with 10-min expiry
 *   4. (In production: send via SMS/email. For now: return in response for dev)
 *   5. Student enters code → we verify → create session
 */

import { getDb } from "../db";
import crypto from "crypto";

const CODE_EXPIRY_MINUTES = 10;

/**
 * Generate and store a magic login code for a user.
 * Returns the code (for dev/testing — in production, send via SMS/email).
 */
export function generateMagicCode(userId: number): string {
  const db = getDb();
  const code = String(crypto.randomInt(100000, 999999)); // 6 digits, cryptographically secure
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // Clear any existing codes for this user
  db.prepare("DELETE FROM magic_codes WHERE user_id = ?").run(userId);

  // Insert new code
  db.prepare(
    "INSERT INTO magic_codes (user_id, code, expires_at) VALUES (?, ?, ?)"
  ).run(userId, code, expiresAt);

  return code;
}

/**
 * Verify a magic code. Returns true if valid, false if expired/wrong.
 * Deletes the code after successful verification (one-time use).
 */
export function verifyMagicCode(userId: number, code: string): boolean {
  const db = getDb();

  const row = db.prepare(
    "SELECT id, expires_at FROM magic_codes WHERE user_id = ? AND code = ?"
  ).get(userId, code) as any;

  if (!row) return false;

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    db.prepare("DELETE FROM magic_codes WHERE id = ?").run(row.id);
    return false;
  }

  // Valid — delete and return true
  db.prepare("DELETE FROM magic_codes WHERE id = ?").run(row.id);
  return true;
}

/**
 * Find or create a user for a contact trying to log in.
 * Matches by email or phone against contacts → students → leads.
 */
export function findOrCreateUserByContact(
  identifier: string
): { userId: number; isNew: boolean } | null {
  const db = getDb();
  const normalized = identifier.toLowerCase().trim();
  const isEmail = normalized.includes("@");

  // First check if a user already exists with this email/phone
  const existingUser = isEmail
    ? db.prepare("SELECT id FROM users WHERE LOWER(TRIM(email)) = ?").get(normalized)
    : db.prepare(
        "SELECT id FROM users WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')',''),'+','') = ?"
      ).get(normalized.replace(/[\-\s\(\)\+]/g, ""));

  if (existingUser) {
    return { userId: (existingUser as any).id, isNew: false };
  }

  // Find matching contact
  const contact = isEmail
    ? db.prepare(
        "SELECT id, student_id, first_name, last_name, email, phone FROM contacts WHERE LOWER(TRIM(email)) = ? LIMIT 1"
      ).get(normalized)
    : db.prepare(
        `SELECT id, student_id, first_name, last_name, email, phone FROM contacts
         WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')',''),'+','') = ?
         LIMIT 1`
      ).get(normalized.replace(/[\-\s\(\)\+]/g, ""));

  if (!contact) return null;

  const c = contact as any;

  // Create a new user linked to this contact
  const result = db.prepare(
    `INSERT INTO users (email, phone, role, student_id, display_name, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(
    c.email,
    c.phone,
    c.student_id ? "member" : "guest",
    c.student_id,
    `${c.first_name} ${c.last_name}`.trim()
  );

  return { userId: Number(result.lastInsertRowid), isNew: true };
}
