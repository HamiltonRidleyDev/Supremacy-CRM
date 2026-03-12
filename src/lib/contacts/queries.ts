import { getDb } from "../db";

// ---- Contact List ----

interface ContactListParams {
  page?: number;
  limit?: number;
  type?: string;
  risk?: string;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export function getContactList(params: ContactListParams = {}) {
  const db = getDb();
  const page = params.page || 1;
  const limit = Math.min(params.limit || 50, 200);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const args: any[] = [];

  if (params.type) {
    conditions.push("c.contact_type = ?");
    args.push(params.type);
  }
  if (params.risk) {
    conditions.push("c.risk_level = ?");
    args.push(params.risk);
  }
  if (params.search) {
    conditions.push("(c.first_name || ' ' || c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)");
    const term = `%${params.search}%`;
    args.push(term, term, term);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortCol = ["engagement_score", "first_name", "last_name", "contact_type", "risk_level", "monthly_revenue", "updated_at"]
    .includes(params.sort || "") ? params.sort : "engagement_score";
  const sortOrder = params.order === "asc" ? "ASC" : "DESC";
  // Null scores should sort last
  const orderBy = `ORDER BY c.${sortCol} IS NULL, c.${sortCol} ${sortOrder}`;

  const total = (db.prepare(`SELECT COUNT(*) as count FROM contacts c ${where}`).get(...args) as any).count;

  const contacts = db.prepare(`
    SELECT c.*,
      COALESCE((
        SELECT COUNT(*) FROM household_links h
        WHERE h.parent_contact_id = c.id OR h.child_contact_id = c.id
      ), 0) + 1 as household_size,
      COALESCE(c.monthly_revenue, 0) + COALESCE((
        SELECT SUM(c2.monthly_revenue)
        FROM household_links h
        JOIN contacts c2 ON (
          (h.child_contact_id = c2.id AND h.parent_contact_id = c.id)
          OR (h.parent_contact_id = c2.id AND h.child_contact_id = c.id)
        )
      ), 0) as household_revenue
    FROM contacts c
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...args, limit, offset);

  return { contacts, total, page, limit };
}

// ---- Contact Detail ----

export function getContactDetail(contactId: number) {
  const db = getDb();

  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId) as any;
  if (!contact) return null;

  // Student data (Zivvy source of truth)
  const student = contact.student_id
    ? db.prepare(`
        SELECT belt_rank, stripes, membership_status, membership_type, monthly_rate,
          start_date, last_attendance, total_classes, current_program, billing_method,
          on_vacation, age_group, age, address, city, state, zip, parent_name, parent_phone
        FROM students WHERE id = ?
      `).get(contact.student_id)
    : null;

  // Lead data
  const lead = contact.lead_id
    ? db.prepare(`
        SELECT status, interest, assigned_to, last_contact, converted_student_id, source, notes
        FROM leads WHERE id = ?
      `).get(contact.lead_id)
    : null;

  // Profile enrichment (our app source of truth)
  const profile = contact.student_id
    ? db.prepare("SELECT * FROM student_profiles WHERE student_id = ?").get(contact.student_id)
    : contact.lead_id
      ? db.prepare("SELECT * FROM student_profiles WHERE lead_id = ?").get(contact.lead_id)
      : null;

  // Conversations (MM source of truth)
  const conversation = contact.mm_id
    ? db.prepare(`
        SELECT thread_id, message_count, inbound_count, outbound_count,
          has_replied, response_time_avg_hrs, last_message_at, first_message_at,
          last_inbound_at, last_outbound_at, workflow_touches, unread_count
        FROM mm_conversations WHERE contact_id = ?
        ORDER BY last_message_at DESC LIMIT 1
      `).get(contact.mm_id)
    : null;

  const recentMessages = contact.mm_id
    ? db.prepare(`
        SELECT direction, content, created_at, source
        FROM mm_messages WHERE contact_id = ?
        ORDER BY created_at DESC LIMIT 10
      `).all(contact.mm_id)
    : [];

  // Engagement breakdown
  const engagement = contact.engagement_score !== null
    ? {
        score: contact.engagement_score,
        components: {
          attendance: { score: contact.score_attendance },
          communication: { score: contact.score_communication },
          progression: { score: contact.score_progression },
          community: { score: contact.score_community },
          financial: { score: contact.score_financial },
        },
        risk_level: contact.risk_level,
        risk_factors: contact.risk_factors ? JSON.parse(contact.risk_factors) : [],
      }
    : null;

  // Knowledge map (if student)
  const knowledge = contact.student_id
    ? db.prepare(`
        SELECT t.category, GROUP_CONCAT(DISTINCT t.name) as techniques,
          COUNT(*) as exposure_count
        FROM attendance a
        JOIN classes cl ON cl.id = a.class_id
        JOIN lesson_techniques lt ON lt.lesson_plan_id = cl.lesson_plan_id
        JOIN techniques t ON t.id = lt.technique_id
        WHERE a.student_id = ?
        GROUP BY t.category
        ORDER BY exposure_count DESC
      `).all(contact.student_id)
    : null;

  // Attendance history (last 30 classes)
  const attendanceHistory = contact.student_id
    ? db.prepare(`
        SELECT a.checked_in_at as date, ct.name as class_type
        FROM attendance a
        JOIN classes cl ON cl.id = a.class_id
        LEFT JOIN class_types ct ON ct.id = cl.class_type_id
        WHERE a.student_id = ?
        ORDER BY a.checked_in_at DESC LIMIT 30
      `).all(contact.student_id)
    : null;

  // Household
  const household = db.prepare(`
    SELECT
      CASE
        WHEN h.parent_contact_id = ? THEN h.child_contact_id
        ELSE h.parent_contact_id
      END as contact_id,
      c2.first_name, c2.last_name,
      h.relationship,
      c2.contact_type,
      c2.engagement_score,
      c2.monthly_revenue,
      h.parent_is_student,
      h.detected_by
    FROM household_links h
    JOIN contacts c2 ON c2.id = CASE
      WHEN h.parent_contact_id = ? THEN h.child_contact_id
      ELSE h.parent_contact_id
    END
    WHERE h.parent_contact_id = ? OR h.child_contact_id = ?
  `).all(contactId, contactId, contactId, contactId);

  // Follow-ups (if lead)
  const followUps = contact.lead_id
    ? db.prepare(`
        SELECT type, message, sent_at, sent_by
        FROM follow_ups WHERE lead_id = ?
        ORDER BY sent_at DESC LIMIT 20
      `).all(contact.lead_id)
    : null;

  return {
    contact,
    student,
    lead,
    profile,
    conversation,
    recentMessages,
    engagement,
    knowledge,
    attendanceHistory,
    household,
    followUps,
  };
}

// ---- Win-Back Candidates ----

const CHILD_AGE_GROUPS = ["Tiny Ninjas", "Little Ninjas", "Teens"];

function isChildAgeGroup(ageGroup: string | null): boolean {
  return !!ageGroup && CHILD_AGE_GROUPS.includes(ageGroup);
}

function getRawWinBackCandidates(db: any, limit: number) {
  return db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone,
      c.contact_type, c.risk_level, c.engagement_score, c.monthly_revenue,
      c.risk_factors, c.age_group, c.student_id, c.zivvy_id, c.mm_id,
      s.belt_rank, s.stripes, s.last_attendance, s.start_date, s.monthly_rate,
      s.parent_name, s.parent_phone,
      COALESCE(s.total_classes, z.total_classes_taken) as total_classes,
      COALESCE(s.current_program, z.current_program) as current_program,
      z.current_rank,
      z.quit_date, z.last_attend as zivvy_last_attend,
      sp.quit_reason, sp.willing_to_return, sp.goals, sp.motivation,
      sp.injuries_concerns, sp.schedule_preference,
      CAST(JULIANDAY('now') - JULIANDAY(COALESCE(s.last_attendance, z.last_attend)) AS INTEGER) as days_absent,
      -- LTV: actual total collected from payments (real money in the door)
      -- Falls back to estimated LTV if total_collected not yet synced
      CASE
        WHEN s.total_collected IS NOT NULL AND s.total_collected > 0 THEN ROUND(s.total_collected, 0)
        WHEN s.monthly_rate IS NOT NULL AND s.start_date IS NOT NULL THEN
          ROUND(s.monthly_rate * MAX(1, (
            JULIANDAY(COALESCE(s.last_attendance, z.quit_date, 'now')) - JULIANDAY(s.start_date)
          ) / 30.44), 0)
        ELSE NULL
      END as ltv,
      -- Cost per class: LTV / total_classes
      CASE WHEN COALESCE(s.total_classes, z.total_classes_taken, 0) > 0 THEN
        ROUND(
          COALESCE(
            NULLIF(s.total_collected, 0),
            CASE WHEN s.monthly_rate IS NOT NULL AND s.start_date IS NOT NULL THEN
              s.monthly_rate * MAX(1, (
                JULIANDAY(COALESCE(s.last_attendance, z.quit_date, 'now')) - JULIANDAY(s.start_date)
              ) / 30.44)
            ELSE NULL END
          ) / COALESCE(s.total_classes, z.total_classes_taken),
        2)
      ELSE NULL END as cost_per_class,
      conv.last_message_at, conv.has_replied, conv.message_count as conv_message_count,
      conv.inbound_count, conv.outbound_count,
      COALESCE((
        SELECT COUNT(*) FROM household_links h
        WHERE h.parent_contact_id = c.id OR h.child_contact_id = c.id
      ), 0) as household_member_count,
      (SELECT COUNT(*) FROM winback_suggestions ws
       WHERE ws.contact_id = c.id AND ws.status IN ('suggested', 'approved')) as pending_suggestions
    FROM contacts c
    LEFT JOIN students s ON s.id = c.student_id
    LEFT JOIN zivvy_contacts z ON z.id = c.zivvy_id
    LEFT JOIN student_profiles sp ON sp.student_id = c.student_id
    LEFT JOIN mm_conversations conv ON conv.contact_id = c.mm_id
    WHERE (c.risk_level IN ('at_risk', 'ghost', 'churned')
           OR c.contact_type IN ('former_member', 'inactive_member'))
    ORDER BY
      CASE c.risk_level
        WHEN 'ghost' THEN 1
        WHEN 'at_risk' THEN 2
        WHEN 'churned' THEN 3
        ELSE 4
      END,
      c.monthly_revenue DESC NULLS LAST,
      COALESCE(s.last_attendance, z.last_attend) DESC NULLS LAST
    LIMIT ?
  `).all(limit).map((r: any) => ({
    ...r,
    risk_factors: r.risk_factors ? JSON.parse(r.risk_factors) : [],
  }));
}

/**
 * Household-aware win-back candidates.
 *
 * Children (Tiny Ninjas, Little Ninjas, Teens) are grouped under their parent.
 * The parent becomes the "recipient" and their absent children are listed as
 * `children[]` on the candidate object. Multiple siblings = one card, one message.
 *
 * Adults are returned as-is with `is_household: false`.
 */
export function getWinBackCandidates(limit = 40) {
  const db = getDb();
  const raw = getRawWinBackCandidates(db, limit);

  // Separate adults from children
  const adults: any[] = [];
  const children: any[] = [];
  for (const c of raw) {
    if (isChildAgeGroup(c.age_group)) {
      children.push(c);
    } else {
      adults.push(c);
    }
  }

  // For each child, find their parent contact via household_links
  // Group children by parent contact ID (or by fallback parent_name+parent_phone)
  const parentGroups = new Map<string, { parent: any; children: any[] }>();

  for (const child of children) {
    // Try to find parent contact via household_links
    const parentContact = db.prepare(`
      SELECT c.id, c.first_name, c.last_name, c.email, c.phone,
        c.contact_type, c.risk_level, c.mm_id, c.age_group,
        c.student_id, h.parent_is_student
      FROM household_links h
      JOIN contacts c ON c.id = h.parent_contact_id
      WHERE h.child_contact_id = ?
        AND (c.age_group IN ('Adults', 'Adult') OR c.age_group IS NULL OR c.age_group = '')
      LIMIT 1
    `).get(child.id) as any;

    if (parentContact) {
      const key = `contact:${parentContact.id}`;
      if (!parentGroups.has(key)) {
        // Get parent's conversation data for the message
        const parentConv = parentContact.mm_id
          ? db.prepare(`
              SELECT last_message_at, has_replied, message_count as conv_message_count,
                inbound_count, outbound_count
              FROM mm_conversations WHERE contact_id = ?
              ORDER BY last_message_at DESC LIMIT 1
            `).get(parentContact.mm_id)
          : null;

        parentGroups.set(key, {
          parent: {
            ...parentContact,
            ...(parentConv || {}),
            is_household: true,
            recipient_type: "parent_contact",
            parent_is_student: !!parentContact.parent_is_student || !!parentContact.student_id,
          },
          children: [],
        });
      }
      parentGroups.get(key)!.children.push(child);
    } else if (child.parent_name || child.parent_phone) {
      // Fallback: use parent_name/parent_phone from students table
      const fallbackKey = `fallback:${(child.parent_name || "").toLowerCase()}:${child.parent_phone || ""}`;
      if (!parentGroups.has(fallbackKey)) {
        // Parse parent name (might be comma-separated like "Crystal Kemp, Daniel Kemp")
        const parentNames = (child.parent_name || "Unknown Parent").split(",").map((n: string) => n.trim());
        const primaryParent = parentNames[0];
        const [firstName, ...lastParts] = primaryParent.split(" ");

        parentGroups.set(fallbackKey, {
          parent: {
            id: `fallback-${child.id}`,
            first_name: firstName || "Parent",
            last_name: lastParts.join(" ") || child.last_name,
            email: child.email,
            phone: child.parent_phone || child.phone,
            contact_type: "parent_fallback",
            risk_level: null,
            age_group: null,
            is_household: true,
            recipient_type: "parent_fallback",
            all_parent_names: parentNames,
          },
          children: [],
        });
      }
      parentGroups.get(fallbackKey)!.children.push(child);
    } else {
      // No parent info at all — treat as direct candidate but flag it
      adults.push({
        ...child,
        is_household: false,
        is_child_no_parent: true,
      });
    }
  }

  // Build the final list: household groups + adult individuals
  const grouped: any[] = [];

  for (const [, group] of parentGroups) {
    // Combine revenue at risk and LTV from all children
    const totalChildRevenue = group.children.reduce(
      (sum: number, c: any) => sum + (c.monthly_rate || c.monthly_revenue || 0), 0
    );
    const totalChildLtv = group.children.reduce(
      (sum: number, c: any) => sum + (c.ltv || 0), 0
    );

    // Worst risk level among children
    const riskPriority: Record<string, number> = { ghost: 1, at_risk: 2, churned: 3, cooling: 4 };
    const worstRisk = group.children.reduce((worst: string, c: any) => {
      const cp = riskPriority[c.risk_level] || 99;
      const wp = riskPriority[worst] || 99;
      return cp < wp ? c.risk_level : worst;
    }, "cooling");

    // Check for pending suggestions on ANY child in the group
    const pendingSuggestions = group.children.reduce(
      (sum: number, c: any) => sum + (c.pending_suggestions || 0), 0
    );

    grouped.push({
      ...group.parent,
      is_household: true,
      children: group.children.map((c: any) => ({
        id: c.id,
        zivvy_id: c.zivvy_id,
        first_name: c.first_name,
        last_name: c.last_name,
        age_group: c.age_group,
        belt_rank: c.belt_rank,
        stripes: c.stripes,
        current_program: c.current_program,
        total_classes: c.total_classes,
        days_absent: c.days_absent,
        last_attendance: c.last_attendance,
        risk_level: c.risk_level,
        risk_factors: c.risk_factors,
        monthly_rate: c.monthly_rate,
        ltv: c.ltv,
        cost_per_class: c.cost_per_class,
        quit_reason: c.quit_reason,
      })),
      household_child_count: group.children.length,
      household_revenue_at_risk: totalChildRevenue,
      household_ltv: totalChildLtv,
      risk_level: worstRisk,
      pending_suggestions: pendingSuggestions,
    });
  }

  // Mark adults as non-household
  const adultCandidates = adults.map((a: any) => ({
    ...a,
    is_household: a.is_household ?? false,
    children: null,
  }));

  // Merge and sort: household groups first (more revenue at risk), then adults
  const all = [...grouped, ...adultCandidates].sort((a, b) => {
    const riskOrder: Record<string, number> = { ghost: 1, at_risk: 2, churned: 3, cooling: 4 };
    const ra = riskOrder[a.risk_level] || 99;
    const rb = riskOrder[b.risk_level] || 99;
    if (ra !== rb) return ra - rb;
    // Households with more revenue at risk first
    const revA = a.household_revenue_at_risk || a.monthly_revenue || 0;
    const revB = b.household_revenue_at_risk || b.monthly_revenue || 0;
    return revB - revA;
  });

  return all.slice(0, limit);
}

export function createWinBackSuggestion(
  contactId: number,
  messageType: string,
  tone: string,
  body: string,
  contextSummary: string | null
) {
  const db = getDb();
  return db.prepare(
    "INSERT INTO winback_suggestions (contact_id, message_type, tone, body, context_summary) VALUES (?, ?, ?, ?, ?)"
  ).run(contactId, messageType, tone, body, contextSummary);
}

export function getActiveSuggestions() {
  const db = getDb();
  return db.prepare(`
    SELECT ws.*, c.first_name, c.last_name, c.phone, c.email,
      c.risk_level, c.monthly_revenue, c.contact_type
    FROM winback_suggestions ws
    JOIN contacts c ON c.id = ws.contact_id
    WHERE ws.status IN ('suggested', 'approved')
    ORDER BY ws.created_at DESC
  `).all();
}

export function updateWinBackSuggestionStatus(
  id: number,
  status: string,
  approvedBy?: string
) {
  const db = getDb();
  const extras: string[] = ["updated_at = datetime('now')"];
  const params: any[] = [status];

  if (status === 'sent') extras.push("sent_at = datetime('now')");
  if (status === 'dismissed') extras.push("dismissed_at = datetime('now')");
  if (approvedBy) { extras.push("approved_by = ?"); params.push(approvedBy); }
  params.push(id);

  return db.prepare(
    `UPDATE winback_suggestions SET status = ?, ${extras.join(", ")} WHERE id = ?`
  ).run(...params);
}

// ---- Risk Pipeline ----

export function getRetentionByRisk() {
  const db = getDb();

  const summary = db.prepare(`
    SELECT
      risk_level,
      COUNT(*) as count,
      COALESCE(SUM(monthly_revenue), 0) as revenue_at_risk,
      ROUND(AVG(engagement_score), 1) as avg_score
    FROM contacts
    WHERE contact_type = 'active_member' AND risk_level IS NOT NULL
    GROUP BY risk_level
  `).all() as Array<{
    risk_level: string;
    count: number;
    revenue_at_risk: number;
    avg_score: number;
  }>;

  const topAtRisk = db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.engagement_score, c.risk_level,
      c.risk_factors, c.monthly_revenue, c.age_group,
      s.last_attendance,
      CAST(JULIANDAY('now') - JULIANDAY(s.last_attendance) AS INTEGER) as days_absent
    FROM contacts c
    LEFT JOIN students s ON s.id = c.student_id
    WHERE c.contact_type = 'active_member'
      AND c.risk_level IN ('at_risk', 'ghost')
    ORDER BY c.monthly_revenue DESC, c.engagement_score ASC
    LIMIT 20
  `).all() as any[];

  const ghostMembers = db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.engagement_score,
      c.monthly_revenue, c.risk_factors,
      s.last_attendance,
      CAST(JULIANDAY('now') - JULIANDAY(s.last_attendance) AS INTEGER) as days_absent
    FROM contacts c
    LEFT JOIN students s ON s.id = c.student_id
    WHERE c.contact_type = 'active_member' AND c.risk_level = 'ghost'
    ORDER BY c.monthly_revenue DESC
  `).all() as any[];

  const coolingMembers = db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.engagement_score,
      c.monthly_revenue, c.risk_factors,
      s.last_attendance,
      CAST(JULIANDAY('now') - JULIANDAY(s.last_attendance) AS INTEGER) as days_absent
    FROM contacts c
    LEFT JOIN students s ON s.id = c.student_id
    WHERE c.contact_type = 'active_member' AND c.risk_level = 'cooling'
    ORDER BY c.engagement_score ASC
    LIMIT 20
  `).all() as any[];

  return {
    summary,
    topAtRisk: topAtRisk.map((r: any) => ({
      ...r,
      risk_factors: r.risk_factors ? JSON.parse(r.risk_factors) : [],
    })),
    ghostMembers: ghostMembers.map((r: any) => ({
      ...r,
      risk_factors: r.risk_factors ? JSON.parse(r.risk_factors) : [],
    })),
    coolingMembers: coolingMembers.map((r: any) => ({
      ...r,
      risk_factors: r.risk_factors ? JSON.parse(r.risk_factors) : [],
    })),
    totalRevenueAtRisk: summary
      .filter((s) => ["at_risk", "ghost"].includes(s.risk_level))
      .reduce((sum, s) => sum + s.revenue_at_risk, 0),
  };
}

// ---- Dashboard Needs Attention Widget ----

export function getNeedsAttention() {
  const db = getDb();

  const distribution = db.prepare(`
    SELECT
      COALESCE(risk_level, 'unscored') as risk_level,
      COUNT(*) as count
    FROM contacts
    WHERE contact_type = 'active_member'
    GROUP BY risk_level
  `).all() as Array<{ risk_level: string; count: number }>;

  const dist: Record<string, number> = {};
  for (const row of distribution) {
    dist[row.risk_level] = row.count;
  }

  const revenueAtRisk = (db.prepare(`
    SELECT COALESCE(SUM(monthly_revenue), 0) as total
    FROM contacts
    WHERE contact_type = 'active_member' AND risk_level IN ('at_risk', 'ghost')
  `).get() as any).total;

  const topAtRisk = db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.engagement_score, c.risk_level,
      c.risk_factors, c.monthly_revenue,
      s.last_attendance,
      CAST(JULIANDAY('now') - JULIANDAY(s.last_attendance) AS INTEGER) as days_absent
    FROM contacts c
    LEFT JOIN students s ON s.id = c.student_id
    WHERE c.contact_type = 'active_member'
      AND c.risk_level IN ('at_risk', 'ghost', 'cooling')
    ORDER BY
      CASE c.risk_level WHEN 'ghost' THEN 1 WHEN 'at_risk' THEN 2 WHEN 'cooling' THEN 3 END,
      c.monthly_revenue DESC
    LIMIT 10
  `).all() as any[];

