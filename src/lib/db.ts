import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "supremacy.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

let zivvyMigrated = false;
export function ensureZivvySchema() {
  if (zivvyMigrated) return;
  const { migrateZivvySchema } = require("./zivvy/schema");
  migrateZivvySchema(getDb());
  zivvyMigrated = true;
}

let mmMigrated = false;
export function ensureMMSchema() {
  if (mmMigrated) return;
  const { migrateMMSchema } = require("./marketmuscles/schema");
  migrateMMSchema(getDb());
  mmMigrated = true;
}

let contactMigrated = false;
export function ensureContactSchema() {
  if (contactMigrated) return;
  const { migrateContactSchema } = require("./contacts/schema");
  migrateContactSchema(getDb());
  contactMigrated = true;
}

export function initDb() {
  const db = getDb();

  db.exec(`
    -- Users (authentication & RBAC)
    -- Roles: admin, manager, member, guest
    --   admin: Full access (Rodrigo). Manage everything, assign roles, billing, CRM, Mat Planner, schedule control.
    --   manager: Operational access (Kyle, assistant instructors). CRM, attendance, schedule, community moderation. No billing/role management.
    --   member: Paying students or parents paying for children. View schedule, community, own profile/knowledge map.
    --   guest: Non-paying attendees (trial, walk-in, step-up kids). View schedule, limited community. No billing info.
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      phone TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'guest', -- admin, manager, member, guest
      student_id INTEGER REFERENCES students(id),
      contact_id INTEGER REFERENCES contacts(id),
      display_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Magic login codes (6-digit, 10-min expiry, one-time use)
    CREATE TABLE IF NOT EXISTS magic_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Students / Members
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      belt_rank TEXT NOT NULL DEFAULT 'white',
      stripes INTEGER NOT NULL DEFAULT 0,
      membership_type TEXT NOT NULL DEFAULT 'standard',
      membership_status TEXT NOT NULL DEFAULT 'active',
      monthly_rate REAL,
      start_date TEXT NOT NULL,
      last_attendance TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Class types (Adult Gi, Adult No-Gi, Kids, etc.)
    CREATE TABLE IF NOT EXISTS class_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      min_belt TEXT DEFAULT 'white',
      is_gi INTEGER NOT NULL DEFAULT 1
    );

    -- Scheduled classes (recurring schedule template)
    CREATE TABLE IF NOT EXISTS schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_type_id INTEGER NOT NULL REFERENCES class_types(id),
      day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      instructor TEXT NOT NULL DEFAULT 'Rodrigo'
    );

    -- Class instances (actual classes that happened)
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_type_id INTEGER NOT NULL REFERENCES class_types(id),
      lesson_plan_id INTEGER REFERENCES lesson_plans(id),
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      instructor TEXT NOT NULL DEFAULT 'Rodrigo',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Lesson plans (from Mat Planner)
    CREATE TABLE IF NOT EXISTS lesson_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      class_type TEXT,
      position_area TEXT,
      belt_level TEXT,
      warmup TEXT,
      techniques TEXT,
      drilling TEXT,
      sparring TEXT,
      notes TEXT,
      full_plan TEXT NOT NULL,
      source TEXT DEFAULT 'mat-planner',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Techniques / Concepts (the curriculum vocabulary)
    CREATE TABLE IF NOT EXISTS techniques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL, -- guard, passing, takedowns, submissions, escapes, sweeps, back, turtle, top_control
      subcategory TEXT,
      belt_level TEXT DEFAULT 'white',
      is_gi INTEGER DEFAULT 1,
      description TEXT
    );

    -- Which techniques were covered in which lesson plan
    CREATE TABLE IF NOT EXISTS lesson_techniques (
      lesson_plan_id INTEGER NOT NULL REFERENCES lesson_plans(id),
      technique_id INTEGER NOT NULL REFERENCES techniques(id),
      PRIMARY KEY (lesson_plan_id, technique_id)
    );

    -- Attendance records
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      class_id INTEGER NOT NULL REFERENCES classes(id),
      checked_in_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, class_id)
    );

    -- Leads / Prospects (CRM)
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      source TEXT, -- website, referral, walk-in, competitor, social_media
      interest TEXT, -- adult_gi, adult_nogi, kids, etc.
      status TEXT NOT NULL DEFAULT 'new', -- new, contacted, trial_booked, trial_attended, signed_up, lost
      assigned_to TEXT DEFAULT 'Kyle',
      notes TEXT,
      converted_student_id INTEGER REFERENCES students(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_contact TEXT
    );

    -- Follow-up log
    CREATE TABLE IF NOT EXISTS follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      type TEXT NOT NULL, -- email, text, call, in_person
      message TEXT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_by TEXT DEFAULT 'Kyle'
    );

    -- Quick Notes (Rodrigo's voice memos / ideas)
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL DEFAULT 'Rodrigo',
      content TEXT NOT NULL,
      transcription TEXT,
      tags TEXT, -- comma-separated: student names, technique areas, etc.
      is_used INTEGER NOT NULL DEFAULT 0,
      used_in_plan_id INTEGER REFERENCES lesson_plans(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Community Channels
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'public', -- public, announcement, private, dm
      auto_join_filter TEXT, -- JSON: belt level, membership type, etc.
      created_by TEXT DEFAULT 'Rodrigo',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Channel membership
    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id INTEGER NOT NULL REFERENCES channels(id),
      student_id INTEGER NOT NULL REFERENCES students(id),
      role TEXT NOT NULL DEFAULT 'member', -- member, admin
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_read_at TEXT,
      PRIMARY KEY (channel_id, student_id)
    );

    -- Messages
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL REFERENCES channels(id),
      author_id INTEGER NOT NULL REFERENCES students(id),
      content TEXT NOT NULL,
      parent_id INTEGER REFERENCES messages(id),
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Chat sessions (Mat Planner & Dashboard conversations with Claude)
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL DEFAULT 'Rodrigo',
      source TEXT NOT NULL DEFAULT 'planner', -- planner, dashboard
      location_lat REAL,
      location_lng REAL,
      location_label TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      summary TEXT
    );

    -- Chat messages (individual messages within a session)
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES chat_sessions(id),
      role TEXT NOT NULL, -- user, assistant
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Instructor insights (learned personality, style, stories, values)
    -- Categories: voice, values, stories, teaching_philosophy, business_mindset, personality, marketing_angles
    CREATE TABLE IF NOT EXISTS instructor_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'observed', -- observed, confirmed, strong
      source_session_id INTEGER REFERENCES chat_sessions(id),
      source_quote TEXT, -- the original thing they said that triggered this insight
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Content pieces (persistent drafts with approval workflow)
    -- Status flow: draft → revision → approved → published → archived
    CREATE TABLE IF NOT EXISTS content_pieces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_type TEXT NOT NULL, -- social_post, google_business, blog_snippet, lead_email, website_copy, competitor_capture
      status TEXT NOT NULL DEFAULT 'draft', -- draft, revision, approved, published, archived
      body TEXT NOT NULL, -- the current content text
      image_prompt TEXT, -- AI-generated image description for visual pairing
      source_type TEXT, -- topic, lesson, profile, custom
      source_text TEXT, -- what was used to generate it
      revision_notes TEXT, -- what Rodrigo wants changed (conversational)
      revision_count INTEGER NOT NULL DEFAULT 0,
      scheduled_for TEXT, -- optional publish date
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Content revision history (every version is kept)
    CREATE TABLE IF NOT EXISTS content_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_piece_id INTEGER NOT NULL REFERENCES content_pieces(id),
      version INTEGER NOT NULL,
      body TEXT NOT NULL,
      image_prompt TEXT,
      revision_notes TEXT, -- what triggered this revision
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Survey templates (configurable forms for data collection)
    CREATE TABLE IF NOT EXISTS survey_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      target_type TEXT NOT NULL DEFAULT 'student', -- student, lead, any
      questions TEXT NOT NULL, -- JSON array of question definitions
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT DEFAULT 'Rodrigo',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Individual survey sends (one per student/lead per template)
    CREATE TABLE IF NOT EXISTS survey_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES survey_templates(id),
      token TEXT NOT NULL UNIQUE,
      student_id INTEGER REFERENCES students(id),
      lead_id INTEGER REFERENCES leads(id),
      recipient_name TEXT NOT NULL,
      recipient_email TEXT,
      recipient_phone TEXT,
      status TEXT NOT NULL DEFAULT 'sent', -- sent, opened, completed, expired
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_via TEXT, -- sms, email, manual
      opened_at TEXT,
      completed_at TEXT,
      expires_at TEXT
    );

    -- Individual question answers
    CREATE TABLE IF NOT EXISTS survey_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      send_id INTEGER NOT NULL REFERENCES survey_sends(id),
      question_key TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(send_id, question_key)
    );

    -- Enrichment profile (aggregated from survey answers, one row per student/lead)
    CREATE TABLE IF NOT EXISTS student_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER UNIQUE REFERENCES students(id),
      lead_id INTEGER UNIQUE REFERENCES leads(id),
      preferred_contact TEXT,
      best_time_to_reach TEXT,
      instagram_handle TEXT,
      facebook_name TEXT,
      motivation TEXT,
      prior_training TEXT,
      prior_gym TEXT,
      goals TEXT,
      how_heard TEXT,
      referral_name TEXT,
      occupation TEXT,
      schedule_preference TEXT,
      training_frequency_target TEXT,
      injuries_concerns TEXT,
      gi_or_nogi TEXT,
      household_members TEXT,
      quit_reason TEXT,
      willing_to_return TEXT,
      return_conditions TEXT,
      opt_in_marketing INTEGER DEFAULT 1,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Access requests (when login email/phone doesn't match a contact)
    CREATE TABLE IF NOT EXISTS access_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      resolved_by TEXT,
      resolved_note TEXT,
      linked_contact_id INTEGER REFERENCES contacts(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    -- Feedback from beta testers (Rodrigo, Kyle, etc.)
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page TEXT NOT NULL,
      tab TEXT,
      user_name TEXT,
      user_role TEXT,
      feedback_type TEXT NOT NULL DEFAULT 'general',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      admin_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id);
    CREATE INDEX IF NOT EXISTS idx_classes_date ON classes(date);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(membership_status);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_lesson_techniques_technique ON lesson_techniques(technique_id);
    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_channel_members_student ON channel_members(student_id);
    CREATE INDEX IF NOT EXISTS idx_notes_author ON notes(author, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_instructor_insights_category ON instructor_insights(category, is_active);
    CREATE INDEX IF NOT EXISTS idx_content_pieces_status ON content_pieces(status, content_type);
    CREATE INDEX IF NOT EXISTS idx_content_revisions_piece ON content_revisions(content_piece_id, version);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_student ON users(student_id);
    -- Pinned items from Quick chat (voice "save that" or tap pin)
    CREATE TABLE IF NOT EXISTS pinned_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES chat_sessions(id),
      user_message TEXT NOT NULL,
      assistant_message TEXT NOT NULL,
      context_summary TEXT,
      pinned_by TEXT NOT NULL DEFAULT 'Rodrigo',
      status TEXT NOT NULL DEFAULT 'active', -- active, dismissed, done
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pinned_items_status ON pinned_items(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_source ON chat_sessions(source);
    CREATE INDEX IF NOT EXISTS idx_survey_sends_token ON survey_sends(token);
    CREATE INDEX IF NOT EXISTS idx_survey_sends_template ON survey_sends(template_id, status);
    CREATE INDEX IF NOT EXISTS idx_survey_sends_student ON survey_sends(student_id);
    CREATE INDEX IF NOT EXISTS idx_survey_sends_lead ON survey_sends(lead_id);
    CREATE INDEX IF NOT EXISTS idx_survey_responses_send ON survey_responses(send_id);
    CREATE INDEX IF NOT EXISTS idx_student_profiles_student ON student_profiles(student_id);
    CREATE INDEX IF NOT EXISTS idx_student_profiles_lead ON student_profiles(lead_id);
  `);

  // Migrate existing chat_sessions table to add new columns
  const sessionCols = db.pragma("table_info(chat_sessions)") as Array<{ name: string }>;
  if (!sessionCols.some((c) => c.name === "source")) {
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN source TEXT NOT NULL DEFAULT 'planner'`);
  }
  if (!sessionCols.some((c) => c.name === "location_lat")) {
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN location_lat REAL`);
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN location_lng REAL`);
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN location_label TEXT`);
  }

  return db;
}
