import { apiHandler } from "@/lib/api-handler";
import { getDashboardStats, getRecentClasses } from "@/lib/queries";
import { ensureZivvySchema, ensureContactSchema, ensureMMSchema } from "@/lib/db";
import { getNeedsAttention } from "@/lib/contacts/queries";
import { getDb } from "@/lib/db";

export const GET = apiHandler(() => {
  ensureZivvySchema();
  ensureContactSchema();
  ensureMMSchema();
  const db = getDb();

  const stats = getDashboardStats();
  const attention = getNeedsAttention();
  const todayClasses = getRecentClasses(5);

  // New leads in last 7 days needing follow-up
  const newLeads = db.prepare(`
    SELECT l.id, l.first_name, l.last_name, l.source, l.interest, l.created_at, l.phone
    FROM leads l
    WHERE l.status IN ('new', 'contacted')
      AND l.created_at >= date('now', '-7 days')
      AND l.zivvy_id IS NOT NULL
    ORDER BY l.created_at DESC
    LIMIT 10
  `).all();

  // Content pieces awaiting approval
  const pendingContent = db.prepare(`
    SELECT id, content_type, body, created_at
    FROM content_pieces
    WHERE status IN ('draft', 'revision')
    ORDER BY updated_at DESC
    LIMIT 5
  `).all();

  // Win-back suggestions pending action
  const pendingWinback = db.prepare(`
    SELECT ws.id, ws.body, ws.message_type, ws.tone, ws.created_at,
      c.first_name, c.last_name, c.phone
    FROM winback_suggestions ws
    JOIN contacts c ON c.id = ws.contact_id
    WHERE ws.status IN ('suggested', 'approved')
    ORDER BY ws.created_at DESC
    LIMIT 5
  `).all();

  // Unread conversations
  const unreadConversations = db.prepare(`
    SELECT mc.contact_id, mc.contact_name, mc.unread_count,
      mc.last_message_at, mc.last_message_preview
    FROM mm_conversations mc
    WHERE mc.unread_count > 0
    ORDER BY mc.last_message_at DESC
    LIMIT 10
  `).all();

  // Pending access requests
  const pendingAccessRequests = db.prepare(`
    SELECT id, name, email, phone, message, created_at
    FROM access_requests
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `).all();

  return {
    stats,
    attention,
    todayClasses,
    newLeads,
    pendingContent,
    pendingWinback,
    unreadConversations,
    pendingAccessRequests,
  };
}, { minRole: "manager" });
