import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import {
  getSurveySendByToken,
  markSurveyOpened,
  markSurveyCompleted,
  upsertSurveyResponse,
  upsertStudentProfile,
} from "@/lib/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
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
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
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

    // Save each answer
    for (const [key, value] of Object.entries(answers)) {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        upsertSurveyResponse(send.id, key, String(value));
      }
    }

    // Map answers to student profile fields
    const questions = JSON.parse(send.template_questions) as Array<{
      key: string; profile_field?: string;
    }>;
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
