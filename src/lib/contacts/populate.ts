import type Database from "better-sqlite3";
import type { PopulateResult } from "./types";

/**
 * Populate the contacts table from existing students and leads.
 * Also detects household relationships.
 *
 * Safe to run multiple times — uses INSERT OR IGNORE / ON CONFLICT.
 */
export function populateContacts(db: Database.Database): PopulateResult {
  const start = Date.now();
  let contactsCreated = 0;
  let leadsLinked = 0;

  const populate = db.transaction(() => {
    // -------------------------------------------------------
    // PASS 0: Fix stale student_id references
    // -------------------------------------------------------
    // Contacts may have student_ids pointing to old seed records while the
    // real Zivvy-synced student rows live at different IDs.  Re-link by
    // matching on zivvy_id which is the canonical cross-system key.
    const fixedIds = db.prepare(`
      UPDATE contacts SET
        student_id = (
          SELECT s.id FROM students s
          WHERE CAST(s.zivvy_id AS TEXT) = contacts.zivvy_id
        ),
        updated_at = datetime('now')
      WHERE contacts.zivvy_id IS NOT NULL AND contacts.zivvy_id != ''
        AND (
          -- student_id is null but a matching student exists
          contacts.student_id IS NULL
          -- OR student_id points to wrong record (zivvy_id mismatch)
          OR NOT EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = contacts.student_id
              AND CAST(s.zivvy_id AS TEXT) = contacts.zivvy_id
          )
        )
        AND EXISTS (
          SELECT 1 FROM students s
          WHERE CAST(s.zivvy_id AS TEXT) = contacts.zivvy_id
        )
    `).run();
    if (fixedIds.changes > 0) {
      console.log(`[populate] Fixed ${fixedIds.changes} stale student_id references`);

      // Refresh name/email/phone/type/age_group from newly-linked students
      db.prepare(`
        UPDATE contacts SET
          first_name = (SELECT s.first_name FROM students s WHERE s.id = contacts.student_id),
          last_name  = (SELECT s.last_name  FROM students s WHERE s.id = contacts.student_id),
          email      = (SELECT s.email      FROM students s WHERE s.id = contacts.student_id),
          phone      = (SELECT s.phone      FROM students s WHERE s.id = contacts.student_id),
          age_group  = (SELECT s.age_group  FROM students s WHERE s.id = contacts.student_id),
          monthly_revenue = (SELECT s.monthly_rate FROM students s WHERE s.id = contacts.student_id),
          contact_type = (SELECT CASE s.membership_status
            WHEN 'active' THEN 'active_member'
            WHEN 'inactive' THEN 'former_member'
            ELSE 'inactive_member' END
            FROM students s WHERE s.id = contacts.student_id),
          updated_at = datetime('now')
        WHERE contacts.student_id IS NOT NULL
      `).run();
    }

    // -------------------------------------------------------
    // PASS 1: Create a contact for each student
    // -------------------------------------------------------
    const insertFromStudent = db.prepare(`
      INSERT OR IGNORE INTO contacts (student_id, first_name, last_name, email, phone, zivvy_id, mm_id,
        contact_type, monthly_revenue, age_group, source)
      SELECT s.id, s.first_name, s.last_name, s.email, s.phone,
        CAST(s.zivvy_id AS TEXT), s.mm_id,
        CASE s.membership_status
          WHEN 'active' THEN 'active_member'
          WHEN 'inactive' THEN 'former_member'
          ELSE 'inactive_member'
        END,
        s.monthly_rate, s.age_group, s.source
      FROM students s
      WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.student_id = s.id)
    `);
    const studentResult = insertFromStudent.run();
    contactsCreated += studentResult.changes;

    // -------------------------------------------------------
    // PASS 2: Link leads to existing contacts (by email/phone/mm_id match)
    // -------------------------------------------------------
    // First, link leads whose student already has a contact
    const linkLeadsToStudentContacts = db.prepare(`
      UPDATE contacts SET
        lead_id = (
          SELECT l.id FROM leads l
          JOIN students s ON s.id = contacts.student_id
          WHERE (
            (LOWER(TRIM(l.email)) = LOWER(TRIM(s.email)) AND l.email IS NOT NULL AND l.email != '')
            OR (l.mm_id = contacts.mm_id AND l.mm_id IS NOT NULL AND l.mm_id != '')
            OR (
              REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','') =
              REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone,'-',''),' ',''),'(',''),')',''),'+','')
              AND l.phone IS NOT NULL AND l.phone != '' AND s.phone IS NOT NULL AND s.phone != ''
              AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','')) >= 10
            )
          )
          -- Don't link if lead is already assigned to another contact
          AND NOT EXISTS (SELECT 1 FROM contacts c2 WHERE c2.lead_id = l.id)
          LIMIT 1
        ),
        updated_at = datetime('now')
      WHERE contacts.student_id IS NOT NULL
        AND contacts.lead_id IS NULL
        AND EXISTS (
          SELECT 1 FROM leads l
          JOIN students s ON s.id = contacts.student_id
          WHERE (
            (LOWER(TRIM(l.email)) = LOWER(TRIM(s.email)) AND l.email IS NOT NULL AND l.email != '')
            OR (l.mm_id = contacts.mm_id AND l.mm_id IS NOT NULL AND l.mm_id != '')
            OR (
              REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','') =
              REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone,'-',''),' ',''),'(',''),')',''),'+','')
              AND l.phone IS NOT NULL AND l.phone != '' AND s.phone IS NOT NULL AND s.phone != ''
              AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','')) >= 10
            )
          )
          AND NOT EXISTS (SELECT 1 FROM contacts c2 WHERE c2.lead_id = l.id)
        )
    `);
    const linkedResult = linkLeadsToStudentContacts.run();
    leadsLinked += linkedResult.changes;

    // -------------------------------------------------------
    // PASS 3: Create contacts for remaining leads (no matching student)
    // -------------------------------------------------------
    const insertFromLead = db.prepare(`
      INSERT OR IGNORE INTO contacts (lead_id, first_name, last_name, email, phone, zivvy_id, mm_id,
        contact_type, source)
      SELECT l.id, l.first_name, COALESCE(l.last_name, ''), l.email, l.phone,
        CAST(l.zivvy_id AS TEXT), l.mm_id,
        CASE
          WHEN l.status = 'signed_up' THEN 'active_member'
          ELSE 'prospect'
        END,
        l.source
      FROM leads l
      WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.lead_id = l.id)
        -- Skip leads whose email/phone already belongs to an existing contact
        AND NOT EXISTS (
          SELECT 1 FROM contacts c WHERE
            (c.email IS NOT NULL AND c.email != '' AND LOWER(TRIM(c.email)) = LOWER(TRIM(l.email)) AND l.email IS NOT NULL AND l.email != '')
            OR (c.mm_id IS NOT NULL AND c.mm_id = l.mm_id AND l.mm_id IS NOT NULL AND l.mm_id != '')
        )
    `);
    const leadResult = insertFromLead.run();
    contactsCreated += leadResult.changes;

    // -------------------------------------------------------
    // PASS 4: Fill in mm_id on contacts where student has it but contact doesn't
    // Guard against assigning an mm_id that another contact already has.
    // -------------------------------------------------------
    db.prepare(`
      UPDATE contacts SET
        mm_id = (SELECT s.mm_id FROM students s WHERE s.id = contacts.student_id),
        updated_at = datetime('now')
      WHERE contacts.student_id IS NOT NULL
        AND (contacts.mm_id IS NULL OR contacts.mm_id = '')
        AND EXISTS (
          SELECT 1 FROM students s WHERE s.id = contacts.student_id
          AND s.mm_id IS NOT NULL AND s.mm_id != ''
        )
        AND NOT EXISTS (
          SELECT 1 FROM contacts c2
          WHERE c2.mm_id = (SELECT s2.mm_id FROM students s2 WHERE s2.id = contacts.student_id)
            AND c2.id != contacts.id
        )
    `).run();

    // Same for zivvy_id
    db.prepare(`
      UPDATE contacts SET
        zivvy_id = (SELECT CAST(s.zivvy_id AS TEXT) FROM students s WHERE s.id = contacts.student_id),
        updated_at = datetime('now')
      WHERE contacts.student_id IS NOT NULL
        AND (contacts.zivvy_id IS NULL OR contacts.zivvy_id = '')
        AND EXISTS (
          SELECT 1 FROM students s WHERE s.id = contacts.student_id
          AND s.zivvy_id IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM contacts c2
          WHERE c2.zivvy_id = (SELECT CAST(s2.zivvy_id AS TEXT) FROM students s2 WHERE s2.id = contacts.student_id)
            AND c2.id != contacts.id
        )
    `).run();
  });

  populate();

  // -------------------------------------------------------
  // PASS 5: Household detection
  // -------------------------------------------------------
  const householdsDetected = detectHouseholds(db);

  return {
    contacts_created: contactsCreated,
    leads_linked: leadsLinked,
    households_detected: householdsDetected,
    duration_ms: Date.now() - start,
  };
}

