/**
 * Generate Dedup Approval Report for Rodrigo
 *
 * Creates an Excel workbook with:
 *   Tab 1: Executive Summary — what each action does, risk level, recommended approach
 *   Tab 2: Student-Lead Overlaps — students that also exist as lead records (829)
 *   Tab 3: Unlinked Students — students we can auto-link to their Market Muscles contact (971)
 *   Tab 4: Ambiguous Matches — family accounts sharing email/phone that need manual review
 *   Tab 5: Duplicate Lead Emails — multiple lead records sharing the same email
 *   Tab 6: MM-Only Contacts — people in Market Muscles with no Zivvy match
 */

import Database from "better-sqlite3";
import path from "path";
import XLSX from "xlsx";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "supremacy.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure schemas are loaded
const { migrateZivvySchema } = require("../src/lib/zivvy/schema");
const { migrateMMSchema } = require("../src/lib/marketmuscles/schema");
migrateZivvySchema(db);
migrateMMSchema(db);

// ============================================================
// TAB 1: EXECUTIVE SUMMARY
// ============================================================

const summaryRows = [
  {
    "Category": "Student-Lead Overlaps",
    "Source Systems": "Zivvy + Market Muscles",
    "Issue": "People who are already enrolled students but still have an open 'lead' record in the system. This happens when Kyle signs someone up in Zivvy but doesn't clean up their lead record.",
    "Count": 0, // filled below
    "Recommended Action": "PROGRAMMATIC — Auto-delete the lead record after transferring any Market Muscles data to the student record. Safe because the student record has all the important info (billing, attendance, belt rank).",
    "Risk Level": "Low",
    "What Gets Deleted": "The duplicate lead record and its follow-up history. Student record is untouched. Any Market Muscles conversation link transfers to the student first.",
    "Reversibility": "Medium — lead follow-up history is deleted but was redundant (student is already enrolled). Could export follow-up history first if needed.",
    "Approval Needed": "YES — Rodrigo should review the count and confirm.",
  },
  {
    "Category": "Unlinked Students (Auto-Linkable)",
    "Source Systems": "Zivvy → Market Muscles",
    "Issue": "Students in Zivvy who have a matching Market Muscles contact (same email or phone) but aren't linked yet. Without linking, we can't see their conversation history or engagement data.",
    "Count": 0,
    "Recommended Action": "PROGRAMMATIC — Auto-link by matching email/phone. No data is deleted. Only adds a reference ID to the student record.",
    "Risk Level": "Very Low",
    "What Gets Deleted": "Nothing. This only ADDS a link (mm_id) to existing student records.",
    "Reversibility": "Fully reversible — can clear the mm_id field at any time.",
    "Approval Needed": "YES — but this is the safest action. Just connecting records.",
  },
  {
    "Category": "Ambiguous Matches (Family Accounts)",
    "Source Systems": "Zivvy + Market Muscles",
    "Issue": "Multiple students share the same email or phone (e.g., parent signed up 2 kids with their email). We can't programmatically decide which student should link to the Market Muscles contact.",
    "Count": 0,
    "Recommended Action": "MANUAL — Review each group and decide which student is the primary contact. Typically the parent or the oldest family member.",
    "Risk Level": "None (review only)",
    "What Gets Deleted": "Nothing until a manual decision is made.",
    "Reversibility": "N/A",
    "Approval Needed": "NO — just review and decide. Can be done over time.",
  },
  {
    "Category": "Duplicate Lead Emails",
    "Source Systems": "Zivvy + Market Muscles",
    "Issue": "Multiple lead records sharing the same email address. Usually caused by the same person inquiring multiple times, or being entered in both Zivvy (as prospect) and Market Muscles (as website lead).",
    "Count": 0,
    "Recommended Action": "PROGRAMMATIC (Phase 2) — Keep the lead with the most recent activity, merge data from others. Lower priority than student-lead overlaps.",
    "Risk Level": "Low",
    "What Gets Deleted": "Redundant lead records. Most recent/most complete record is kept.",
    "Reversibility": "Medium — merged data is preserved on the surviving record.",
    "Approval Needed": "YES — but this is Phase 2. Not urgent.",
  },
  {
    "Category": "MM-Only Contacts (No Zivvy Match)",
    "Source Systems": "Market Muscles only",
    "Issue": "People who exist in Market Muscles but have no matching student or prospect in Zivvy. These are typically website visitors who never came in, or people whose contact info doesn't match across systems.",
    "Count": 0,
    "Recommended Action": "NO ACTION — These are valid leads captured by the website. They stay as leads in our system. Useful for remarketing.",
    "Risk Level": "None",
    "What Gets Deleted": "Nothing.",
    "Reversibility": "N/A",
    "Approval Needed": "NO — informational only.",
  },
];

