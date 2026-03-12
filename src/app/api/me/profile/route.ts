import { NextResponse } from "next/server";
import { getDb, initDb, ensureContactSchema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/me/profile — Member's profile data
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    initDb();
    ensureContactSchema();
    const db = getDb();

    const user = db.prepare(
      "SELECT id, email, phone, role, display_name, created_at, last_login FROM users WHERE id = ?"
    ).get(session.userId) as any;

    const result: Record<string, any> = {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        displayName: user.display_name,
        hasPassword: !!db.prepare("SELECT password_hash FROM users WHERE id = ? AND password_hash IS NOT NULL").get(session.userId),
        createdAt: user.created_at,
        lastLogin: user.last_login,
      },
    };

    if (session.studentId) {
      const student = db.prepare(
        "SELECT first_name, last_name, belt_rank, stripes, membership_type, membership_status, start_date, email, phone FROM students WHERE id = ?"
      ).get(session.studentId) as any;
      result.student = student;
    }

    // Enrichment profile if exists
    if (session.studentId) {
      const profile = db.prepare(
        "SELECT * FROM student_profiles WHERE student_id = ?"
      ).get(session.studentId) as any;
      if (profile) {
        result.profile = {
          motivation: profile.motivation,
          goals: profile.goals,
          priorTraining: profile.prior_training,
          schedulePreference: profile.schedule_preference,
          trainingFrequencyTarget: profile.training_frequency_target,
          injuriesConcerns: profile.injuries_concerns,
          giOrNogi: profile.gi_or_nogi,
          instagramHandle: profile.instagram_handle,
          occupation: profile.occupation,
        };
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/me/profile — Update member's own profile
 */
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    initDb();
    const db = getDb();
    const body = await request.json();

    // Only allow updating safe fields
    const allowedUserFields = ["display_name", "phone"];
    const userUpdates: string[] = [];
    const userValues: any[] = [];

    for (const field of allowedUserFields) {
      const camelKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (body[camelKey] !== undefined) {
        userUpdates.push(`${field} = ?`);
        userValues.push(body[camelKey]);
      }
    }

    if (userUpdates.length > 0) {
      userUpdates.push("updated_at = datetime('now')");
      userValues.push(session.userId);
      db.prepare(
        `UPDATE users SET ${userUpdates.join(", ")} WHERE id = ?`
      ).run(...userValues);
    }

    // Update enrichment profile fields
    if (session.studentId) {
      const allowedProfileFields = [
        "motivation", "goals", "schedule_preference",
        "training_frequency_target", "injuries_concerns",
        "gi_or_nogi", "instagram_handle", "occupation",
      ];
      const profileUpdates: string[] = [];
      const profileValues: any[] = [];

      for (const field of allowedProfileFields) {
        const camelKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (body[camelKey] !== undefined) {
          profileUpdates.push(`${field} = ?`);
          profileValues.push(body[camelKey]);
        }
      }

      if (profileUpdates.length > 0) {
        // Upsert profile
        const existing = db.prepare(
          "SELECT id FROM student_profiles WHERE student_id = ?"
        ).get(session.studentId);

        if (existing) {
          profileUpdates.push("updated_at = datetime('now')");
          profileValues.push(session.studentId);
          db.prepare(
            `UPDATE student_profiles SET ${profileUpdates.join(", ")} WHERE student_id = ?`
          ).run(...profileValues);
        } else {
          profileValues.push(session.studentId);
          db.prepare(
            `INSERT INTO student_profiles (${profileUpdates.map(u => u.split(" = ")[0]).join(", ")}, student_id) VALUES (${profileUpdates.map(() => "?").join(", ")}, ?)`
          ).run(...profileValues);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
