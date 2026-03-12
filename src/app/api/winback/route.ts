import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { initDb, ensureContactSchema, ensureZivvySchema, ensureMMSchema } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getInstructorInsights } from "@/lib/queries";
import {
  getWinBackCandidates,
  getActiveSuggestions,
  getContactDetail,
  createWinBackSuggestion,
  updateWinBackSuggestionStatus,
  getCostTrendsBulk,
} from "@/lib/contacts/queries";
import {
  buildWinBackSystemPrompt,
  buildWinBackUserPrompt,
  buildHouseholdWinBackPrompt,
} from "@/lib/winback-prompt";
import type { ChildInfo } from "@/lib/winback-prompt";

import { getSession, hasRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limiter";

const anthropic = new Anthropic();

// GET — fetch candidates + existing suggestions
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    initDb();
    seed();
    ensureContactSchema();
    ensureZivvySchema();
    ensureMMSchema();

    const candidates = getWinBackCandidates(20);
    const activeSuggestions = getActiveSuggestions();

    // Collect all zivvy_ids for cost trend lookup
    const zivvyIds: number[] = [];
    for (const c of candidates as any[]) {
      if (c.zivvy_id) zivvyIds.push(Number(c.zivvy_id));
      if (c.children) {
        for (const ch of c.children) {
          if (ch.zivvy_id) zivvyIds.push(Number(ch.zivvy_id));
        }
      }
    }

    // Fetch cost trends for all relevant students
    const trendMap = zivvyIds.length > 0 ? getCostTrendsBulk(zivvyIds) : new Map();

    // Convert Map to a plain object keyed by zivvy_id for JSON serialization
    const costTrends: Record<string, any> = {};
    for (const [zid, trend] of trendMap) {
      costTrends[String(zid)] = trend;
    }

    return NextResponse.json({ candidates, activeSuggestions, costTrends });
  } catch (error) {
    console.error("API Error [GET /api/winback]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — generate a win-back message for a specific contact
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 10 win-back generations per hour per user
    const limit = checkRateLimit(String(session.userId), "winback_generate", 10, 3600);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${limit.retryAfter}s.` },
        { status: 429 }
      );
    }

    initDb();
    seed();
    ensureContactSchema();
    ensureZivvySchema();
    ensureMMSchema();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      contactId,
      messageType = "sms",
      tone = "warm",
      // Household mode: parent info + children array passed from the UI
      isHousehold = false,
      parentName,
      children,
    } = body as {
      contactId: number;
      messageType?: "sms" | "email";
      tone?: "warm" | "casual" | "urgent";
      isHousehold?: boolean;
      parentName?: string;
      children?: ChildInfo[];
    };

    if (!contactId && !isHousehold) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    // Build the prompts
    const insights = getInstructorInsights() as Array<{
      category: string;
      content: string;
      source_quote?: string;
    }>;
    const systemPrompt = buildWinBackSystemPrompt(insights);

    let userPrompt: string;
    let persistContactId: number;
    let conversationCtx: any = null;
    let recentMsgs: any[] = [];

    if (isHousehold && parentName && children && children.length > 0) {
      // ---- HOUSEHOLD MODE: message to parent about absent children ----

      // Try to get parent's conversation history if we have a real contact ID
      if (typeof contactId === "number" && contactId > 0) {
        const parentDetail = getContactDetail(contactId) as any;
        if (parentDetail) {
          conversationCtx = parentDetail.conversation
            ? {
                last_message_at: parentDetail.conversation.last_message_at,
                has_replied: parentDetail.conversation.has_replied,
                conv_message_count: parentDetail.conversation.message_count,
                inbound_count: parentDetail.conversation.inbound_count,
                outbound_count: parentDetail.conversation.outbound_count,
              }
            : null;
          recentMsgs = parentDetail.recentMessages || [];
        }
      }

      userPrompt = buildHouseholdWinBackPrompt(
        parentName,
        children,
        conversationCtx,
        recentMsgs,
        messageType,
        tone
      );

      // Store suggestion against the first child's contact ID
      persistContactId = children[0].id || contactId;

    } else {
      // ---- INDIVIDUAL MODE: direct message to this person ----
      const detail = getContactDetail(contactId) as any;
      if (!detail) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      const contactData = {
        first_name: detail.contact.first_name,
        last_name: detail.contact.last_name,
        contact_type: detail.contact.contact_type,
        risk_level: detail.contact.risk_level,
        belt_rank: detail.student?.belt_rank,
        stripes: detail.student?.stripes,
        current_program: detail.student?.current_program,
        start_date: detail.student?.start_date,
        monthly_rate: detail.student?.monthly_rate,
        last_attendance: detail.student?.last_attendance,
        total_classes: detail.student?.total_classes,
        age_group: detail.contact.age_group,
        quit_reason: detail.profile?.quit_reason,
        willing_to_return: detail.profile?.willing_to_return,
        goals: detail.profile?.goals,
        motivation: detail.profile?.motivation,
        injuries_concerns: detail.profile?.injuries_concerns,
        schedule_preference: detail.profile?.schedule_preference,
      };

      const daysAbsent = detail.student?.last_attendance
        ? Math.floor((Date.now() - new Date(detail.student.last_attendance).getTime()) / (1000 * 60 * 60 * 24))
        : undefined;
      (contactData as any).days_absent = daysAbsent;

      conversationCtx = detail.conversation
        ? {
            last_message_at: detail.conversation.last_message_at,
            has_replied: detail.conversation.has_replied,
            conv_message_count: detail.conversation.message_count,
            inbound_count: detail.conversation.inbound_count,
            outbound_count: detail.conversation.outbound_count,
          }
        : null;

      userPrompt = buildWinBackUserPrompt(
        contactData,
        conversationCtx,
        (detail.household || []) as any[],
        (detail.recentMessages || []) as any[],
        messageType,
        tone
      );

      persistContactId = contactId;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    const parsed = parseJsonResponse(rawText);

    // Persist to database
    const result = createWinBackSuggestion(
      persistContactId,
      messageType,
      tone,
      parsed.body,
      parsed.context
    );

    return NextResponse.json({
      id: Number(result.lastInsertRowid),
      body: parsed.body,
      subject: parsed.subject,
      context: parsed.context,
      contactId: persistContactId,
      messageType,
      tone,
      isHousehold,
    });
  } catch (error) {
    console.error("API Error [POST /api/winback]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update suggestion status
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    initDb();
    seed();
    ensureContactSchema();
    ensureZivvySchema();
    ensureMMSchema();

    const body = await request.json();
    const { suggestionId, status, approvedBy } = body as {
      suggestionId: number;
      status: "approved" | "sent" | "dismissed";
      approvedBy?: string;
    };

    if (!suggestionId || !status) {
      return NextResponse.json(
        { error: "suggestionId and status are required" },
        { status: 400 }
      );
    }

    updateWinBackSuggestionStatus(suggestionId, status, approvedBy);

    return NextResponse.json({ success: true, suggestionId, status });
  } catch (error) {
    console.error("API Error [PATCH /api/winback]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function parseJsonResponse(raw: string): {
  body: string;
  subject: string | null;
  context: string | null;
} {
  try {
    const cleaned = raw
      .replace(/^```json?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      body: parsed.body || raw,
      subject: parsed.subject || null,
      context: parsed.context || null,
    };
  } catch {
    return { body: raw, subject: null, context: null };
  }
}