// ============================================================
// TAB 2: STUDENT-LEAD OVERLAPS
// ============================================================

const studentLeadOverlaps = db.prepare(`
  SELECT
    s.id as student_id,
    s.first_name as student_first,
    s.last_name as student_last,
    s.email as student_email,
    s.phone as student_phone,
    s.belt_rank,
    s.membership_status,
    s.mm_id as student_mm_id,
    l.id as lead_id,
    l.first_name as lead_first,
    l.last_name as lead_last,
    l.email as lead_email,
    l.phone as lead_phone,
    l.status as lead_status,
    l.source as lead_source,
    l.mm_id as lead_mm_id,
    l.created_at as lead_created,
    (SELECT COUNT(*) FROM follow_ups f WHERE f.lead_id = l.id) as follow_up_count,
    (SELECT COUNT(*) FROM survey_sends ss WHERE ss.lead_id = l.id) as survey_count,
    (SELECT COUNT(*) FROM student_profiles sp WHERE sp.lead_id = l.id) as profile_count
  FROM students s
  JOIN leads l ON
    (LOWER(TRIM(l.email)) = LOWER(TRIM(s.email)) AND l.email IS NOT NULL AND l.email != '')
    OR
    (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','') =
     REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone,'-',''),' ',''),'(',''),')',''),'+','')
     AND l.phone IS NOT NULL AND l.phone != '' AND s.phone IS NOT NULL AND s.phone != ''
     AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone,'-',''),' ',''),'(',''),')',''),'+','')) >= 10)
  ORDER BY s.last_name, s.first_name
`).all() as any[];

const overlapRows = studentLeadOverlaps.map((r: any) => ({
  "Student ID": r.student_id,
  "Student Name": `${r.student_first} ${r.student_last}`,
  "Student Email": r.student_email || "",
  "Student Phone": r.student_phone || "",
  "Belt Rank": r.belt_rank || "white",
  "Membership Status": r.membership_status,
  "Student Has MM Link": r.student_mm_id ? "Yes" : "No",
  "Lead ID": r.lead_id,
  "Lead Name": `${r.lead_first} ${r.lead_last}`,
  "Lead Email": r.lead_email || "",
  "Lead Phone": r.lead_phone || "",
  "Lead Status": r.lead_status,
  "Lead Source": r.lead_source || "",
  "Lead Has MM Link": r.lead_mm_id ? "Yes" : "No",
  "Lead Created": r.lead_created,
  "Follow-ups on Lead": r.follow_up_count,
  "Surveys on Lead": r.survey_count,
  "Profile on Lead": r.profile_count,
  "Dependent Records": r.follow_up_count + r.survey_count + r.profile_count,
  "Action": "PROGRAMMATIC DELETE — Transfer MM link to student, cascade delete dependents, remove lead",
  "Risk": r.follow_up_count + r.survey_count + r.profile_count > 0
    ? `Has ${r.follow_up_count + r.survey_count + r.profile_count} dependent record(s) that will be deleted`
    : "Clean — no dependent records",
}));

summaryRows[0]["Count"] = overlapRows.length;

// ============================================================
// TAB 3: UNLINKED STUDENTS (auto-linkable)
// ============================================================

const unlinkableStudents = db.prepare(`
  SELECT
    s.id as student_id,
    s.first_name,
    s.last_name,
    s.email,
    s.phone,
    s.belt_rank,
    s.membership_status,
    s.age_group,
    mc.id as mm_contact_id,
    mc.first_name as mm_first,
    mc.last_name as mm_last,
    mc.email as mm_email,
    mc.phone as mm_phone,
    mc.type as mm_type,
    mc.status as mm_status,
    CASE
      WHEN LOWER(TRIM(s.email)) = LOWER(TRIM(mc.email)) AND s.email IS NOT NULL AND s.email != '' THEN 'Email'
      ELSE 'Phone'
    END as match_type,
    -- Check if this mm_id is already used by another student
    (SELECT COUNT(*) FROM students s2 WHERE s2.mm_id = mc.id) as mm_id_already_used
  FROM students s
  JOIN mm_contacts mc ON
    (LOWER(TRIM(s.email)) = LOWER(TRIM(mc.email)) AND s.email IS NOT NULL AND s.email != '' AND mc.email IS NOT NULL AND mc.email != '')
    OR
    (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone,'-',''),' ',''),'(',''),')',''),'+','') =
     REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mc.phone,'-',''),' ',''),'(',''),')',''),'+','')
     AND s.phone IS NOT NULL AND s.phone != '' AND mc.phone IS NOT NULL AND mc.phone != ''
     AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s.phone,'-',''),' ',''),'(',''),')',''),'+','')) >= 10)
  WHERE (s.mm_id IS NULL OR s.mm_id = '')
  ORDER BY s.last_name, s.first_name
`).all() as any[];

