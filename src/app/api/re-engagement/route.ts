import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { initDb, ensureContactSchema, ensureZivvySchema, ensureMMSchema, getDb } from "@/lib/db";
import { seed } from "@/lib/seed";
import { getInstructorInsights } from "@/lib/queries";
import { getContactDetail } from "@/lib/contacts/queries";
import {
  buildReEngagementSystemPrompt,
  buildReEngagementUserPrompt,
} from "@/lib/re-engagement-prompt";
import { getSession, hasRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limiter";

const anthropic = new Anthropic();

function ensureSchemas() {
  initDb();
  seed();
  ensureContactSchema();
  ensureZivvySchema();
  ensureMMSchema();
  // Ensure re-engagement tables exist
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS re_engagement_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id),
      message_type TEXT NOT NULL DEFAULT 'sms',
      tone TEXT NOT NULL DEFAULT 'warm',
      body TEXT NOT NULL,
      subject TEXT,
      context_summary TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by TEXT,
      edited_body TEXT,
      sent_at TEXT,
      dismissed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reengage_contact ON re_engagement_queue(contact_id);
    CREATE INDEX IF NOT EXISTS idx_reengage_status ON re_engagement_queue(status, created_at);
  `);
}

// GET — fetch at-risk active members + pending queue items
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    ensureSchemas();
    const db = getDb();

    // Active members who are at_risk, ghost, or cooling — sorted by urgency
    const candidates = db.prepare(`
      SELECT c.id, c.first_name, c.last_name, c.email, c.phone,
        c.contact_type, c.risk_level, c.engagement_score, c.monthly_revenue,
        c.risk_factors, c.age_group, c.student_id, c.mm_id,
        s.belt_rank, s.stripes, s.last_attendance, s.start_date, s.monthly_rate,
        s.parent_name, s.parent_phone,
        COALESCE(s.total_classes, 0) as total_classes,
        COALESCE(s.current_program, '') as current_program,
        CAST(JULIANDAY('now') - JULIANDAY(s.last_attendance) AS INTEGER) as days_absent,
        sp.goals, sp.motivation, sp.injuries_concerns, sp.schedule_preference,
        -- Count pending/recent outreach to avoid nagging
        (SELECT COUNT(*) FROM re_engagement_queue r
         WHERE r.contact_id = c.id
         AND r.created_at > datetime('now', '-14 days')
        ) as recent_outreach_count,
        (SELECT MAX(r.created_at) FROM re_engagement_queue r
         WHERE r.contact_id = c.id
        ) as last_outreach_at
      FROM contacts c
      LEFT JOIN students s ON s.id = c.student_id
      LEFT JOIN student_profiles sp ON sp.student_id = c.student_id
      WHERE c.contact_type = 'active_member'
        AND c.risk_level IN ('at_risk', 'ghost', 'cooling')
        AND s.last_attendance IS NOT NULL
      ORDER BY
        CASE c.risk_level
          WHEN 'ghost' THEN 1
          WHEN 'at_risk' THEN 2
          WHEN 'cooling' THEN 3
        END,
        c.monthly_revenue DESC NULLS LAST,
        s.last_attendance ASC
      LIMIT 50
    `).all().map((r: any) => ({
      ...r,
      risk_factors: r.risk_factors ? JSON.parse(r.risk_factors) : [],
    }));

    // Pending queue items (generated but not yet approved/sent)
    const queue = db.prepare(`
      SELECT r.*, c.first_name, c.last_name, c.phone, c.email,
        c.risk_level, c.monthly_revenue, c.contact_type, c.age_group,
        s.belt_rank, s.days_absent
      FROM re_engagement_queue r
      JOIN contacts c ON c.id = r.contact_id
      LEFT JOIN (
        SELECT c2.id, CAST(JULIANDAY('now') - JULIANDAY(s2.last_attendance) AS INTEGER) as days_absent
        FROM contacts c2
        LEFT JOIN students s2 ON s2.id = c2.student_id
      ) s ON s.id = c.id
      WHERE r.status IN ('pending', 'approved')
      ORDER BY
        CASE r.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 END,
        r.created_at DESC
    `).all();

    // Stats for the header
    const stats = db.prepare(`
      SELECT
        COUNT(CASE WHEN risk_level = 'ghost' THEN 1 END) as ghost_count,
        COUNT(CASE WHEN risk_level = 'at_risk' THEN 1 END) as at_risk_count,
        COUNT(CASE WHEN risk_level = 'cooling' THEN 1 END) as cooling_count,
        COALESCE(SUM(CASE WHEN risk_level IN ('at_risk', 'ghost') THEN monthly_revenue ELSE 0 END), 0) as revenue_at_risk
      FROM contacts
      WHERE contact_type = 'active_member' AND risk_level IN ('at_risk', 'ghost', 'cooling')
    `).get();

    const sent_this_week = (db.prepare(`
      SELECT COUNT(*) as count FROM re_engagement_queue
      WHERE status = 'sent' AND sent_at > datetime('now', '-7 days')
    `).get() as any)?.count || 0;

    return NextResponse.json({
      candidates,
      queue,
      stats: { ...stats as any, sent_this_week },
    });
  } catch (error) {
    console.error("API Error [GET /api/re-engagement]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — generate a re-engagement message for a contact
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = checkRateLimit(String(session.userId), "reengage_generate", 15, 3600);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${limit.retryAfter}s.` },
        { status: 429 }
      );
    }

    ensureSchemas();
    const db = getDb();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const body = await request.json();
    const {
      contactId,
      messageType = "sms",
      tone = "warm",
    } = body as {
      contactId: number;
      messageType?: "sms" | "email";
      tone?: "warm" | "casual" | "concerned";
    };

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const detail = getContactDetail(contactId) as any;
    if (!detail) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Get prior outreach for this contact (so AI doesn't repeat itself)
    const priorOutreach = db.prepare(`
      SELECT body, tone, message_type, created_at, status
      FROM re_engagement_queue
      WHERE contact_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(contactId) as any[];

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
      goals: detail.profile?.goals,
      motivation: detail.profile?.motivation,
      injuries_concerns: detail.profile?.injuries_concerns,
      schedule_preference: detail.profile?.schedule_preference,
    };

    const daysAbsent = detail.student?.last_attendance
      ? Math.floor((Date.now() - new Date(detail.student.last_attendance).getTime()) / (1000 * 60 * 60 * 24))
      : undefined;
    (contactData as any).days_absent = daysAbsent;

    const conversationCtx = detail.conversation
      ? {
          last_message_at: detail.conversation.last_message_at,
          has_replied: detail.conversation.has_replied,
          conv_message_count: detail.conversation.message_count,
          inbound_count: detail.conversation.inbound_count,
          outbound_count: detail.conversation.outbound_count,
        }
      : null;

    const insights = getInstructorInsights() as Array<{
      category: string;
      content: string;
      source_quote?: string;
    }>;

    const systemPrompt = buildReEngagementSystemPrompt(insights);
    const userPrompt = buildReEngagementUserPrompt(
      contactData,
      conversationCtx,
      (detail.household || []) as any[],
      (detail.recentMessages || []) as any[],
      priorOutreach,
      messageType,
      tone
    );

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

    // Save to queue
    const result = db.prepare(`
      INSERT INTO re_engagement_queue (contact_id, message_type, tone, body, subject, context_summary)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(contactId, messageType, tone, parsed.body, parsed.subject, parsed.context);

    return NextResponse.json({
      id: Number(result.lastInsertRowid),
      body: parsed.body,
      subject: parsed.subject,
      context: parsed.context,
      contactId,
      messageType,
      tone,
    });
  } catch (error) {
    console.error("API Error [POST /api/re-engagement]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — approve, edit, send, or dismiss a queue item
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session.role, "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    ensureSchemas();
    const db = getDb();

    const body = await request.json();
    const { id, action, editedBody } = body as {
      id: number;
      action: "approve" | "send" | "dismiss" | "edit";
      editedBody?: string;
    };

    if (!id || !action) {
      return NextResponse.json({ error: "id and action are required" }, { status: 400 });
    }

    switch (action) {
      case "approve":
        db.prepare(`
          UPDATE re_engagement_queue
          SET status = 'approved', approved_by = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(session.displayName || "Unknown", id);
        break;

      case "edit":
        if (!editedBody) {
          return NextResponse.json({ error: "editedBody is required for edit action" }, { status: 400 });
        }
        db.prepare(`
          UPDATE re_engagement_queue
          SET edited_body = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(editedBody, id);
        break;

      case "send":
        db.prepare(`
          UPDATE re_engagement_queue
          SET status = 'sent', sent_at = datetime('now'), approved_by = COALESCE(approved_by, ?), updated_at = datetime('now')
          WHERE id = ?
        `).run(session.displayName || "Unknown", id);
        // TODO: Integrate with Twilio/SMS provider here
        break;

      case "dismiss":
        db.prepare(`
          UPDATE re_engagement_queue
          SET status = 'dismissed', dismissed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).run(id);
        break;
    }

    return NextResponse.json({ success: true, id, action });
  } catch (error) {
    console.error("API Error [PATCH /api/re-engagement]:", error);
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
