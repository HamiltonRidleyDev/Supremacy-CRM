import { NextResponse } from "next/server";
import { getDb, ensureMMSchema } from "@/lib/db";

/** GET /api/mm-insights — engagement analytics from Market Muscles data */
export async function GET() {
  try {
    ensureMMSchema();
    const db = getDb();

    // Conversation overview
    const convStats = db.prepare(`
      SELECT
        COUNT(*) as total_threads,
        SUM(CASE WHEN has_replied = 1 THEN 1 ELSE 0 END) as replied_threads,
        SUM(message_count) as total_messages,
        SUM(inbound_count) as total_inbound,
        SUM(outbound_count) as total_outbound,
        SUM(workflow_touches) as total_workflow_messages,
        ROUND(AVG(CASE WHEN response_time_avg_hrs IS NOT NULL THEN response_time_avg_hrs END), 1) as avg_response_time_hrs,
        SUM(unread_count) as total_unread
      FROM mm_conversations
    `).get();

    // Recent active conversations (last 30 days)
    const recentConversations = db.prepare(`
      SELECT
        c.thread_id, c.contact_id, c.contact_name,
        c.message_count, c.inbound_count, c.outbound_count,
        c.has_replied, c.last_message_at, c.last_message_direction,
        c.last_message_preview, c.response_time_avg_hrs,
        c.workflow_touches, c.unread_count,
        mc.email, mc.phone, mc.tags
      FROM mm_conversations c
      LEFT JOIN mm_contacts mc ON mc.id = c.contact_id
      WHERE c.last_message_at IS NOT NULL
      ORDER BY c.last_message_at DESC
      LIMIT 25
    `).all();

    // Leads with conversations that haven't replied (hot follow-up targets)
    const noReplyLeads = db.prepare(`
      SELECT
        l.id, l.first_name, l.last_name, l.email, l.phone, l.status,
        l.mm_message_count, l.mm_last_contact_at, l.mm_last_direction,
        c.outbound_count, c.workflow_touches, c.last_outbound_at
      FROM leads l
      JOIN mm_conversations c ON c.contact_id = l.mm_id
      WHERE c.has_replied = 0 AND c.outbound_count > 0
      ORDER BY c.last_outbound_at DESC
      LIMIT 20
    `).all();

    // Leads who replied but haven't been followed up on (unread inbound)
    const unreadReplies = db.prepare(`
      SELECT
        l.id, l.first_name, l.last_name, l.email, l.phone, l.status,
        c.unread_count, c.last_inbound_at, c.last_message_preview,
        c.message_count, c.inbound_count
      FROM leads l
      JOIN mm_conversations c ON c.contact_id = l.mm_id
      WHERE c.unread_count > 0 AND c.has_replied = 1
      ORDER BY c.last_inbound_at DESC
      LIMIT 20
    `).all();

    // Workflow performance (which automated workflows get replies?)
    const workflowStats = db.prepare(`
      SELECT
        workflow_name,
        COUNT(*) as messages_sent,
        COUNT(DISTINCT thread_id) as contacts_reached
      FROM mm_messages
      WHERE workflow_name IS NOT NULL
      GROUP BY workflow_name
      ORDER BY messages_sent DESC
    `).all();

    // Students with MM conversations (engagement overlay)
    const studentEngagement = db.prepare(`
      SELECT
        s.id, s.first_name, s.last_name, s.belt_rank, s.membership_status,
        s.mm_message_count, s.mm_has_replied, s.mm_last_contact_at,
        c.last_message_preview
      FROM students s
      JOIN mm_conversations c ON c.contact_id = s.mm_id
      WHERE s.mm_id IS NOT NULL AND c.message_count > 0
      ORDER BY c.last_message_at DESC
      LIMIT 20
    `).all();

    return NextResponse.json({
      overview: convStats,
      recentConversations,
      actionable: {
        noReplyLeads,
        unreadReplies,
      },
      workflowStats,
      studentEngagement,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
