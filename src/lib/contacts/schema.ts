import type Database from "better-sqlite3";

export function migrateContactSchema(db: Database.Database) {
  db.exec(`
    -- One row per real-world person (student, lead, parent, prospect)
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,

      -- Cross-system links (at most one each)
      student_id INTEGER UNIQUE REFERENCES students(id),
      lead_id INTEGER UNIQUE REFERENCES leads(id),
      zivvy_id TEXT UNIQUE,
      mm_id TEXT UNIQUE,

      -- Resolved type
      contact_type TEXT NOT NULL DEFAULT 'lead_only',

      -- Engagement scoring
      engagement_score REAL,
      score_attendance REAL,
      score_communication REAL,
      score_progression REAL,
      score_community REAL,
      score_financial REAL,
      risk_level TEXT,
      risk_factors TEXT,            -- JSON array of risk signal strings
      monthly_revenue REAL,
      scored_at TEXT,

      -- Metadata
      source TEXT,
      age_group TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_student ON contacts(student_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_lead ON contacts(lead_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_zivvy ON contacts(zivvy_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_mm ON contacts(mm_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(contact_type);
    CREATE INDEX IF NOT EXISTS idx_contacts_risk ON contacts(risk_level, engagement_score);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

    -- Household relationships (parent-child, sibling, spouse)
    CREATE TABLE IF NOT EXISTS household_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_contact_id INTEGER NOT NULL REFERENCES contacts(id),
      child_contact_id INTEGER NOT NULL REFERENCES contacts(id),
      relationship TEXT NOT NULL DEFAULT 'parent_child',
      confidence TEXT NOT NULL DEFAULT 'inferred',
      detected_by TEXT,
      parent_is_student INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(parent_contact_id, child_contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_household_parent ON household_links(parent_contact_id);
    CREATE INDEX IF NOT EXISTS idx_household_child ON household_links(child_contact_id);
  `);

  // Safe migration: add parent_is_student column to household_links if missing
  const hlCols = db.pragma("table_info(household_links)") as Array<{ name: string }>;
  if (!hlCols.some((col) => col.name === "parent_is_student")) {
    db.exec("ALTER TABLE household_links ADD COLUMN parent_is_student INTEGER NOT NULL DEFAULT 0");
  }

  db.exec(`

    -- Win-back message suggestions (AI-generated, human-reviewed)
    CREATE TABLE IF NOT EXISTS winback_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL REFERENCES contacts(id),
      message_type TEXT NOT NULL DEFAULT 'sms',
      tone TEXT NOT NULL DEFAULT 'warm',
      body TEXT NOT NULL,
      context_summary TEXT,
      status TEXT NOT NULL DEFAULT 'suggested',
      approved_by TEXT,
      sent_at TEXT,
      dismissed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_winback_contact ON winback_suggestions(contact_id);
    CREATE INDEX IF NOT EXISTS idx_winback_status ON winback_suggestions(status, created_at);
  `);
}