// Separate into auto-linkable vs ambiguous
const autoLinkable: any[] = [];
const ambiguous: any[] = [];

// Group by mm_contact_id to find conflicts
const mmIdGroups: Record<string, any[]> = {};
for (const r of unlinkableStudents) {
  const key = r.mm_contact_id;
  if (!mmIdGroups[key]) mmIdGroups[key] = [];
  mmIdGroups[key].push(r);
}

for (const [mmId, group] of Object.entries(mmIdGroups)) {
  if (group.length === 1 && group[0].mm_id_already_used === 0) {
    autoLinkable.push(group[0]);
  } else {
    for (const r of group) {
      ambiguous.push({ ...r, conflict_count: group.length });
    }
  }
}

const autoLinkRows = autoLinkable.map((r: any) => ({
  "Student ID": r.student_id,
  "Student Name": `${r.first_name} ${r.last_name}`,
  "Student Email": r.email || "",
  "Student Phone": r.phone || "",
  "Belt Rank": r.belt_rank || "white",
  "Status": r.membership_status,
  "Age Group": r.age_group || "",
  "Match Type": r.match_type,
  "MM Contact ID": r.mm_contact_id,
  "MM Name": `${r.mm_first || ""} ${r.mm_last || ""}`.trim(),
  "MM Email": r.mm_email || "",
  "MM Phone": r.mm_phone || "",
  "MM Type": r.mm_type || "",
  "MM Status": r.mm_status || "",
  "Action": "PROGRAMMATIC LINK — Add mm_id to student record. No data deleted.",
}));

summaryRows[1]["Count"] = autoLinkRows.length;

// ============================================================
// TAB 4: AMBIGUOUS MATCHES
// ============================================================

const ambiguousRows = ambiguous.map((r: any) => ({
  "Student ID": r.student_id,
  "Student Name": `${r.first_name} ${r.last_name}`,
  "Student Email": r.email || "",
  "Student Phone": r.phone || "",
  "Belt Rank": r.belt_rank || "white",
  "Status": r.membership_status,
  "Age Group": r.age_group || "",
  "Match Type": r.match_type,
  "MM Contact ID": r.mm_contact_id,
  "MM Name": `${r.mm_first || ""} ${r.mm_last || ""}`.trim(),
  "MM Email": r.mm_email || "",
  "MM Phone": r.mm_phone || "",
  "Conflict": r.mm_id_already_used > 0
    ? "MM contact already linked to another student"
    : `${r.conflict_count} students match this MM contact`,
  "Action": "MANUAL REVIEW — Decide which student should link to this MM contact (likely the parent or primary contact holder)",
}));

summaryRows[2]["Count"] = ambiguousRows.length;

// ============================================================
// TAB 5: DUPLICATE LEAD EMAILS
// ============================================================

const dupLeadEmails = db.prepare(`
  SELECT
    l.id as lead_id,
    l.first_name,
    l.last_name,
    LOWER(TRIM(l.email)) as email,
    l.phone,
    l.source,
    l.status,
    l.interest,
    l.mm_id,
    l.zivvy_id,
    l.created_at,
    l.updated_at,
    l.last_contact,
    l.mm_has_replied,
    l.mm_message_count,
    (SELECT COUNT(*) FROM follow_ups f WHERE f.lead_id = l.id) as follow_up_count
  FROM leads l
  WHERE LOWER(TRIM(l.email)) IN (
    SELECT LOWER(TRIM(email)) FROM leads
    WHERE email IS NOT NULL AND email != ''
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
  )
  AND l.email IS NOT NULL AND l.email != ''
  -- Exclude leads that overlap with students (handled in Tab 2)
  AND NOT EXISTS (
    SELECT 1 FROM students s WHERE LOWER(TRIM(s.email)) = LOWER(TRIM(l.email))
  )
  ORDER BY LOWER(TRIM(l.email)), l.created_at DESC
`).all() as any[];

// Group by email to identify which to keep
const emailGroups: Record<string, any[]> = {};
for (const r of dupLeadEmails) {
  if (!emailGroups[r.email]) emailGroups[r.email] = [];
  emailGroups[r.email].push(r);
}

