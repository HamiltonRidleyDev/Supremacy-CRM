import type Database from "better-sqlite3";

/**
 * Run Market Muscles sync schema migrations.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
export function migrateMMSchema(db: Database.Database) {
  db.exec(`
    -- ─── Raw contact mirror (from Typesense bulk sync) ──────────────
    CREATE TABLE IF NOT EXISTS mm_contacts (
      id TEXT PRIMARY KEY,                    -- "con_xxx" format from GHL
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      type TEXT,                              -- Lead, Contact
      status TEXT,                            -- New, etc.
      source TEXT,                            -- Website, etc.
      tags TEXT,                              -- JSON array of tag strings
      referrer_medium TEXT,                   -- Organic, Paid, etc.
      referrer_source TEXT,                   -- supremacybjj.com, google, etc.
      referrer_domain TEXT,
      optin_email INTEGER DEFAULT 0,
      optin_sms INTEGER DEFAULT 0,
      is_spam INTEGER DEFAULT 0,
      crm_url TEXT,
      created_at_ts INTEGER,                  -- Unix timestamp from API
      created_at_iso TEXT,
      raw_json TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Conversation threads ───────────────────────────────────────
    -- One row per SMS/chat thread between gym and a contact
    CREATE TABLE IF NOT EXISTS mm_conversations (
      thread_id TEXT PRIMARY KEY,             -- "thread_xxx" from CRM
      contact_id TEXT NOT NULL,               -- "con_xxx" references mm_contacts(id)
      contact_name TEXT,
      message_count INTEGER DEFAULT 0,
      inbound_count INTEGER DEFAULT 0,        -- messages FROM the contact
      outbound_count INTEGER DEFAULT 0,       -- messages TO the contact
      unread_count INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      first_message_at TEXT,
      last_message_at TEXT,
      last_message_direction TEXT,             -- inbound or outbound
      last_message_preview TEXT,               -- truncated last message
      last_inbound_at TEXT,                    -- when contact last replied
      last_outbound_at TEXT,                   -- when we last reached out
      response_time_avg_hrs REAL,             -- avg hours between outbound → inbound reply
      has_replied INTEGER DEFAULT 0,          -- did the contact ever reply?
      workflow_touches INTEGER DEFAULT 0,     -- how many messages came from workflows
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Individual messages ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS mm_messages (
      id TEXT PRIMARY KEY,                    -- "sms_xxx" from CRM
      thread_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      sender_id TEXT,                         -- who sent: contact ID or location ID
      direction TEXT NOT NULL,                -- inbound, outbound
      content TEXT,
      source TEXT,                            -- direct, workflow, chatbot
      workflow_id TEXT,                        -- if sent by a workflow
      workflow_name TEXT,
      status TEXT,                            -- received, delivered, read, failed, queued
      is_review_request INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      delivered_at TEXT,
      read_at TEXT
    );

    -- ─── Sync log ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS mm_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      contacts_synced INTEGER DEFAULT 0,
      leads_created INTEGER DEFAULT 0,
      leads_updated INTEGER DEFAULT 0,
      matched_existing INTEGER DEFAULT 0,
      conversations_synced INTEGER DEFAULT 0,
      messages_synced INTEGER DEFAULT 0,
      error_message TEXT
    );

    -- ─── Indexes ────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_mm_contacts_email ON mm_contacts(email);
    CREATE INDEX IF NOT EXISTS idx_mm_contacts_phone ON mm_contacts(phone);
    CREATE INDEX IF NOT EXISTS idx_mm_contacts_source ON mm_contacts(source);
    CREATE INDEX IF NOT EXISTS idx_mm_sync_log_status ON mm_sync_log(status, started_at);

    CREATE INDEX IF NOT EXISTS idx_mm_conversations_contact ON mm_conversations(contact_id);
    CREATE INDEX IF NOT EXISTS idx_mm_conversations_last_msg ON mm_conversations(last_message_at);
    CREATE INDEX IF NOT EXISTS idx_mm_conversations_last_inbound ON mm_conversations(last_inbound_at);
    CREATE INDEX IF NOT EXISTS idx_mm_conversations_replied ON mm_conversations(has_replied);

    CREATE INDEX IF NOT EXISTS idx_mm_messages_thread ON mm_messages(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_mm_messages_contact ON mm_messages(contact_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_mm_messages_direction ON mm_messages(direction, created_at);
    CREATE INDEX IF NOT EXISTS idx_mm_messages_workflow ON mm_messages(workflow_id);
  `);

  // Add mm_id to leads and students for cross-reference
  const leadsColumns = db.pragma("table_info(leads)") as Array<{ name: string }>;
  if (!leadsColumns.some((col) => col.name === "mm_id")) {
    db.exec(`ALTER TABLE leads ADD COLUMN mm_id TEXT`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_mm_id ON leads(mm_id)`);

  const studentsColumns = db.pragma("table_info(students)") as Array<{ name: string }>;
  if (!studentsColumns.some((col) => col.name === "mm_id")) {
    db.exec(`ALTER TABLE students ADD COLUMN mm_id TEXT`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_students_mm_id ON students(mm_id)`);

  // Add conversations_synced and messages_synced to mm_sync_log if missing
  const syncLogColumns = db.pragma("table_info(mm_sync_log)") as Array<{ name: string }>;
  if (!syncLogColumns.some((col) => col.name === "conversations_synced")) {
    db.exec(`ALTER TABLE mm_sync_log ADD COLUMN conversations_synced INTEGER DEFAULT 0`);
    db.exec(`ALTER TABLE mm_sync_log ADD COLUMN messages_synced INTEGER DEFAULT 0`);
  }

  // Add last_contact_at and engagement columns to leads for quick access
  const addLeadColumnIfMissing = (name: string, type: string) => {
    if (!leadsColumns.some((col) => col.name === name)) {
      db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${type}`);
    }
  };
  addLeadColumnIfMissing("mm_thread_id", "TEXT");
  addLeadColumnIfMissing("mm_last_contact_at", "TEXT");
  addLeadColumnIfMissing("mm_last_direction", "TEXT");       // last message direction
  addLeadColumnIfMissing("mm_message_count", "INTEGER DEFAULT 0");
  addLeadColumnIfMissing("mm_has_replied", "INTEGER DEFAULT 0");
  addLeadColumnIfMissing("mm_unread_count", "INTEGER DEFAULT 0");

  // Same engagement columns for students
  const addStudentColumnIfMissing = (name: string, type: string) => {
    if (!studentsColumns.some((col) => col.name === name)) {
      db.exec(`ALTER TABLE students ADD COLUMN ${name} ${type}`);
    }
  };
  addStudentColumnIfMissing("mm_thread_id", "TEXT");
  addStudentColumnIfMissing("mm_last_contact_at", "TEXT");
  addStudentColumnIfMissing("mm_last_direction", "TEXT");
  addStudentColumnIfMissing("mm_message_count", "INTEGER DEFAULT 0");
  addStudentColumnIfMissing("mm_has_replied", "INTEGER DEFAULT 0");
  addStudentColumnIfMissing("mm_unread_count", "INTEGER DEFAULT 0");
}
