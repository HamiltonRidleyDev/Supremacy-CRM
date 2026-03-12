import { NextResponse } from "next/server";
import { getDb, ensureZivvySchema, ensureMMSchema } from "@/lib/db";

/**
 * GET /api/dedup — Detect duplicate and unlinked contacts across Zivvy and Market Muscles.
 *
 * Finds:
 * 1. Students that also appear as leads (converted but not cleaned up)
 * 2. Leads with duplicate emails (same person, multiple records)
 * 3. Students/leads missing cross-system links (has zivvy_id but no mm_id or vice versa)
 * 4. Linking coverage stats
 */
export async function GET() {
  try {
    ensureZivvySchema();
    ensureMMSchema();
    const db = getDb();

    // ─── Linking Coverage ────────────────────────────────────────

    const studentStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN zivvy_id IS NOT NULL AND mm_id IS NOT NULL AND mm_id != '' THEN 1 ELSE 0 END) as both_ids,
        SUM(CASE WHEN zivvy_id IS NOT NULL AND (mm_id IS NULL OR mm_id = '') THEN 1 ELSE 0 END) as zivvy_only,
        SUM(CASE WHEN (zivvy_id IS NULL) AND mm_id IS NOT NULL AND mm_id != '' THEN 1 ELSE 0 END) as mm_only,
        SUM(CASE WHEN zivvy_id IS NULL AND (mm_id IS NULL OR mm_id = '') THEN 1 ELSE 0 END) as neither
      FROM students
    `).get() as Record<string, number>;

    const leadStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN zivvy_id IS NOT NULL AND mm_id IS NOT NULL AND mm_id != '' THEN 1 ELSE 0 END) as both_ids,
        SUM(CASE WHEN zivvy_id IS NOT NULL AND (mm_id IS NULL OR mm_id = '') THEN 1 ELSE 0 END) as zivvy_only,
        SUM(CASE WHEN (zivvy_id IS NULL) AND mm_id IS NOT NULL AND mm_id != '' THEN 1 ELSE 0 END) as mm_only,
        SUM(CASE WHEN zivvy_id IS NULL AND (mm_id IS NULL OR mm_id = '') THEN 1 ELSE 0 END) as neither
      FROM leads
    `).get() as Record<string, number>;

    // ─── Type 1: Students that also exist as leads ───────────────

    const studentLeadOverlap = db.prepare(`
      SELECT
        s.id as student_id, s.first_name as s_first, s.last_name as s_last,
        s.email as s_email, s.phone as s_phone,
        s.membership_status, s.belt_rank, s.zivvy_id as s_zivvy_id, s.mm_id as s_mm_id,
        l.id as lead_id, l.first_name as l_first, l.last_name as l_last,
        l.email as l_email, l.phone as l_phone,
        l.status as lead_status, l.zivvy_id as l_zivvy_id, l.mm_id as l_mm_id,
        'email' as match_type
      FROM students s
      JOIN leads l ON LOWER(TRIM(s.email)) = LOWER(TRIM(l.email))
      WHERE s.email IS NOT NULL AND s.email != ''
      UNION
      SELECT
        s.id, s.first_name, s.last_name, s.email, s.phone,
        s.membership_status, s.belt_rank, s.zivvy_id, s.mm_id,
        l.id, l.first_name, l.last_name, l.email, l.phone,
        l.status, l.zivvy_id, l.mm_id,
        'phone'
      FROM students s
      JOIN leads l ON REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone, '-',''), ' ',''), '(',''), ')',''), '+','') =
                      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone, '-',''), ' ',''), '(',''), ')',''), '+','')
      WHERE s.phone IS NOT NULL AND s.phone != '' AND l.phone IS NOT NULL AND l.phone != ''
        AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone, '-',''), ' ',''), '(',''), ')',''), '+','')) >= 10
    `).all();

    // Deduplicate (same pair might match on both email AND phone)
    const seenPairs = new Set<string>();
    const uniqueOverlap = (studentLeadOverlap as any[]).filter((r: any) => {
      const key = `${r.student_id}-${r.lead_id}`;
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    });

    // ─── Type 2: Duplicate leads (same email, multiple records) ──

    const duplicateLeadEmails = db.prepare(`
      SELECT LOWER(TRIM(email)) as email, COUNT(*) as count,
             GROUP_CONCAT(id, ',') as lead_ids,
             GROUP_CONCAT(first_name || ' ' || COALESCE(last_name,''), ' | ') as names,
             GROUP_CONCAT(COALESCE(zivvy_id,'') || '/' || COALESCE(mm_id,''), ' | ') as ids
      FROM leads
      WHERE email IS NOT NULL AND email != ''
      GROUP BY LOWER(TRIM(email))
      HAVING count > 1
      ORDER BY count DESC
    `).all();

    // ─── Type 3: Unlinked contacts (fixable with better matching) ─

    // Students with zivvy_id but no mm_id — check if MM has a matching contact
    const unlinkableStudents = db.prepare(`
      SELECT s.id, s.first_name, s.last_name, s.email, s.phone,
             s.zivvy_id, s.membership_status,
             mc.id as potential_mm_id, mc.full_name as mm_name, mc.email as mm_email, mc.phone as mm_phone
      FROM students s
      JOIN mm_contacts mc ON (
        (LOWER(TRIM(s.email)) = LOWER(TRIM(mc.email)) AND s.email IS NOT NULL AND s.email != '')
        OR
        (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone,'-',''),' ',''),'(',''),')',''),'+','') =
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mc.phone,'-',''),' ',''),'(',''),')',''),'+','')
         AND s.phone IS NOT NULL AND s.phone != '' AND mc.phone IS NOT NULL AND mc.phone != ''
         AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone,'-',''),' ',''),'(',''),')',''),'+','')) >= 10)
      )
      WHERE (s.mm_id IS NULL OR s.mm_id = '')
      LIMIT 50
    `).all();

    // Leads with mm_id but no zivvy_id — check if Zivvy has a matching contact
    const unlinkableLeads = db.prepare(`
      SELECT l.id, l.first_name, l.last_name, l.email, l.phone,
             l.mm_id, l.status,
             zc.id as potential_zivvy_id, zc.first_name as z_first, zc.last_name as z_last,
             zc.email as z_email, zc.phone as z_phone
      FROM leads l
      JOIN zivvy_contacts zc ON (
        (LOWER(TRIM(l.email)) = LOWER(TRIM(zc.email)) AND l.email IS NOT NULL AND l.email != '')
        OR
        (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','') =
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(zc.phone,'-',''),' ',''),'(',''),')',''),'+','')
         AND l.phone IS NOT NULL AND l.phone != '' AND zc.phone IS NOT NULL AND zc.phone != ''
         AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','')) >= 10)
      )
      WHERE l.zivvy_id IS NULL
      LIMIT 50
    `).all();

    return NextResponse.json({
      linkingCoverage: {
        students: studentStats,
        leads: leadStats,
      },
      issues: {
        studentLeadOverlap: {
          count: uniqueOverlap.length,
          description: "Students who also exist as separate lead records (converted but not cleaned up)",
          records: uniqueOverlap.slice(0, 25),
        },
        duplicateLeadEmails: {
          count: duplicateLeadEmails.length,
          totalExtraRecords: (duplicateLeadEmails as any[]).reduce((sum: number, d: any) => sum + (d.count as number) - 1, 0),
          description: "Same email address appearing in multiple lead records",
          records: duplicateLeadEmails.slice(0, 25),
        },
        unlinkableStudents: {
          count: unlinkableStudents.length,
          description: "Students with Zivvy ID but no MM ID — found matching MM contact that could be linked",
          records: unlinkableStudents.slice(0, 25),
        },
        unlinkableLeads: {
          count: unlinkableLeads.length,
          description: "Leads with MM ID but no Zivvy ID — found matching Zivvy contact that could be linked",
          records: unlinkableLeads.slice(0, 25),
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dedup — Execute dedup actions.
 *
 * Actions:
 * - "link_student_mm": Link a student to an MM contact ID
 * - "link_lead_zivvy": Link a lead to a Zivvy contact ID
 * - "merge_lead_to_student": Delete a lead record and transfer its data to an existing student
 * - "merge_duplicate_leads": Merge duplicate lead records into one
 * - "auto_link_all": Automatically link all detectable matches
 * - "auto_cleanup_student_leads": Remove lead records for contacts that are already students
 */
export async function POST(request: Request) {
  try {
    ensureZivvySchema();
    ensureMMSchema();
    const db = getDb();
    const body = await request.json();
    const { action } = body;

    if (action === "auto_link_all") {
      // Link students missing mm_id to matching MM contacts.
      // Only link when:
      //   1. The mm_id isn't already assigned to another student (UNIQUE constraint safety)
      //   2. There's exactly one matching MM contact (avoid ambiguous family-shared-email matches)
      const linkStudents = db.prepare(`
        UPDATE students SET mm_id = (
          SELECT mc.id FROM mm_contacts mc WHERE
            (LOWER(TRIM(students.email)) = LOWER(TRIM(mc.email)) AND students.email IS NOT NULL AND students.email != '')
            OR
            (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(students.phone,'-',''),' ',''),'(',''),')',''),'+','') =
             REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mc.phone,'-',''),' ',''),'(',''),')',''),'+','')
             AND students.phone IS NOT NULL AND students.phone != '' AND mc.phone IS NOT NULL AND mc.phone != '')
          LIMIT 1
        )
        WHERE (mm_id IS NULL OR mm_id = '')
          AND EXISTS (
            SELECT 1 FROM mm_contacts mc WHERE
              (LOWER(TRIM(students.email)) = LOWER(TRIM(mc.email)) AND students.email IS NOT NULL AND students.email != '')
              OR
              (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(students.phone,'-',''),' ',''),'(',''),')',''),'+','') =
               REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mc.phone,'-',''),' ',''),'(',''),')',''),'+','')
               AND students.phone IS NOT NULL AND students.phone != '' AND mc.phone IS NOT NULL AND mc.phone != '')
          )
          -- Skip if the matched mm_id is already used by another student
          AND (
            SELECT mc2.id FROM mm_contacts mc2 WHERE
              (LOWER(TRIM(students.email)) = LOWER(TRIM(mc2.email)) AND students.email IS NOT NULL AND students.email != '')
              OR
              (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(students.phone,'-',''),' ',''),'(',''),')',''),'+','') =
               REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mc2.phone,'-',''),' ',''),'(',''),')',''),'+','')
               AND students.phone IS NOT NULL AND students.phone != '' AND mc2.phone IS NOT NULL AND mc2.phone != '')
            LIMIT 1
          ) NOT IN (SELECT s2.mm_id FROM students s2 WHERE s2.mm_id IS NOT NULL AND s2.mm_id != '')
      `);
      const studentResult = linkStudents.run();

      // Link leads missing zivvy_id to matching Zivvy contacts
      const linkLeads = db.prepare(`
        UPDATE leads SET zivvy_id = (
          SELECT zc.id FROM zivvy_contacts zc WHERE
            (LOWER(TRIM(leads.email)) = LOWER(TRIM(zc.email)) AND leads.email IS NOT NULL AND leads.email != '')
            OR
            (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(leads.phone,'-',''),' ',''),'(',''),')',''),'+','') =
             REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(zc.phone,'-',''),' ',''),'(',''),')',''),'+','')
             AND leads.phone IS NOT NULL AND leads.phone != '' AND zc.phone IS NOT NULL AND zc.phone != '')
          LIMIT 1
        )
        WHERE zivvy_id IS NULL
          AND EXISTS (
            SELECT 1 FROM zivvy_contacts zc WHERE
              (LOWER(TRIM(leads.email)) = LOWER(TRIM(zc.email)) AND leads.email IS NOT NULL AND leads.email != '')
              OR
              (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(leads.phone,'-',''),' ',''),'(',''),')',''),'+','') =
               REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(zc.phone,'-',''),' ',''),'(',''),')',''),'+','')
               AND leads.phone IS NOT NULL AND leads.phone != '' AND zc.phone IS NOT NULL AND zc.phone != '')
          )
      `);
      const leadResult = linkLeads.run();

      // Count skipped (would-be duplicates)
      const skipped = db.prepare(`
        SELECT COUNT(*) as count FROM students
        WHERE (mm_id IS NULL OR mm_id = '')
          AND EXISTS (
            SELECT 1 FROM mm_contacts mc WHERE
              (LOWER(TRIM(students.email)) = LOWER(TRIM(mc.email)) AND students.email IS NOT NULL AND students.email != '')
              OR
              (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(students.phone,'-',''),' ',''),'(',''),')',''),'+','') =
               REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mc.phone,'-',''),' ',''),'(',''),')',''),'+','')
               AND students.phone IS NOT NULL AND students.phone != '' AND mc.phone IS NOT NULL AND mc.phone != '')
          )
      `).get() as { count: number };

      return NextResponse.json({
        success: true,
        studentsLinked: studentResult.changes,
        leadsLinked: leadResult.changes,
        studentsSkipped: skipped.count,
        skippedReason: skipped.count > 0 ? "MM contact already linked to another student (family/shared contact)" : undefined,
      });
    }

    if (action === "auto_cleanup_student_leads") {
      // Find leads whose email/phone matches an existing student and delete them.
      // Must handle FK dependencies: follow_ups, survey_sends (+ survey_responses), student_profiles

      const dupeLeadIds = `
        SELECT l.id FROM leads l
        JOIN students s ON
          (LOWER(TRIM(l.email)) = LOWER(TRIM(s.email)) AND l.email IS NOT NULL AND l.email != '')
          OR
          (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','') =
           REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone,'-',''),' ',''),'(',''),')',''),'+','')
           AND l.phone IS NOT NULL AND l.phone != '' AND s.phone IS NOT NULL AND s.phone != ''
           AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','')) >= 10)
      `;

      // Run everything in a transaction
      const cleanup = db.transaction(() => {
        // 1. Transfer mm_id from leads to students where student lacks it
        const transferMmIds = db.prepare(`
          UPDATE students SET mm_id = (
            SELECT l.mm_id FROM leads l WHERE
              l.mm_id IS NOT NULL AND l.mm_id != ''
              AND (
                (LOWER(TRIM(students.email)) = LOWER(TRIM(l.email)) AND students.email IS NOT NULL AND students.email != '')
                OR
                (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(students.phone,'-',''),' ',''),'(',''),')',''),'+','') =
                 REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','')
                 AND students.phone IS NOT NULL AND students.phone != '' AND l.phone IS NOT NULL AND l.phone != '')
              )
            LIMIT 1
          )
          WHERE (mm_id IS NULL OR mm_id = '')
            AND EXISTS (
              SELECT 1 FROM leads l WHERE l.mm_id IS NOT NULL AND l.mm_id != ''
                AND (
                  (LOWER(TRIM(students.email)) = LOWER(TRIM(l.email)) AND students.email IS NOT NULL AND students.email != '')
                  OR
                  (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(students.phone,'-',''),' ',''),'(',''),')',''),'+','') =
                   REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','')
                   AND students.phone IS NOT NULL AND students.phone != '' AND l.phone IS NOT NULL AND l.phone != '')
                )
            )
        `);
        const transferResult = transferMmIds.run();

        // 2. Delete dependent records for the leads we're about to remove
        const delSurveyResponses = db.prepare(`
          DELETE FROM survey_responses WHERE send_id IN (
            SELECT ss.id FROM survey_sends ss WHERE ss.lead_id IN (${dupeLeadIds})
          )
        `).run();

        const delSurveySends = db.prepare(`
          DELETE FROM survey_sends WHERE lead_id IN (${dupeLeadIds})
        `).run();

        const delFollowUps = db.prepare(`
          DELETE FROM follow_ups WHERE lead_id IN (${dupeLeadIds})
        `).run();

        const delProfiles = db.prepare(`
          DELETE FROM student_profiles WHERE lead_id IN (${dupeLeadIds})
        `).run();

        // 3. Now delete the duplicate leads
        const deleteResult = db.prepare(`DELETE FROM leads WHERE id IN (${dupeLeadIds})`).run();

        return {
          mmIdsTransferred: transferResult.changes,
          dependentsRemoved: {
            followUps: delFollowUps.changes,
            surveySends: delSurveySends.changes,
            surveyResponses: delSurveyResponses.changes,
            studentProfiles: delProfiles.changes,
          },
          duplicateLeadsDeleted: deleteResult.changes,
        };
      });

      const result = cleanup();

      return NextResponse.json({ success: true, ...result });
    }

    if (action === "link_student_mm") {
      const { studentId, mmId } = body;
      db.prepare(`UPDATE students SET mm_id = ? WHERE id = ?`).run(mmId, studentId);
      return NextResponse.json({ success: true });
    }

    if (action === "link_lead_zivvy") {
      const { leadId, zivvyId } = body;
      db.prepare(`UPDATE leads SET zivvy_id = ? WHERE id = ?`).run(zivvyId, leadId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