  const lastScoredAt = (db.prepare(`
    SELECT MAX(scored_at) as last FROM contacts WHERE scored_at IS NOT NULL
  `).get() as any)?.last;

  const avgScore = (db.prepare(`
    SELECT ROUND(AVG(engagement_score), 1) as avg
    FROM contacts WHERE contact_type = 'active_member' AND engagement_score IS NOT NULL
  `).get() as any)?.avg;

  return {
    atRiskCount: dist["at_risk"] || 0,
    ghostCount: dist["ghost"] || 0,
    coolingCount: dist["cooling"] || 0,
    healthyCount: dist["healthy"] || 0,
    revenueAtRisk,
    scoreDistribution: dist,
    topAtRisk: topAtRisk.map((r: any) => ({
      ...r,
      risk_factors: r.risk_factors ? JSON.parse(r.risk_factors) : [],
    })),
    lastScoredAt,
    avgScore,
  };
}

// ---- Cost-Per-Class Trends ----

export interface MonthlyTrend {
  month: string;      // "2026-03"
  paid: number;
  classes: number;
  cost_per_class: number | null;
}

export interface CostTrendResult {
  months: MonthlyTrend[];
  recent_cpc: number | null;   // avg cost/class last 3 months
  prior_cpc: number | null;    // avg cost/class 3-6 months ago
  trend_pct: number | null;    // % change (positive = getting worse)
}

