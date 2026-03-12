import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { initDb } from "@/lib/db";
import {
  getSurveySendByToken,
  markSurveyOpened,
  markSurveyCompleted,
  upsertSurveyResponse,
  upsertStudentProfile,
} from "@/lib/queries";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Rate limit: 10 survey lookups per hour per IP
    const ip = _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(ip, "survey_lookup", 10, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter },
        { status: 429 }
      );
    }

    initDb();
    const { token } = await params;

    const send = getSurveySendByToken(token) as {
      id: number; token: string; status: string; recipient_name: string;
      template_name: string; template_questions: string; template_description: string;
      expires_at: string | null; completed_at: string | null;
    } | undefined;

    if (!send) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (send.expires_at && new Date(send.expires_at) < new Date()) {
      return NextResponse.json({ error: "This survey has expired" }, { status: 410 });
    }

    // Mark as opened
    if (send.status === "sent") {
      markSurveyOpened(token);
    }

    return NextResponse.json({
      name: send.recipient_name,
      templateName: send.template_name,
      description: send.template_description,
      questions: JSON.parse(send.template_questions),
      status: send.status === "sent" ? "opened" : send.status,
      completed: send.status === "completed",
    });
  } catch (error) {
    console.error("Survey GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Rate limit: 10 survey submissions per hour per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(ip, "survey_submit", 10, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter },
        { status: 429 }
      );
    }

    initDb();
    const { token } = await params;

    const send = getSurveySendByToken(token) as {
      id: number; token: string; status: string; student_id: number | null;
      lead_id: number | null; template_questions: string;
      expires_at: string | null;
    } | undefined;

    if (!send) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (send.expires_at && new Date(send.expires_at) < new Date()) {
      return NextResponse.json({ error: "This survey has expired" }, { status: 410 });
    }

    const body = await request.json();
    const { answers } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "answers object is required" }, { status: 400 });
    }

    // Validate answer keys against template questions
    const questions = JSON.parse(send.template_questions) as Array<{
      key: string; profile_field?: string;
    }>;
    const validKeys = new Set(questions.map((q) => q.key));

    // Save each answer (only valid keys, max 2000 chars per answer)
    for (const [key, value] of Object.entries(answers)) {
      if (!validKeys.has(key)) continue; // skip unknown keys
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        upsertSurveyResponse(send.id, key, String(value).slice(0, 2000));
      }
    }

    // Map answers to student profile fields
    const profileFields: Record<string, string | number | null> = {};

    for (const q of questions) {
      if (q.profile_field && answers[q.key] !== undefined && answers[q.key] !== "") {
        let val = String(answers[q.key]);
        // Special handling for opt_in_marketing
        if (q.profile_field === "opt_in_marketing") {
          profileFields[q.profile_field] = val.toLowerCase() === "yes" ? 1 : 0;
        } else {
          profileFields[q.profile_field] = val;
        }
      }
    }

    if (Object.keys(profileFields).length > 0) {
      upsertStudentProfile(profileFields, send.student_id || undefined, send.lead_id || undefined);
    }

    // Mark completed
    markSurveyCompleted(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Survey POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
