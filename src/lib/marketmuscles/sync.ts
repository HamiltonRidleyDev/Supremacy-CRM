import { getDb } from "../db";
import { fetchAllContacts, fetchAllConversations, fetchThreadMessages } from "./client";
import { mapToLead, normalizeEmail, normalizePhone, tagsToMotivations } from "./mapper";
import type { MMSyncResult, CRMMessage, CRMConversationThread } from "./types";

/**
 * Run a full sync from Market Muscles → local SQLite.
 *
 * Phase 1: Contacts (Typesense API — fast bulk)
 *   - Upsert mm_contacts raw mirror
 *   - Match to existing students/leads by email/phone
 *   - Create new leads for unmatched
 *   - Enrich student_profiles
 *
 * Phase 2: Conversations (CRM API — rich detail)
 *   - Fetch all conversation threads
 *   - Fetch messages for each thread
 *   - Compute engagement metrics (response rate, timing, etc.)
 *   - Link engagement data back to students/leads
 */
export async function runMMSync(): Promise<MMSyncResult> {
  const start = Date.now();
  const db = getDb();

  const logInsert = db.prepare(
    `INSERT INTO mm_sync_log (started_at, status) VALUES (datetime('now'), 'running')`
  );
  const logResult = logInsert.run();
  const syncLogId = logResult.lastInsertRowid;

  try {
    // ─── Phase 1: Contacts ────────────────────────────────────────

    const contacts = await fetchAllContacts();
    const validContacts = contacts.filter((c) => !c.is_spam);

    const existingStudents = db.prepare(
      `SELECT id, email, phone, mm_id FROM students`
    ).all() as Array<{ id: number; email: string | null; phone: string | null; mm_id: string | null }>;

    const existingLeads = db.prepare(
      `SELECT id, email, phone, mm_id FROM leads`
    ).all() as Array<{ id: number; email: string | null; phone: string | null; mm_id: string | null }>;

    const studentsByEmail = new Map<string, number>();
    const studentsByPhone = new Map<string, number>();
    const studentsByMmId = new Map<string, number>();
    for (const s of existingStudents) {
      const ne = normalizeEmail(s.email);
      const np = normalizePhone(s.phone);
      if (ne) studentsByEmail.set(ne, s.id);
      if (np) studentsByPhone.set(np, s.id);
      if (s.mm_id) studentsByMmId.set(s.mm_id, s.id);
    }

    const leadsByEmail = new Map<string, number>();
    const leadsByPhone = new Map<string, number>();
    const leadsByMmId = new Map<string, number>();
    for (const l of existingLeads) {
      const ne = normalizeEmail(l.email);
      const np = normalizePhone(l.phone);
      if (ne) leadsByEmail.set(ne, l.id);
      if (np) leadsByPhone.set(np, l.id);
      if (l.mm_id) leadsByMmId.set(l.mm_id, l.id);
    }

    // Prepare contact statements
    const upsertRaw = db.prepare(`
      INSERT INTO mm_contacts (id, first_name, last_name, full_name, email, phone,
        type, status, source, tags, referrer_medium, referrer_source, referrer_domain,
        optin_email, optin_sms, is_spam, crm_url, created_at_ts, created_at_iso,
        raw_json, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        first_name=excluded.first_name, last_name=excluded.last_name, full_name=excluded.full_name,
        email=excluded.email, phone=excluded.phone, type=excluded.type, status=excluded.status,
        source=excluded.source, tags=excluded.tags, referrer_medium=excluded.referrer_medium,
        referrer_source=excluded.referrer_source, referrer_domain=excluded.referrer_domain,
        optin_email=excluded.optin_email, optin_sms=excluded.optin_sms, is_spam=excluded.is_spam,
        crm_url=excluded.crm_url, raw_json=excluded.raw_json, synced_at=datetime('now')
    `);

    const linkStudentMmId = db.prepare(`UPDATE students SET mm_id = ? WHERE id = ?`);
    const linkLeadMmId = db.prepare(`UPDATE leads SET mm_id = ? WHERE id = ?`);

    const insertLead = db.prepare(`
      INSERT INTO leads (mm_id, first_name, last_name, email, phone, source, interest,
        status, notes, created_at, updated_at)
      VALUES (@mm_id, @first_name, @last_name, @email, @phone, @source, @interest,
        @status, @notes, datetime('now'), datetime('now'))
    `);

    const updateLeadMM = db.prepare(`
      UPDATE leads SET
        mm_id = ?,
        notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || char(10) || ? END,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const upsertProfile = db.prepare(`
      INSERT INTO student_profiles (student_id, lead_id, opt_in_marketing, motivation, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(student_id) DO UPDATE SET
        opt_in_marketing = CASE WHEN excluded.opt_in_marketing IS NOT NULL THEN excluded.opt_in_marketing ELSE opt_in_marketing END,
        motivation = CASE WHEN excluded.motivation IS NOT NULL AND excluded.motivation != '' THEN excluded.motivation ELSE motivation END,
        updated_at = datetime('now')
    `);

    const upsertProfileLead = db.prepare(`
      INSERT INTO student_profiles (student_id, lead_id, opt_in_marketing, motivation, updated_at)
      VALUES (NULL, ?, ?, ?, datetime('now'))
      ON CONFLICT(lead_id) DO UPDATE SET
        opt_in_marketing = CASE WHEN excluded.opt_in_marketing IS NOT NULL THEN excluded.opt_in_marketing ELSE opt_in_marketing END,
        motivation = CASE WHEN excluded.motivation IS NOT NULL AND excluded.motivation != '' THEN excluded.motivation ELSE motivation END,
        updated_at = datetime('now')
    `);

    let leadsCreated = 0;
    let leadsUpdated = 0;
    let matchedExisting = 0;

    const contactTransaction = db.transaction(() => {
      for (const c of validContacts) {
        upsertRaw.run(
          c.id, c.first_name || "", c.last_name || "", c.full_name || "",
          c.email_address, c.phone_number, c.type, c.status, c.source,
          JSON.stringify(c.tags || []),
          c.referrer?.medium || null, c.referrer?.source || null, c.referrer?.source_domain || null,
          c.optin_email ? 1 : 0, c.optin_sms ? 1 : 0, c.is_spam ? 1 : 0,
          c.url, c.created_at, c.created_at_iso, JSON.stringify(c)
        );

        const ne = normalizeEmail(c.email_address);
        const np = normalizePhone(c.phone_number);

        let matchedStudentId = studentsByMmId.get(c.id) || null;
        if (!matchedStudentId && ne) matchedStudentId = studentsByEmail.get(ne) || null;
        if (!matchedStudentId && np) matchedStudentId = studentsByPhone.get(np) || null;

        if (matchedStudentId) {
          linkStudentMmId.run(c.id, matchedStudentId);
          matchedExisting++;
          const motivations = tagsToMotivations(c.tags);
          const optIn = c.optin_email || c.optin_sms ? 1 : 0;
          upsertProfile.run(matchedStudentId, null, optIn, motivations.length ? motivations.join(", ") : null);
          continue;
        }

        let matchedLeadId = leadsByMmId.get(c.id) || null;
        if (!matchedLeadId && ne) matchedLeadId = leadsByEmail.get(ne) || null;
        if (!matchedLeadId && np) matchedLeadId = leadsByPhone.get(np) || null;

        if (matchedLeadId) {
          const tagNote = c.tags?.length ? `MM tags: ${c.tags.join(", ")}` : "";
          updateLeadMM.run(c.id, tagNote, tagNote, matchedLeadId);
          leadsUpdated++;
          const motivations = tagsToMotivations(c.tags);
          const optIn = c.optin_email || c.optin_sms ? 1 : 0;
          upsertProfileLead.run(matchedLeadId, optIn, motivations.length ? motivations.join(", ") : null);
          continue;
        }

        const mapped = mapToLead(c);
        const result = insertLead.run(mapped);
        const newLeadId = result.lastInsertRowid as number;
        leadsCreated++;
        if (ne) leadsByEmail.set(ne, newLeadId);
        if (np) leadsByPhone.set(np, newLeadId);
        leadsByMmId.set(c.id, newLeadId);

        const motivations = tagsToMotivations(c.tags);
        const optIn = c.optin_email || c.optin_sms ? 1 : 0;
        if (motivations.length || optIn) {
          upsertProfileLead.run(newLeadId, optIn, motivations.length ? motivations.join(", ") : null);
        }
      }
    });

    contactTransaction();

    // ─── Phase 2: Conversations ───────────────────────────────────
    // NOTE: The CRM API (crm.marketmuscles.com) was disabled by Market Muscles
    // in March 2026. Conversation sync is attempted but gracefully skipped if
    // the API returns 403 "api_disabled". Existing conversation data in SQLite
    // is preserved as historical data.

    let conversationsSynced = 0;
    let messagesSynced = 0;
    let conversationSyncSkipped = false;

    let threads: CRMConversationThread[];
    try {
      threads = await fetchAllConversations();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("403") || errMsg.includes("api_disabled") || errMsg.includes("API access disabled")) {
        console.warn("CRM API disabled — skipping conversation sync. Contact data synced successfully.");
        conversationSyncSkipped = true;
        threads = [];
      } else {
        throw err; // re-throw non-api-disabled errors
      }
    }

    const upsertConversation = db.prepare(`
      INSERT INTO mm_conversations (thread_id, contact_id, contact_name, message_count,
        inbound_count, outbound_count, unread_count, is_archived,
        first_message_at, last_message_at, last_message_direction, last_message_preview,
        last_inbound_at, last_outbound_at, response_time_avg_hrs, has_replied,
        workflow_touches, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(thread_id) DO UPDATE SET
        contact_name=excluded.contact_name, message_count=excluded.message_count,
        inbound_count=excluded.inbound_count, outbound_count=excluded.outbound_count,
        unread_count=excluded.unread_count, is_archived=excluded.is_archived,
        first_message_at=excluded.first_message_at, last_message_at=excluded.last_message_at,
        last_message_direction=excluded.last_message_direction, last_message_preview=excluded.last_message_preview,
        last_inbound_at=excluded.last_inbound_at, last_outbound_at=excluded.last_outbound_at,
        response_time_avg_hrs=excluded.response_time_avg_hrs, has_replied=excluded.has_replied,
        workflow_touches=excluded.workflow_touches, synced_at=datetime('now')
    `);

    const upsertMessage = db.prepare(`
      INSERT INTO mm_messages (id, thread_id, contact_id, sender_id, direction, content,
        source, workflow_id, workflow_name, status, is_review_request, created_at,
        delivered_at, read_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, delivered_at=excluded.delivered_at, read_at=excluded.read_at
    `);

    const updateLeadEngagement = db.prepare(`
      UPDATE leads SET
        mm_thread_id = ?, mm_last_contact_at = ?, mm_last_direction = ?,
        mm_message_count = ?, mm_has_replied = ?, mm_unread_count = ?,
        updated_at = datetime('now')
      WHERE mm_id = ?
    `);

    const updateStudentEngagement = db.prepare(`
      UPDATE students SET
        mm_thread_id = ?, mm_last_contact_at = ?, mm_last_direction = ?,
        mm_message_count = ?, mm_has_replied = ?, mm_unread_count = ?
      WHERE mm_id = ?
    `);

    // Fetch messages for each thread (5 at a time)
    for (let i = 0; i < threads.length; i += 5) {
      const batch = threads.slice(i, i + 5);
      const messageResults = await Promise.all(
        batch.map(async (thread) => {
          try {
            const messages = await fetchThreadMessages(thread.roomId);
            return { thread, messages };
          } catch {
            return { thread, messages: [] as CRMMessage[] };
          }
        })
      );

      const batchTransaction = db.transaction(() => {
        for (const { thread, messages } of messageResults) {
          const contactId = thread.contact._id;

          // Compute metrics from chat-room format messages
          const metrics = computeConversationMetrics(messages, contactId);

          upsertConversation.run(
            thread.roomId, contactId, thread.roomName,
            messages.length, metrics.inboundCount, metrics.outboundCount,
            thread.unreadCount, thread.metadata.is_archived ? 1 : 0,
            metrics.firstMessageAt, metrics.lastMessageAt,
            metrics.lastMessageDirection, metrics.lastMessagePreview,
            metrics.lastInboundAt, metrics.lastOutboundAt,
            metrics.avgResponseTimeHrs, metrics.hasReplied ? 1 : 0,
            metrics.workflowTouches
          );
          conversationsSynced++;

          // Upsert individual messages
          for (const msg of messages) {
            // Determine direction: senderId == contactId means inbound
            const direction = msg.senderId === contactId ? "inbound" : "outbound";
            const source = msg.metadata?.is_automation ? "workflow" : "direct";

            upsertMessage.run(
              msg._id,
              msg.roomId || thread.roomId,
              contactId,
              msg.senderId || null,
              direction,
              msg.content || null,
              source,
              msg.metadata?.sourceable?.id || null,
              msg.metadata?.sourceable?.name || null,
              msg.seen ? "read" : msg.failure ? "failed" : "delivered",
              msg.metadata?.is_review_request ? 1 : 0,
              msg.timestamp || msg.date || "",
              null, // delivered_at not in chat format
              msg.seen ? msg.timestamp : null
            );
            messagesSynced++;
          }

          // Link engagement to leads/students
          updateLeadEngagement.run(
            thread.roomId, metrics.lastMessageAt, metrics.lastMessageDirection,
            messages.length, metrics.hasReplied ? 1 : 0, thread.unreadCount,
            contactId
          );
          updateStudentEngagement.run(
            thread.roomId, metrics.lastMessageAt, metrics.lastMessageDirection,
            messages.length, metrics.hasReplied ? 1 : 0, thread.unreadCount,
            contactId
          );
        }
      });

      batchTransaction();
    }

    const result: MMSyncResult = {
      status: "success",
      contacts_synced: validContacts.length,
      leads_created: leadsCreated,
      leads_updated: leadsUpdated,
      matched_existing: matchedExisting,
      conversations_synced: conversationsSynced,
      messages_synced: messagesSynced,
      duration_ms: Date.now() - start,
      ...(conversationSyncSkipped && {
        warning: "CRM API disabled by Market Muscles — conversation sync skipped. Existing conversation data preserved as historical.",
      }),
    };

    db.prepare(`
      UPDATE mm_sync_log SET
        completed_at = datetime('now'), status = 'success',
        contacts_synced = ?, leads_created = ?, leads_updated = ?,
        matched_existing = ?, conversations_synced = ?, messages_synced = ?
      WHERE id = ?
    `).run(
      result.contacts_synced, result.leads_created, result.leads_updated,
      result.matched_existing, result.conversations_synced, result.messages_synced,
      syncLogId
    );

    // Refresh contact graph after sync
    try {
      const { ensureContactSchema } = require("../db");
      ensureContactSchema();
      const { populateContacts } = require("../contacts/populate");
      populateContacts(db);
    } catch (_) { /* contact schema not yet initialized — skip */ }

    return result;

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.prepare(`
      UPDATE mm_sync_log SET completed_at = datetime('now'), status = 'error', error_message = ?
      WHERE id = ?
    `).run(errorMsg, syncLogId);

    return {
      status: "error",
      contacts_synced: 0, leads_created: 0, leads_updated: 0,
      matched_existing: 0, conversations_synced: 0, messages_synced: 0,
      duration_ms: Date.now() - start,
      error: errorMsg,
    };
  }
}

// ─── Conversation Metrics ─────────────────────────────────────────

interface ConversationMetrics {
  inboundCount: number;
  outboundCount: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  lastMessageDirection: string | null;
  lastMessagePreview: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  avgResponseTimeHrs: number | null;
  hasReplied: boolean;
  workflowTouches: number;
}

/**
 * Compute engagement metrics from chat-room format messages.
 * Direction is inferred: senderId === contactId means inbound.
 */
function computeConversationMetrics(messages: CRMMessage[], contactId: string): ConversationMetrics {
  if (messages.length === 0) {
    return {
      inboundCount: 0, outboundCount: 0,
      firstMessageAt: null, lastMessageAt: null,
      lastMessageDirection: null, lastMessagePreview: null,
      lastInboundAt: null, lastOutboundAt: null,
      avgResponseTimeHrs: null, hasReplied: false, workflowTouches: 0,
    };
  }

  // Messages come sorted from API (newest first typically), normalize by timestamp
  // The timestamp format is "3/10/26 10:59 AM" — parse to sort
  const withDirection = messages.map((m) => ({
    ...m,
    direction: m.senderId === contactId ? "inbound" as const : "outbound" as const,
    parsedTime: parseMMTimestamp(m.timestamp || m.date),
  }));

  // Sort chronologically
  withDirection.sort((a, b) => (a.parsedTime || 0) - (b.parsedTime || 0));

  const inbound = withDirection.filter((m) => m.direction === "inbound");
  const outbound = withDirection.filter((m) => m.direction === "outbound");
  const workflows = withDirection.filter((m) => m.metadata?.is_automation);
  const first = withDirection[0];
  const last = withDirection[withDirection.length - 1];

  // Avg response time: for each outbound, find next inbound
  const responseTimes: number[] = [];
  for (const ob of outbound) {
    if (!ob.parsedTime) continue;
    const nextInbound = inbound.find(
      (ib) => ib.parsedTime && ib.parsedTime > ob.parsedTime!
    );
    if (nextInbound?.parsedTime) {
      const hrs = (nextInbound.parsedTime - ob.parsedTime) / (1000 * 60 * 60);
      if (hrs < 168) responseTimes.push(hrs); // cap at 7 days
    }
  }

  return {
    inboundCount: inbound.length,
    outboundCount: outbound.length,
    firstMessageAt: first.timestamp || first.date || null,
    lastMessageAt: last.timestamp || last.date || null,
    lastMessageDirection: last.direction,
    lastMessagePreview: (last.content || "").slice(0, 200),
    lastInboundAt: inbound.length > 0 ? (inbound[inbound.length - 1].timestamp || inbound[inbound.length - 1].date) : null,
    lastOutboundAt: outbound.length > 0 ? (outbound[outbound.length - 1].timestamp || outbound[outbound.length - 1].date) : null,
    avgResponseTimeHrs: responseTimes.length > 0
      ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
      : null,
    hasReplied: inbound.length > 0,
    workflowTouches: workflows.length,
  };
}

/**
 * Parse MM timestamp format "3/10/26 10:59 AM" to epoch ms.
 * Falls back to null if unparseable.
 */
function parseMMTimestamp(ts: string | null): number | null {
  if (!ts) return null;
  try {
    // Try ISO format first (some messages use ISO)
    const isoDate = new Date(ts);
    if (!isNaN(isoDate.getTime())) return isoDate.getTime();

    // MM format: "M/D/YY H:MM AM/PM"
    const match = ts.match(/^(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)\s*(AM|PM)?$/i);
    if (match) {
      const [, month, day, year, hours, minutes, ampm] = match;
      let h = parseInt(hours, 10);
      if (ampm?.toUpperCase() === "PM" && h < 12) h += 12;
      if (ampm?.toUpperCase() === "AM" && h === 12) h = 0;
      const fullYear = parseInt(year, 10) + 2000;
      return new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10), h, parseInt(minutes, 10)).getTime();
    }

    return null;
  } catch {
    return null;
  }
}

/** Get the last MM sync log entry */
export function getLastMMSync(): MMSyncResult & {
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
} | null {
  const db = getDb();
  return db.prepare(
    `SELECT status, started_at, completed_at, contacts_synced, leads_created,
            leads_updated, matched_existing, conversations_synced, messages_synced,
            error_message
     FROM mm_sync_log ORDER BY id DESC LIMIT 1`
  ).get() as ReturnType<typeof getLastMMSync>;
}