/**
 * Get monthly cost-per-class trend for a single student (by zivvy_id).
 * Returns up to 12 months of data plus a trend summary.
 */
export function getCostTrend(zivvyId: number): CostTrendResult {
  const db = getDb();

  const months = db.prepare(`
    WITH months AS (
      SELECT DISTINCT month FROM (
        SELECT strftime('%Y-%m', date_processed) as month FROM zivvy_payments WHERE contact_id = ?
        UNION
        SELECT strftime('%Y-%m', parsed_date) as month FROM zivvy_attendance_log WHERE contact_id = ?
      )
    ),
    mp AS (
      SELECT strftime('%Y-%m', date_processed) as month, SUM(amount) as paid
      FROM zivvy_payments WHERE contact_id = ?
      GROUP BY month
    ),
    ma AS (
      SELECT strftime('%Y-%m', parsed_date) as month, COUNT(*) as classes
      FROM zivvy_attendance_log WHERE contact_id = ?
      GROUP BY month
    )
    SELECT m.month,
      COALESCE(mp.paid, 0) as paid,
      COALESCE(ma.classes, 0) as classes,
      CASE WHEN COALESCE(ma.classes, 0) > 0
        THEN ROUND(COALESCE(mp.paid, 0) * 1.0 / ma.classes, 2)
        ELSE NULL
      END as cost_per_class
    FROM months m
    LEFT JOIN mp ON mp.month = m.month
    LEFT JOIN ma ON ma.month = m.month
    ORDER BY m.month DESC
    LIMIT 12
  `).all(zivvyId, zivvyId, zivvyId, zivvyId) as MonthlyTrend[];

  // Compute trend: compare last 3 months vs prior 3 months
  const reversed = [...months].reverse(); // chronological order
  const recent = reversed.slice(-3).filter(m => m.cost_per_class != null);
  const prior = reversed.slice(-6, -3).filter(m => m.cost_per_class != null);

  const recentCpc = recent.length > 0
    ? Math.round(recent.reduce((s, m) => s + m.cost_per_class!, 0) / recent.length * 100) / 100
    : null;
  const priorCpc = prior.length > 0
    ? Math.round(prior.reduce((s, m) => s + m.cost_per_class!, 0) / prior.length * 100) / 100
    : null;
  const trendPct = recentCpc != null && priorCpc != null && priorCpc > 0
    ? Math.round(((recentCpc - priorCpc) / priorCpc) * 100)
    : null;

  return { months, recent_cpc: recentCpc, prior_cpc: priorCpc, trend_pct: trendPct };
}

/**
 * Bulk fetch cost trends for multiple zivvy IDs.
 */
export function getCostTrendsBulk(zivvyIds: number[]): Map<number, CostTrendResult> {
  const results = new Map<number, CostTrendResult>();
  for (const id of zivvyIds) {
    const trend = getCostTrend(id);
    if (trend.months.length > 0) {
      results.set(id, trend);
    }
  }
  return results;
}