/**
 * Is this contact a child / minor?
 * True if age_group is a kids program OR age < 18 from student record.
 */
function isMinor(db: Database.Database, contact: { age_group: string | null; student_id: number | null }): boolean {
  if (["Tiny Ninjas", "Little Ninjas", "Teens"].includes(contact.age_group || "")) return true;
  if (contact.student_id) {
    const s = db.prepare("SELECT age FROM students WHERE id = ?").get(contact.student_id) as { age: number | null } | undefined;
    if (s?.age != null && s.age < 18) return true;
  }
  return false;
}

// SQL fragment for identifying child contacts (ninja programs OR under 18)
const CHILD_WHERE = `(
  c_child.age_group IN ('Tiny Ninjas', 'Little Ninjas', 'Teens')
  OR EXISTS (
    SELECT 1 FROM students s_age
    WHERE s_age.id = c_child.student_id AND s_age.age IS NOT NULL AND s_age.age < 18
  )
)`;

// SQL fragment for identifying adult contacts
const ADULT_WHERE = `(
  c_adult.age_group IN ('Adults', 'Adult')
  OR c_adult.age_group IS NULL
  OR c_adult.age_group = ''
)`;

/**
 * Detect household relationships from shared email/phone + age group + parent_name.
 * Also flags when the parent is themselves a student at the gym.
 */