const dupLeadRows: any[] = [];
for (const [email, group] of Object.entries(emailGroups)) {
  // Determine which record to keep: prefer has_replied, then most follow-ups, then most recent
  const sorted = [...group].sort((a, b) => {
    if (a.mm_has_replied && !b.mm_has_replied) return -1;
    if (!a.mm_has_replied && b.mm_has_replied) return 1;
    if ((a.mm_message_count || 0) !== (b.mm_message_count || 0)) return (b.mm_message_count || 0) - (a.mm_message_count || 0);
    if (a.follow_up_count !== b.follow_up_count) return b.follow_up_count - a.follow_up_count;
    return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
  });

  sorted.forEach((r, idx) => {
    dupLeadRows.push({
      "Email Group": email,
      "Duplicates in Group": group.length,
      "Lead ID": r.lead_id,
      "Name": `${r.first_name} ${r.last_name}`,
      "Phone": r.phone || "",
      "Source": r.source || "",
      "Lead Status": r.status,
      "Interest": r.interest || "",
      "Has MM Link": r.mm_id ? "Yes" : "No",
      "Has Zivvy Link": r.zivvy_id ? "Yes" : "No",
      "MM Messages": r.mm_message_count || 0,
      "MM Replied": r.mm_has_replied ? "Yes" : "No",
      "Follow-ups": r.follow_up_count,
      "Created": r.created_at,
      "Last Contact": r.last_contact || "",
      "Recommendation": idx === 0 ? "KEEP — Most active/recent record" : "DELETE (Phase 2) — Merge data into kept record",
    });
  });
}

const uniqueDupGroups = Object.keys(emailGroups).length;
(summaryRows[3] as any)["Count"] = `${dupLeadRows.length} records in ${uniqueDupGroups} groups`;

// ============================================================
// TAB 6: MM-ONLY CONTACTS
// ============================================================

const mmOnly = db.prepare(`
  SELECT
    mc.id as mm_id,
    mc.first_name,
    mc.last_name,
    mc.email,
    mc.phone,
    mc.type,
    mc.status,
    mc.source,
    mc.tags,
    mc.created_at_iso as created_at,
    l.id as lead_id,
    l.status as lead_status
  FROM mm_contacts mc
  LEFT JOIN leads l ON l.mm_id = mc.id
  LEFT JOIN students s ON s.mm_id = mc.id
  WHERE s.id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM students s2 WHERE
        (LOWER(TRIM(s2.email)) = LOWER(TRIM(mc.email)) AND s2.email IS NOT NULL AND s2.email != '')
        OR
        (REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s2.phone,'-',''),' ',''),'(',''),')',''),'+','') =
         REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mc.phone,'-',''),' ',''),'(',''),')',''),'+','')
         AND s2.phone IS NOT NULL AND s2.phone != '' AND mc.phone IS NOT NULL AND mc.phone != ''
         AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mc.phone,'-',''),' ',''),'(',''),')',''),'+','')) >= 10)
    )
  ORDER BY mc.created_at_iso DESC
  LIMIT 500
`).all() as any[];

const mmOnlyRows = mmOnly.map((r: any) => ({
  "MM Contact ID": r.mm_id,
  "Name": `${r.first_name || ""} ${r.last_name || ""}`.trim() || "(no name)",
  "Email": r.email || "",
  "Phone": r.phone || "",
  "MM Type": r.type || "",
  "MM Status": r.status || "",
  "Source": r.source || "",
  "Tags": r.tags || "",
  "Created": r.created_at || "",
  "Has Lead Record": r.lead_id ? `Yes (ID: ${r.lead_id}, Status: ${r.lead_status})` : "No",
  "Action": "NO ACTION — Valid website lead. Keep for remarketing.",
}));

(summaryRows[4] as any)["Count"] = mmOnly.length >= 500 ? "500+ (showing first 500)" : mmOnly.length;

// ============================================================
// Also count students with NO match at all (not even in unlinked)
// ============================================================

const totalUnlinked = (db.prepare(`
  SELECT COUNT(*) as count FROM students WHERE (mm_id IS NULL OR mm_id = '')
`).get() as any).count;

const totalStudents = (db.prepare(`
  SELECT COUNT(*) as count FROM students
`).get() as any).count;

const totalLeads = (db.prepare(`
  SELECT COUNT(*) as count FROM leads
`).get() as any).count;

const totalMMContacts = (db.prepare(`
  SELECT COUNT(*) as count FROM mm_contacts
`).get() as any).count;

// ============================================================
// BUILD WORKBOOK
// ============================================================

