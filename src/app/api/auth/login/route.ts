import { NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { ensureContactSchema } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { findOrCreateUserByContact, generateMagicCode } from "@/lib/auth/magic-code";

/**
 * POST /api/auth/login
 *
 * Two modes:
 *   1. Password login: { email, password }
 *      → For admin/manager accounts with password_hash set
 *
 *   2. Magic code request: { identifier }
 *      → Finds contact by email/phone, creates user if needed, returns code
 *      → In production: sends code via SMS/email
 *
 *   3. Magic code verify: { identifier, code }
 *      → Verifies code, creates session
 */
export async function POST(request: Request) {
  try {
    initDb();
    ensureContactSchema();
    const db = getDb();
    const body = await request.json();

    // Mode 1: Password login (admin/manager)
    if (body.email && body.password) {
      const user = db.prepare(
        "SELECT * FROM users WHERE LOWER(TRIM(email)) = ? AND is_active = 1"
      ).get(body.email.toLowerCase().trim()) as any;

      if (!user || !user.password_hash) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      const valid = await bcrypt.compare(body.password, user.password_hash);
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      // Update last_login
      db.prepare(
        "UPDATE users SET last_login = datetime('now') WHERE id = ?"
      ).run(user.id);

      // Find contact_id
      const contact = db.prepare(
        "SELECT id FROM contacts WHERE student_id = ? OR LOWER(TRIM(email)) = ?"
      ).get(user.student_id, user.email?.toLowerCase().trim()) as any;

      const token = await createSession({
        userId: user.id,
        role: user.role,
        studentId: user.student_id,
        contactId: contact?.id || null,
        displayName: user.display_name,
        email: user.email,
      });

      await setSessionCookie(token);
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          role: user.role,
          displayName: user.display_name,
        },
      });
    }

    // Mode 2 & 3: Magic code flow
    if (body.identifier) {
      const result = findOrCreateUserByContact(body.identifier);
      if (!result) {
        return NextResponse.json(
          { error: "No account found with that email or phone. Please check and try again." },
          { status: 404 }
        );
      }

      // If code provided, verify it
      if (body.code) {
        const { verifyMagicCode } = require("@/lib/auth/magic-code");
        const valid = verifyMagicCode(result.userId, body.code);
        if (!valid) {
          return NextResponse.json(
            { error: "Invalid or expired code. Please request a new one." },
            { status: 401 }
          );
        }

        // Get full user data
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.userId) as any;

        // Update last_login
        db.prepare(
          "UPDATE users SET last_login = datetime('now') WHERE id = ?"
        ).run(user.id);

        // Find contact_id
        const contact = user.student_id
          ? db.prepare("SELECT id FROM contacts WHERE student_id = ?").get(user.student_id) as any
          : db.prepare("SELECT id FROM contacts WHERE LOWER(TRIM(email)) = ?").get(user.email?.toLowerCase().trim()) as any;

        const token = await createSession({
          userId: user.id,
          role: user.role,
          studentId: user.student_id,
          contactId: contact?.id || null,
          displayName: user.display_name,
          email: user.email,
        });

        await setSessionCookie(token);
        return NextResponse.json({
          success: true,
          user: {
            id: user.id,
            role: user.role,
            displayName: user.display_name,
          },
        });
      }

      // No code provided — generate one
      const code = generateMagicCode(result.userId);

      // In production: send via SMS/email
      // For now: return in response for development
      return NextResponse.json({
        success: true,
        message: "Login code generated",
        isNew: result.isNew,
        // DEV ONLY — remove in production
        _devCode: process.env.NODE_ENV !== "production" ? code : undefined,
      });
    }

    return NextResponse.json(
      { error: "Provide { email, password } or { identifier } or { identifier, code }" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
