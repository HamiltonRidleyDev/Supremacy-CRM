import type Database from "better-sqlite3";

/**
 * Run Zivvy sync schema migrations.
 * Safe to call multiple times — uses IF NOT EXISTS / IF NOT COLUMN checks.
 */
export function migrateZivvySchema(db: Database.Database) {
  db.exec(`
    -- Raw mirror of Zivvy contacts (full fidelity, JSON blob for flexibility)
    CREATE TABLE IF NOT EXISTS zivvy_contacts (
      id INTEGER PRIMARY KEY,              -- Zivvy's contact ID (not autoincrement)
      contact_type TEXT NOT NULL,           -- S, P, F, C
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      mobile TEXT,
      age_group TEXT,
      source TEXT,
      current_program TEXT,
      current_rank TEXT,
      tuition_amount REAL,
      billing_method TEXT,
      total_classes_taken INTEGER,
      last_attend TEXT,
      date_contact_added TEXT,
      on_trial INTEGER DEFAULT 0,
      on_vacation INTEGER DEFAULT 0,
      quit_date TEXT,
      prospect_stage TEXT,
      raw_json TEXT NOT NULL,              -- Full API response as JSON for any field we need later
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Sync run log
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',  -- running, success, error
      students_synced INTEGER DEFAULT 0,
      leads_synced INTEGER DEFAULT 0,
      former_synced INTEGER DEFAULT 0,
      total_contacts INTEGER DEFAULT 0,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_zivvy_contacts_type ON zivvy_contacts(contact_type);
    CREATE INDEX IF NOT EXISTS idx_zivvy_contacts_last_attend ON zivvy_contacts(last_attend);
    CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status, started_at);
  `);

  // Individual payment transactions (for LTV + cost/class trending)
  db.exec(`
    CREATE TABLE IF NOT EXISTS zivvy_payments (
      id INTEGER PRIMARY KEY,
      contact_id INTEGER NOT NULL,
      date_processed TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      payment_type TEXT,
      method TEXT,
      payment_status TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_zivvy_payments_contact ON zivvy_payments(contact_id, date_processed);

    CREATE TABLE IF NOT EXISTS zivvy_attendance_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      parsed_date TEXT NOT NULL,
      entry_method TEXT,
      roster_name TEXT,
      style TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(contact_id, parsed_date, roster_name)
    );
    CREATE INDEX IF NOT EXISTS idx_zivvy_attendance_contact ON zivvy_attendance_log(contact_id, parsed_date);
  `);

  // Add zivvy_id column to students if it doesn't exist
  // SQLite can't add UNIQUE columns via ALTER TABLE, so add column then create unique index
  const studentsColumns = db.pragma("table_info(students)") as Array<{ name: string }>;
  if (!studentsColumns.some((col) => col.name === "zivvy_id")) {
    db.exec(`ALTER TABLE students ADD COLUMN zivvy_id INTEGER`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_students_zivvy_id ON students(zivvy_id)`);

  // Add zivvy_id column to leads if it doesn't exist
  const leadsColumns = db.pragma("table_info(leads)") as Array<{ name: string }>;
  if (!leadsColumns.some((col) => col.name === "zivvy_id")) {
    db.exec(`ALTER TABLE leads ADD COLUMN zivvy_id INTEGER`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_zivvy_id ON leads(zivvy_id)`);


  // Add extra fields to students that Zivvy provides but we didn't have
  const addStudentColumnIfMissing = (name: string, type: string) => {
    if (!studentsColumns.some((col) => col.name === name)) {
      db.exec(`ALTER TABLE students ADD COLUMN ${name} ${type}`);
    }
  };

  addStudentColumnIfMissing("age_group", "TEXT");
  addStudentColumnIfMissing("age", "INTEGER");
  addStudentColumnIfMissing("address", "TEXT");
  addStudentColumnIfMissing("city", "TEXT");
  addStudentColumnIfMissing("state", "TEXT");
  addStudentColumnIfMissing("zip", "TEXT");
  addStudentColumnIfMissing("parent_name", "TEXT");
  addStudentColumnIfMissing("parent_phone", "TEXT");
  addStudentColumnIfMissing("source", "TEXT");
  addStudentColumnIfMissing("current_program", "TEXT");
  addStudentColumnIfMissing("total_classes", "INTEGER DEFAULT 0");
  addStudentColumnIfMissing("billing_method", "TEXT");
  addStudentColumnIfMissing("on_vacation", "INTEGER DEFAULT 0");
  addStudentColumnIfMissing("date_added", "TEXT");
  addStudentColumnIfMissing("total_collected", "REAL DEFAULT 0");
}