const wb = XLSX.utils.book_new();

// --- Summary sheet ---
const summaryHeader = [
  ["SUPREMACY BJJ — Data Deduplication Approval Report"],
  [`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`],
  [""],
  ["SYSTEM TOTALS"],
  ["", "Students (Zivvy)", totalStudents],
  ["", "Leads (Zivvy + MM)", totalLeads],
  ["", "Market Muscles Contacts", totalMMContacts],
  ["", "Students without MM link", totalUnlinked],
  ["", "Students with MM link", totalStudents - totalUnlinked],
  [""],
  ["WHAT IS THIS REPORT?"],
  ["", "Our app syncs data from two systems: Zivvy (membership/billing) and Market Muscles (website/conversations)."],
  ["", "When a person exists in both systems, we need to link their records so we can see the full picture."],
  ["", "This report identifies duplicate and unlinked records and recommends actions to clean them up."],
  ["", "Each action below needs your approval before we run it."],
  [""],
  ["ACTION ITEMS (Review each tab for details)"],
  [""],
];

const ws1 = XLSX.utils.aoa_to_sheet(summaryHeader);
XLSX.utils.sheet_add_json(ws1, summaryRows, { origin: "A18" });

// Set column widths
ws1["!cols"] = [
  { wch: 35 }, // Category
  { wch: 25 }, // Source Systems
  { wch: 70 }, // Issue
  { wch: 12 }, // Count
  { wch: 70 }, // Recommended Action
  { wch: 12 }, // Risk Level
  { wch: 60 }, // What Gets Deleted
  { wch: 50 }, // Reversibility
  { wch: 15 }, // Approval Needed
];

XLSX.utils.book_append_sheet(wb, ws1, "Summary");

// --- Student-Lead Overlaps ---
const ws2 = XLSX.utils.json_to_sheet(overlapRows);
ws2["!cols"] = Array(Object.keys(overlapRows[0] || {}).length).fill({ wch: 20 });
XLSX.utils.book_append_sheet(wb, ws2, "Student-Lead Overlaps");

// --- Auto-Linkable Students ---
const ws3 = XLSX.utils.json_to_sheet(autoLinkRows.length > 0 ? autoLinkRows : [{ "Note": "No auto-linkable students found (may already be linked)" }]);
ws3["!cols"] = Array(Object.keys(autoLinkRows[0] || {}).length).fill({ wch: 20 });
XLSX.utils.book_append_sheet(wb, ws3, "Auto-Linkable Students");

// --- Ambiguous Matches ---
const ws4 = XLSX.utils.json_to_sheet(ambiguousRows.length > 0 ? ambiguousRows : [{ "Note": "No ambiguous matches found" }]);
ws4["!cols"] = Array(Object.keys(ambiguousRows[0] || {}).length).fill({ wch: 20 });
XLSX.utils.book_append_sheet(wb, ws4, "Ambiguous (Manual Review)");

// --- Duplicate Lead Emails ---
const ws5 = XLSX.utils.json_to_sheet(dupLeadRows.length > 0 ? dupLeadRows : [{ "Note": "No duplicate lead emails found" }]);
ws5["!cols"] = Array(Object.keys(dupLeadRows[0] || {}).length).fill({ wch: 20 });
XLSX.utils.book_append_sheet(wb, ws5, "Duplicate Lead Emails");

// --- MM-Only Contacts ---
const ws6 = XLSX.utils.json_to_sheet(mmOnlyRows.length > 0 ? mmOnlyRows : [{ "Note": "No MM-only contacts found" }]);
ws6["!cols"] = Array(Object.keys(mmOnlyRows[0] || {}).length).fill({ wch: 20 });
XLSX.utils.book_append_sheet(wb, ws6, "MM-Only Contacts");

// ============================================================
// WRITE FILE
// ============================================================

const outPath = path.join(process.cwd(), "Supremacy_Dedup_Approval_Report.xlsx");
XLSX.writeFile(wb, outPath);

console.log(`\n✅ Report generated: ${outPath}`);
console.log(`\nTab breakdown:`);
console.log(`  1. Summary — ${summaryRows.length} action categories`);
console.log(`  2. Student-Lead Overlaps — ${overlapRows.length} records`);
console.log(`  3. Auto-Linkable Students — ${autoLinkRows.length} records`);
console.log(`  4. Ambiguous Matches — ${ambiguousRows.length} records`);
console.log(`  5. Duplicate Lead Emails — ${dupLeadRows.length} records in ${uniqueDupGroups} groups`);
console.log(`  6. MM-Only Contacts — ${mmOnlyRows.length} records`);