function detectHouseholds(db: Database.Database): number {
  let detected = 0;

  const insertHousehold = db.prepare(`
    INSERT OR IGNORE INTO household_links (parent_contact_id, child_contact_id, relationship, confidence, detected_by, parent_is_student)
    VALUES (?, ?, 'parent_child', 'inferred', ?, ?)
  `);

  // Helper: is this contact also a student?
  const isContactStudent = (contactId: number): boolean => {
    const row = db.prepare(
      "SELECT student_id FROM contacts WHERE id = ? AND student_id IS NOT NULL"
    ).get(contactId) as { student_id: number } | undefined;
    return !!row;
  };

  const detect = db.transaction(() => {
    // Strategy 1: Kids sharing email with an adult
    const sharedEmail = db.prepare(`
      SELECT c_child.id as child_id, c_adult.id as adult_id
      FROM contacts c_child
      JOIN contacts c_adult ON LOWER(TRIM(c_child.email)) = LOWER(TRIM(c_adult.email))
        AND c_child.id != c_adult.id
      WHERE ${CHILD_WHERE}
        AND ${ADULT_WHERE}
        AND c_child.email IS NOT NULL AND c_child.email != ''
        AND NOT EXISTS (
          SELECT 1 FROM household_links h
          WHERE h.parent_contact_id = c_adult.id AND h.child_contact_id = c_child.id
        )
    `).all() as Array<{ child_id: number; adult_id: number }>;

    for (const row of sharedEmail) {
      insertHousehold.run(row.adult_id, row.child_id, "shared_email", isContactStudent(row.adult_id) ? 1 : 0);
      detected++;
    }

    // Strategy 2: Kids sharing phone with an adult
    const sharedPhone = db.prepare(`
      SELECT c_child.id as child_id, c_adult.id as adult_id
      FROM contacts c_child
      JOIN contacts c_adult ON
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c_child.phone,'-',''),' ',''),'(',''),')',''),'+','') =
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c_adult.phone,'-',''),' ',''),'(',''),')',''),'+','')
        AND c_child.id != c_adult.id
      WHERE ${CHILD_WHERE}
        AND ${ADULT_WHERE}
        AND c_child.phone IS NOT NULL AND c_child.phone != ''
        AND c_adult.phone IS NOT NULL AND c_adult.phone != ''
        AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c_child.phone,'-',''),' ',''),'(',''),')',''),'+','')) >= 10
        AND NOT EXISTS (
          SELECT 1 FROM household_links h
          WHERE h.parent_contact_id = c_adult.id AND h.child_contact_id = c_child.id
        )
    `).all() as Array<{ child_id: number; adult_id: number }>;

    for (const row of sharedPhone) {
      insertHousehold.run(row.adult_id, row.child_id, "shared_phone", isContactStudent(row.adult_id) ? 1 : 0);
      detected++;
    }

    // Strategy 3: parent_name first-name match + shared email/phone
    // (original Strategy 4 — matching first name from parent_name against contacts)
    const parentNameFirstMatch = db.prepare(`
      SELECT c_child.id as child_id, parent_candidate.id as parent_id
      FROM contacts c_child
      JOIN students s ON s.id = c_child.student_id
      JOIN contacts parent_candidate ON
        parent_candidate.id != c_child.id
        AND LOWER(TRIM(parent_candidate.first_name)) = LOWER(TRIM(
          CASE
            WHEN INSTR(s.parent_name, ' ') > 0 THEN SUBSTR(s.parent_name, 1, INSTR(s.parent_name, ' ') - 1)
            ELSE s.parent_name
          END
        ))
        AND (
          LOWER(TRIM(parent_candidate.email)) = LOWER(TRIM(c_child.email))
          OR (
            s.parent_phone IS NOT NULL AND s.parent_phone != ''
            AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(parent_candidate.phone,'-',''),' ',''),'(',''),')',''),'+','') =
               REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.parent_phone,'-',''),' ',''),'(',''),')',''),'+','')
          )
        )
      WHERE s.parent_name IS NOT NULL AND s.parent_name != ''
        AND ${CHILD_WHERE}
        AND NOT EXISTS (
          SELECT 1 FROM household_links h
          WHERE h.parent_contact_id = parent_candidate.id AND h.child_contact_id = c_child.id
        )
    `).all() as Array<{ child_id: number; parent_id: number }>;

    for (const row of parentNameFirstMatch) {
      insertHousehold.run(row.parent_id, row.child_id, "parent_name_match", isContactStudent(row.parent_id) ? 1 : 0);
      detected++;
    }

    // Strategy 4: Full parent_name match against contacts (first + last name)
    // This catches parents who are also students at the gym (e.g., "Corey Collins" parent of "Conor Collins")
    // We parse comma-separated parent_name and try each name against contacts
    const kidsWithParentNames = db.prepare(`
      SELECT c_child.id as child_id, s.parent_name, s.parent_phone, c_child.email as child_email
      FROM contacts c_child
      JOIN students s ON s.id = c_child.student_id
      WHERE s.parent_name IS NOT NULL AND s.parent_name != ''
        AND ${CHILD_WHERE}
    `).all() as Array<{ child_id: number; parent_name: string; parent_phone: string | null; child_email: string | null }>;

    for (const kid of kidsWithParentNames) {
      // Parse comma-separated parent names: "Victoria Craft, Nathanael Craft"
      const parentNames = kid.parent_name.split(",").map((n: string) => n.trim()).filter((n: string) => n.length > 0);

      for (const fullName of parentNames) {
        const spaceIdx = fullName.indexOf(" ");
        if (spaceIdx <= 0) continue; // Need both first and last name

        const firstName = fullName.substring(0, spaceIdx).trim();
        const lastName = fullName.substring(spaceIdx + 1).trim();
        if (!firstName || !lastName) continue;

        // Find a contact matching this full name
        const match = db.prepare(`
          SELECT c.id, c.student_id
          FROM contacts c
          WHERE c.id != ?
            AND LOWER(TRIM(c.first_name)) = LOWER(?)
            AND LOWER(TRIM(c.last_name)) = LOWER(?)
            AND NOT EXISTS (
              SELECT 1 FROM household_links h
              WHERE h.parent_contact_id = c.id AND h.child_contact_id = ?
            )
          LIMIT 1
        `).get(kid.child_id, firstName, lastName, kid.child_id) as { id: number; student_id: number | null } | undefined;

        if (match) {
          const parentIsStudent = match.student_id != null ? 1 : 0;
          insertHousehold.run(match.id, kid.child_id, "parent_fullname_match", parentIsStudent);
          detected++;
        }
      }
    }

    // Strategy 5: Flag parent_is_student on existing links where it wasn't set
    // (Catches links from strategies 1-2 where we didn't know the parent was a student)
    db.prepare(`
      UPDATE household_links SET parent_is_student = 1
      WHERE parent_is_student = 0
        AND EXISTS (
          SELECT 1 FROM contacts c
          WHERE c.id = household_links.parent_contact_id
            AND c.student_id IS NOT NULL
        )
    `).run();
  });

  detect();
  return detected;
}

/**
 * Refresh a single contact's data from its source systems.
 * Enforces source-of-truth rules:
 *   - Zivvy wins for name, email, phone, membership, belt, billing
 *   - MM wins for conversations (already on separate tables)
 *   - Our app wins for engagement scores, enrichment (never overwritten)
 */
export function refreshContactFromSources(db: Database.Database, contactId: number) {
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId) as any;
  if (!contact) return;

  if (contact.student_id) {
    const student = db.prepare("SELECT * FROM students WHERE id = ?").get(contact.student_id) as any;
    if (student) {
      // Only set mm_id/zivvy_id if no other contact already has that value
      const newMmId = student.mm_id || null;
      const newZivvyId = student.zivvy_id ? String(student.zivvy_id) : null;

      const mmIdSafe = newMmId && !db.prepare(
        "SELECT 1 FROM contacts WHERE mm_id = ? AND id != ?"
      ).get(newMmId, contactId) ? newMmId : null;

      const zivvyIdSafe = newZivvyId && !db.prepare(
        "SELECT 1 FROM contacts WHERE zivvy_id = ? AND id != ?"
      ).get(newZivvyId, contactId) ? newZivvyId : null;

      db.prepare(`
        UPDATE contacts SET
          first_name = ?, last_name = ?, email = ?, phone = ?,
          contact_type = ?,
          monthly_revenue = ?,
          age_group = ?,
          zivvy_id = COALESCE(?, zivvy_id),
          mm_id = COALESCE(?, mm_id),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        student.first_name,
        student.last_name,
        student.email,
        student.phone,
        student.membership_status === "active" ? "active_member" : "former_member",
        student.monthly_rate,
        student.age_group,
        zivvyIdSafe,
        mmIdSafe,
        contactId
      );
    }
  }
}

/**
 * Refresh all contacts from their source systems (batch).
 */
export function refreshAllContacts(db: Database.Database) {
  const contacts = db.prepare(
    "SELECT id FROM contacts WHERE student_id IS NOT NULL"
  ).all() as Array<{ id: number }>;

  const tx = db.transaction(() => {
    for (const c of contacts) {
      refreshContactFromSources(db, c.id);
    }
  });
  tx();

  return contacts.length;
}
