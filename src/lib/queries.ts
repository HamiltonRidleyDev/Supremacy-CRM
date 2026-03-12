import { getDb } from "./db";

// ---- Dashboard Stats ----

export function getDashboardStats() {
  const db = getDb();

  const activeMembers = db.prepare(
    "SELECT COUNT(*) as count FROM students WHERE membership_status = 'active'"
  ).get() as { count: number };

  const formerMembers = db.prepare(
    "SELECT COUNT(*) as count FROM students WHERE membership_status = 'inactive'"
  ).get() as { count: number };

  const totalLeads = db.prepare(
    "SELECT COUNT(*) as count FROM leads WHERE zivvy_id IS NOT NULL"
  ).get() as { count: number };

  const openLeads = db.prepare(
    "SELECT COUNT(*) as count FROM leads WHERE status IN ('new', 'contacted', 'trial_booked')"
  ).get() as { count: number };

  const monthlyRevenue = db.prepare(
    "SELECT COALESCE(SUM(monthly_rate), 0) as total FROM students WHERE membership_status = 'active' AND monthly_rate IS NOT NULL"
  ).get() as { total: number };

  const lessonPlansThisMonth = db.prepare(
    "SELECT COUNT(*) as count FROM lesson_plans WHERE created_at >= date('now', 'start of month')"
  ).get() as { count: number };

  // New enrollments this month (by contract sign date or entered date)
  const newThisMonth = db.prepare(
    "SELECT COUNT(*) as count FROM students WHERE membership_status = 'active' AND date_added >= date('now', 'start of month')"
  ).get() as { count: number };

  return {
    activeMembers: activeMembers.count,
    formerMembers: formerMembers.count,
    totalLeads: totalLeads.count,
    openLeads: openLeads.count,
    monthlyRevenue: monthlyRevenue.total,
    lessonPlansThisMonth: lessonPlansThisMonth.count,
    newThisMonth: newThisMonth.count,
  };
}

/** Age group distribution of active students */
export function getAgeGroupDistribution() {
  const db = getDb();
  return db.prepare(`
    SELECT COALESCE(age_group, 'Unknown') as age_group, COUNT(*) as count
    FROM students WHERE membership_status = 'active'
    GROUP BY age_group ORDER BY count DESC
  `).all() as Array<{ age_group: string; count: number }>;
}

/** Lead source breakdown across all contacts */
export function getLeadSourceDistribution() {
  const db = getDb();
  return db.prepare(`
    SELECT COALESCE(source, 'Unknown') as source, COUNT(*) as count
    FROM students WHERE membership_status = 'active' AND zivvy_id IS NOT NULL
    GROUP BY source ORDER BY count DESC
  `).all() as Array<{ source: string; count: number }>;
}

/** Prospect pipeline stages */
export function getProspectPipeline() {
  const db = getDb();
  return db.prepare(`
    SELECT COALESCE(prospect_stage, 'Unknown') as stage, COUNT(*) as count
    FROM zivvy_contacts WHERE contact_type = 'P'
    GROUP BY prospect_stage ORDER BY count DESC
  `).all() as Array<{ stage: string; count: number }>;
}

/** New student enrollments by month (last 12 months) */
export function getEnrollmentTrend() {
  const db = getDb();
  return db.prepare(`
    SELECT strftime('%Y-%m', date_added) as month, COUNT(*) as count
    FROM students
    WHERE zivvy_id IS NOT NULL AND date_added IS NOT NULL
      AND date_added >= date('now', '-12 months')
    GROUP BY month ORDER BY month ASC
  `).all() as Array<{ month: string; count: number }>;
}

/** Recently departed former members — win-back targets */
export function getWinBackTargets(days = 90) {
  const db = getDb();
  return db.prepare(`
    SELECT id, first_name, last_name, age_group, source, quit_date, email, phone
    FROM zivvy_contacts
    WHERE contact_type = 'F' AND quit_date IS NOT NULL
      AND quit_date >= date('now', '-' || ? || ' days')
    ORDER BY quit_date DESC
    LIMIT 15
  `).all(days) as Array<{
    id: number; first_name: string; last_name: string;
    age_group: string; source: string; quit_date: string;
    email: string; phone: string;
  }>;
}

/** Top cities for active students */
export function getGeographicBreakdown() {
  const db = getDb();
  return db.prepare(`
    SELECT COALESCE(city, 'Unknown') as city, COUNT(*) as count
    FROM students
    WHERE membership_status = 'active' AND zivvy_id IS NOT NULL
      AND city IS NOT NULL AND city != ''
    GROUP BY LOWER(TRIM(city)) ORDER BY count DESC LIMIT 8
  `).all() as Array<{ city: string; count: number }>;
}

/** Zip code distribution for active students (for bubble map) */
export function getZipDistribution() {
  const db = getDb();
  return db.prepare(`
    SELECT zip, COUNT(*) as count
    FROM students
    WHERE membership_status = 'active' AND zivvy_id IS NOT NULL
      AND zip IS NOT NULL AND zip != ''
    GROUP BY zip ORDER BY count DESC
  `).all() as Array<{ zip: string; count: number }>;
}

/**
 * Compute actionable business insights from the data we have.
 * Each insight has a headline, detail, severity, and suggested action.
 */
export function getBusinessInsights() {
  const db = getDb();
  const insights: Array<{
    id: string;
    category: "growth" | "retention" | "leads" | "operations";
    severity: "critical" | "warning" | "positive" | "info";
    headline: string;
    detail: string;
    action: string;
    metric?: string;
  }> = [];

  // --- RETENTION INSIGHTS ---

  const active = (db.prepare("SELECT COUNT(*) as c FROM students WHERE membership_status='active' AND zivvy_id IS NOT NULL").get() as { c: number }).c;
  const former = (db.prepare("SELECT COUNT(*) as c FROM students WHERE membership_status='inactive' AND zivvy_id IS NOT NULL").get() as { c: number }).c;

  // Churn ratio
  const churnRatio = former / (active + former);
  if (churnRatio > 0.8) {
    insights.push({
      id: "high-churn-ratio",
      category: "retention",
      severity: "critical",
      headline: `For every 1 active student, ${(former / active).toFixed(1)} have left`,
      detail: `${active} active vs ${former.toLocaleString()} former members since 2017. This is normal for a gym open 9+ years, but means retention work has the biggest ROI of anything you can do.`,
      action: "The AI re-engagement system will address this — personalized outreach to at-risk students before they quit.",
      metric: `${Math.round(churnRatio * 100)}% lifetime churn`,
    });
  }

  // Recent departures (win-back opportunity)
  const recentQuits = (db.prepare(`
    SELECT COUNT(*) as c FROM zivvy_contacts
    WHERE contact_type='F' AND quit_date IS NOT NULL AND quit_date >= date('now', '-90 days')
  `).get() as { c: number }).c;

  if (recentQuits > 0) {
    const estLostRevenue = recentQuits * 150; // Estimate $150/mo avg
    insights.push({
      id: "winback-opportunity",
      category: "retention",
      severity: "warning",
      headline: `${recentQuits} members left in the last 90 days`,
      detail: `That's roughly $${estLostRevenue.toLocaleString()}/mo in lost revenue. These people already know Supremacy — they're far easier to win back than converting a cold lead.`,
      action: "Review the win-back list below. A personal text from Rodrigo could bring several back.",
      metric: `~$${estLostRevenue.toLocaleString()}/mo lost`,
    });
  }

  // --- GROWTH INSIGHTS ---

  // Enrollment velocity
  const recentMonths = db.prepare(`
    SELECT strftime('%Y-%m', date_added) as month, COUNT(*) as c
    FROM students WHERE zivvy_id IS NOT NULL AND date_added IS NOT NULL
      AND date_added >= date('now', '-6 months')
    GROUP BY month ORDER BY month ASC
  `).all() as Array<{ month: string; c: number }>;

  if (recentMonths.length >= 3) {
    const lastThree = recentMonths.slice(-3);
    const priorThree = recentMonths.slice(0, Math.min(3, recentMonths.length - 3));
    const recentAvg = lastThree.reduce((s, m) => s + m.c, 0) / lastThree.length;
    const priorAvg = priorThree.length > 0 ? priorThree.reduce((s, m) => s + m.c, 0) / priorThree.length : recentAvg;

    if (recentAvg < priorAvg * 0.8) {
      insights.push({
        id: "enrollment-slowing",
        category: "growth",
        severity: "warning",
        headline: `New enrollments are down ${Math.round((1 - recentAvg / priorAvg) * 100)}% vs prior period`,
        detail: `Averaging ${recentAvg.toFixed(1)} new students/month lately vs ${priorAvg.toFixed(1)} before. ${lastThree[lastThree.length - 1]?.month} has ${lastThree[lastThree.length - 1]?.c} so far.`,
        action: "Check if lead flow from the website has also dropped, or if it's a conversion problem (leads coming in but not signing up).",
        metric: `${recentAvg.toFixed(1)}/mo avg`,
      });
    } else if (recentAvg > priorAvg * 1.1) {
      insights.push({
        id: "enrollment-growing",
        category: "growth",
        severity: "positive",
        headline: `Enrollments up ${Math.round((recentAvg / priorAvg - 1) * 100)}% vs prior period`,
        detail: `Averaging ${recentAvg.toFixed(1)} new students/month. Momentum is positive.`,
        action: "Keep doing what's working. Make sure onboarding is solid so these new students stick.",
        metric: `${recentAvg.toFixed(1)}/mo avg`,
      });
    }
  }

  // --- LEAD FUNNEL INSIGHTS ---

  const totalLeads = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE zivvy_id IS NOT NULL").get() as { c: number }).c;
  const conversionRate = active / (totalLeads + active + former);

  insights.push({
    id: "funnel-conversion",
    category: "leads",
    severity: conversionRate < 0.03 ? "critical" : conversionRate < 0.05 ? "warning" : "positive",
    headline: `Overall lead-to-member conversion: ${(conversionRate * 100).toFixed(1)}%`,
    detail: `${totalLeads.toLocaleString()} total leads have come through since 2017, and ${active} are currently active. Industry benchmark for martial arts is 3-5%.`,
    action: conversionRate < 0.03
      ? "The bottleneck is converting leads into trial visits. Kyle's follow-up speed and the trial experience are the levers."
      : "Conversion is healthy. Focus on increasing lead volume and retention.",
    metric: `${(conversionRate * 100).toFixed(1)}%`,
  });

  // Stale pipeline
  const callPhase = (db.prepare("SELECT COUNT(*) as c FROM zivvy_contacts WHERE contact_type='P' AND prospect_stage='Call Phase'").get() as { c: number }).c;
  if (callPhase > 100) {
    const daysToCall = Math.ceil(callPhase / 20); // Assume 20 calls/day
    insights.push({
      id: "stale-pipeline",
      category: "leads",
      severity: "warning",
      headline: `${callPhase.toLocaleString()} leads sitting in "Call Phase"`,
      detail: `At 20 calls/day, it would take Kyle ${daysToCall} business days to reach all of them. Most of these are stale — leads from months or years ago.`,
      action: "Don't try to call all 3,000+. Filter to leads from the last 30 days and prioritize those. Older leads should get an automated email/text reactivation campaign.",
      metric: `${daysToCall} days to clear`,
    });
  }

  // Lead source concentration
  const topSource = db.prepare(`
    SELECT source, COUNT(*) as c FROM students
    WHERE membership_status='active' AND zivvy_id IS NOT NULL AND source IS NOT NULL
    GROUP BY source ORDER BY c DESC LIMIT 1
  `).get() as { source: string; c: number } | undefined;

  if (topSource && active > 0) {
    const pct = Math.round((topSource.c / active) * 100);
    if (pct > 50) {
      insights.push({
        id: "source-concentration",
        category: "leads",
        severity: "info",
        headline: `${pct}% of active students came from ${topSource.source}`,
        detail: `${topSource.source} is your #1 channel by far. Organic search and your Google Business profile are working. The old $2,500/mo ad spend was likely unnecessary.`,
        action: "Keep investing in Google Business reviews and website SEO. Consider a referral incentive program — referrals are only 7% of students but convert at a much higher rate.",
        metric: `${pct}% from ${topSource.source}`,
      });
    }
  }

  // --- KIDS PROGRAM INSIGHT ---
  const kids = (db.prepare("SELECT COUNT(*) as c FROM students WHERE membership_status='active' AND zivvy_id IS NOT NULL AND (age_group='Tiny Ninjas' OR age_group='Little Ninjas')").get() as { c: number }).c;
  const teens = (db.prepare("SELECT COUNT(*) as c FROM students WHERE membership_status='active' AND zivvy_id IS NOT NULL AND age_group='Teens'").get() as { c: number }).c;

  if (kids > 0 && teens < kids * 0.15) {
    insights.push({
      id: "teen-gap",
      category: "operations",
      severity: "info",
      headline: `${kids} kids enrolled but only ${teens} teens — where do they go?`,
      detail: `Tiny + Little Ninjas make up ${Math.round((kids / active) * 100)}% of the roster. But teens are only ${teens}. There's a drop-off when kids age up — are they quitting or is there no compelling teen program?`,
      action: "This is a retention and upsell opportunity. A dedicated teen program or bridge class could capture students who'd otherwise leave at 12-13.",
    });
  }

  return insights;
}

// ---- Strategic KPIs (time-series) ----

export interface MonthlyKPI {
  month: string;
  newLeads: number;
  newStudents: number;
  churns: number;
  netGrowth: number;
  conversionRate: number;
}

export interface StrategicKPIs {
  monthly: MonthlyKPI[];
  current: { leadsPerMonth: number; studentsPerMonth: number; churnsPerMonth: number; conversionRate: number; netGrowthPerMonth: number };
  prior: { leadsPerMonth: number; studentsPerMonth: number; churnsPerMonth: number; conversionRate: number; netGrowthPerMonth: number };
}

export function getStrategicKPIs(): StrategicKPIs {
  const db = getDb();

  // New leads by month (prospects entering the system)
  const leadsByMonth = db.prepare(`
    SELECT strftime('%Y-%m', date_contact_added) as month, COUNT(*) as count
    FROM zivvy_contacts
    WHERE contact_type = 'P' AND date_contact_added IS NOT NULL
      AND date_contact_added >= date('now', '-24 months')
    GROUP BY month ORDER BY month ASC
  `).all() as Array<{ month: string; count: number }>;

  // New students by month (enrolled)
  const studentsByMonth = db.prepare(`
    SELECT strftime('%Y-%m', date_contact_added) as month, COUNT(*) as count
    FROM zivvy_contacts
    WHERE contact_type = 'S' AND date_contact_added IS NOT NULL
      AND date_contact_added >= date('now', '-24 months')
    GROUP BY month ORDER BY month ASC
  `).all() as Array<{ month: string; count: number }>;

  // Churns by month (quit dates)
  const churnsByMonth = db.prepare(`
    SELECT strftime('%Y-%m', quit_date) as month, COUNT(*) as count
    FROM zivvy_contacts
    WHERE contact_type = 'F' AND quit_date IS NOT NULL
      AND quit_date >= date('now', '-24 months')
    GROUP BY month ORDER BY month ASC
  `).all() as Array<{ month: string; count: number }>;

  // Build a unified month array for the last 24 months
  const leadsMap = Object.fromEntries(leadsByMonth.map(r => [r.month, r.count]));
  const studentsMap = Object.fromEntries(studentsByMonth.map(r => [r.month, r.count]));
  const churnsMap = Object.fromEntries(churnsByMonth.map(r => [r.month, r.count]));

  const months: string[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const monthly: MonthlyKPI[] = months.map(month => {
    const newLeads = leadsMap[month] || 0;
    const newStudents = studentsMap[month] || 0;
    const churns = churnsMap[month] || 0;
    return {
      month,
      newLeads,
      newStudents,
      churns,
      netGrowth: newStudents - churns,
      conversionRate: newLeads > 0 ? Math.round((newStudents / newLeads) * 1000) / 10 : 0,
    };
  });

  // Trailing 3-month averages (current vs prior)
  const last3 = monthly.slice(-3);
  const prior3 = monthly.slice(-6, -3);

  function avg(arr: MonthlyKPI[], key: keyof MonthlyKPI): number {
    if (arr.length === 0) return 0;
    return arr.reduce((s, m) => s + (m[key] as number), 0) / arr.length;
  }

  function aggConversion(arr: MonthlyKPI[]): number {
    const totalLeads = arr.reduce((s, m) => s + m.newLeads, 0);
    const totalStudents = arr.reduce((s, m) => s + m.newStudents, 0);
    return totalLeads > 0 ? Math.round((totalStudents / totalLeads) * 1000) / 10 : 0;
  }

  return {
    monthly,
    current: {
      leadsPerMonth: Math.round(avg(last3, 'newLeads') * 10) / 10,
      studentsPerMonth: Math.round(avg(last3, 'newStudents') * 10) / 10,
      churnsPerMonth: Math.round(avg(last3, 'churns') * 10) / 10,
      conversionRate: aggConversion(last3),
      netGrowthPerMonth: Math.round(avg(last3, 'netGrowth') * 10) / 10,
    },
    prior: {
      leadsPerMonth: Math.round(avg(prior3, 'newLeads') * 10) / 10,
      studentsPerMonth: Math.round(avg(prior3, 'newStudents') * 10) / 10,
      churnsPerMonth: Math.round(avg(prior3, 'churns') * 10) / 10,
      conversionRate: aggConversion(prior3),
      netGrowthPerMonth: Math.round(avg(prior3, 'netGrowth') * 10) / 10,
    },
  };
}

/** Revenue model unit economics data */
export function getRevenueModelData() {
  const db = getDb();

  // Average lifetime of former members (months)
  const lifetimeResult = db.prepare(`
    SELECT AVG(julianday(quit_date) - julianday(date_contact_added)) / 30.0 as avg_months
    FROM zivvy_contacts
    WHERE contact_type = 'F' AND quit_date IS NOT NULL AND date_contact_added IS NOT NULL
      AND julianday(quit_date) > julianday(date_contact_added)
  `).get() as { avg_months: number };

  // Current active count
  const active = (db.prepare(
    "SELECT COUNT(*) as c FROM zivvy_contacts WHERE contact_type = 'S'"
  ).get() as { c: number }).c;

  // Recent 6-month conversion rate
  const recent6mo = db.prepare(`
    SELECT
      SUM(CASE WHEN contact_type = 'P' THEN 1 ELSE 0 END) as leads,
      SUM(CASE WHEN contact_type = 'S' THEN 1 ELSE 0 END) as students
    FROM zivvy_contacts
    WHERE date_contact_added >= date('now', '-6 months') AND date_contact_added IS NOT NULL
  `).get() as { leads: number; students: number };

  // Recent 6-month churn count
  const recentChurns = (db.prepare(`
    SELECT COUNT(*) as c FROM zivvy_contacts
    WHERE contact_type = 'F' AND quit_date IS NOT NULL AND quit_date >= date('now', '-6 months')
  `).get() as { c: number }).c;

  // Recent 3-month numbers for current pace
  const recent3mo = db.prepare(`
    SELECT
      SUM(CASE WHEN contact_type = 'P' THEN 1 ELSE 0 END) as leads,
      SUM(CASE WHEN contact_type = 'S' THEN 1 ELSE 0 END) as students
    FROM zivvy_contacts
    WHERE date_contact_added >= date('now', '-3 months') AND date_contact_added IS NOT NULL
  `).get() as { leads: number; students: number };

  const churns3mo = (db.prepare(`
    SELECT COUNT(*) as c FROM zivvy_contacts
    WHERE contact_type = 'F' AND quit_date IS NOT NULL AND quit_date >= date('now', '-3 months')
  `).get() as { c: number }).c;

  const conversionRate6mo = recent6mo.leads > 0
    ? Math.round((recent6mo.students / recent6mo.leads) * 1000) / 10
    : 0;

  const monthlyChurnRate = active > 0
    ? Math.round((recentChurns / 6 / active) * 1000) / 10
    : 0;

  return {
    avgLifetimeMonths: Math.round(lifetimeResult.avg_months * 10) / 10,
    currentActive: active,
    conversionRate6mo,
    monthlyChurnRate,
    currentLeadsPerMonth: Math.round((recent3mo.leads / 3) * 10) / 10,
    currentStudentsPerMonth: Math.round((recent3mo.students / 3) * 10) / 10,
    currentChurnsPerMonth: Math.round((churns3mo / 3) * 10) / 10,
  };
}

/** Names of new students grouped by month (last 12 months) for KPI tooltips */
export function getMonthlyNewStudentNames() {
  const db = getDb();
  return db.prepare(`
    SELECT strftime('%Y-%m', date_contact_added) as month, first_name, last_name
    FROM zivvy_contacts
    WHERE contact_type = 'S' AND date_contact_added IS NOT NULL
      AND date_contact_added >= date('now', '-12 months')
    ORDER BY month, last_name
  `).all() as Array<{ month: string; first_name: string; last_name: string }>;
}

/** Names of churned members grouped by month (last 12 months) for KPI tooltips */
export function getMonthlyChurnNames() {
  const db = getDb();
  return db.prepare(`
    SELECT strftime('%Y-%m', quit_date) as month, first_name, last_name
    FROM zivvy_contacts
    WHERE contact_type = 'F' AND quit_date IS NOT NULL
      AND quit_date >= date('now', '-12 months')
    ORDER BY month, last_name
  `).all() as Array<{ month: string; first_name: string; last_name: string }>;
}

// ---- Attendance / Student Knowledge ----

export function getStudentKnowledgeMap(studentId: number) {
  const db = getDb();

  // All techniques this student has been exposed to (via attending classes with lesson plans)
  const exposed = db.prepare(`
    SELECT t.id, t.name, t.category, t.subcategory, t.belt_level,
           COUNT(DISTINCT c.id) as times_exposed,
           MAX(c.date) as last_exposed
    FROM attendance a
    JOIN classes c ON a.class_id = c.id
    JOIN lesson_plans lp ON c.lesson_plan_id = lp.id
    JOIN lesson_techniques lt ON lt.lesson_plan_id = lp.id
    JOIN techniques t ON lt.technique_id = t.id
    WHERE a.student_id = ?
    GROUP BY t.id
    ORDER BY t.category, t.name
  `).all(studentId);

  // All techniques in the curriculum
  const allTechniques = db.prepare(
    "SELECT id, name, category, subcategory, belt_level FROM techniques ORDER BY category, name"
  ).all();

  return { exposed, allTechniques };
}

export function getStudentAttendanceHistory(studentId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT c.date, c.start_time, ct.name as class_type, c.instructor,
           lp.title as lesson_title, lp.position_area
    FROM attendance a
    JOIN classes c ON a.class_id = c.id
    JOIN class_types ct ON c.class_type_id = ct.id
    LEFT JOIN lesson_plans lp ON c.lesson_plan_id = lp.id
    WHERE a.student_id = ?
    ORDER BY c.date DESC
  `).all(studentId);
}

export function getStudents() {
  const db = getDb();
  return db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM attendance a JOIN classes c ON a.class_id = c.id
       WHERE a.student_id = s.id AND c.date >= date('now', '-30 days')) as classes_last_30_days,
      (SELECT COUNT(*) FROM attendance WHERE student_id = s.id) as total_classes,
      c.engagement_score,
      c.risk_level,
      c.risk_factors,
      c.score_attendance,
      -- Cost per class from actual payments
      CASE WHEN COALESCE(s.total_collected, 0) > 0 AND
           COALESCE((SELECT COUNT(*) FROM attendance WHERE student_id = s.id), 0) > 0
        THEN ROUND(s.total_collected * 1.0 / (SELECT COUNT(*) FROM attendance WHERE student_id = s.id), 2)
        ELSE NULL
      END as cost_per_class,
      COALESCE(s.total_collected, 0) as ltv,
      -- Household info
      (SELECT GROUP_CONCAT(c2.first_name || ' ' || c2.last_name, ', ')
       FROM household_links h
       JOIN contacts c2 ON c2.id = CASE
         WHEN h.parent_contact_id = c.id THEN h.child_contact_id
         ELSE h.parent_contact_id
       END
       WHERE h.parent_contact_id = c.id OR h.child_contact_id = c.id
      ) as household_names,
      (SELECT COUNT(*) FROM household_links h
       WHERE h.parent_contact_id = c.id OR h.child_contact_id = c.id
      ) as household_size
    FROM students s
    LEFT JOIN contacts c ON c.student_id = s.id
    ORDER BY s.membership_status ASC, s.last_name ASC
  `).all();
}

/** Lead-to-student conversion funnel by month */
export function getLeadConversionFunnel() {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', l.created_at) as month,
      COUNT(*) as total_leads,
      SUM(CASE WHEN l.status IN ('contacted', 'trial_booked', 'trial_attended', 'signed_up') THEN 1 ELSE 0 END) as contacted,
      SUM(CASE WHEN l.status IN ('trial_booked', 'trial_attended', 'signed_up') THEN 1 ELSE 0 END) as trial_booked,
      SUM(CASE WHEN l.status IN ('trial_attended', 'signed_up') THEN 1 ELSE 0 END) as trial_attended,
      SUM(CASE WHEN l.status = 'signed_up' THEN 1 ELSE 0 END) as signed_up,
      SUM(CASE WHEN l.status = 'lost' THEN 1 ELSE 0 END) as lost
    FROM leads l
    WHERE l.created_at >= date('now', '-12 months')
      AND l.zivvy_id IS NOT NULL
    GROUP BY month
    ORDER BY month ASC
  `).all() as Array<{
    month: string;
    total_leads: number;
    contacted: number;
    trial_booked: number;
    trial_attended: number;
    signed_up: number;
    lost: number;
  }>;
}

// ---- Curriculum Gaps ----

export function getCurriculumCoverage() {
  const db = getDb();

  return db.prepare(`
    SELECT t.id, t.name, t.category, t.subcategory, t.belt_level,
           COUNT(DISTINCT lp.id) as times_taught,
           MAX(c.date) as last_taught,
           CASE
             WHEN MAX(c.date) IS NULL THEN 'never'
             WHEN MAX(c.date) < date('now', '-90 days') THEN 'stale'
             WHEN MAX(c.date) < date('now', '-30 days') THEN 'aging'
             ELSE 'recent'
           END as freshness
    FROM techniques t
    LEFT JOIN lesson_techniques lt ON lt.technique_id = t.id
    LEFT JOIN lesson_plans lp ON lt.lesson_plan_id = lp.id
    LEFT JOIN classes c ON c.lesson_plan_id = lp.id
    GROUP BY t.id
    ORDER BY
      CASE
        WHEN MAX(c.date) IS NULL THEN 0
        WHEN MAX(c.date) < date('now', '-90 days') THEN 1
        WHEN MAX(c.date) < date('now', '-30 days') THEN 2
        ELSE 3
      END,
      t.category, t.name
  `).all();
}

// ---- Leads / CRM ----

export function getLeads() {
  const db = getDb();
  return db.prepare(`
    SELECT l.*,
      (SELECT COUNT(*) FROM follow_ups WHERE lead_id = l.id) as follow_up_count
    FROM leads l
    ORDER BY
      CASE l.status
        WHEN 'new' THEN 0
        WHEN 'contacted' THEN 1
        WHEN 'trial_booked' THEN 2
        WHEN 'trial_attended' THEN 3
        WHEN 'signed_up' THEN 4
        WHEN 'lost' THEN 5
      END,
      l.created_at DESC
  `).all();
}

// ---- Recent Classes & Attendance ----

export function getRecentClasses(limit = 10) {
  const db = getDb();
  return db.prepare(`
    SELECT c.id, c.date, c.start_time, c.instructor,
           ct.name as class_type,
           lp.title as lesson_title, lp.position_area,
           (SELECT COUNT(*) FROM attendance WHERE class_id = c.id) as attendance_count
    FROM classes c
    JOIN class_types ct ON c.class_type_id = ct.id
    LEFT JOIN lesson_plans lp ON c.lesson_plan_id = lp.id
    ORDER BY c.date DESC, c.start_time DESC
    LIMIT ?
  `).all(limit);
}

export function getClassAttendees(classId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT s.id, s.first_name, s.last_name, s.belt_rank, s.stripes
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.class_id = ?
    ORDER BY s.last_name
  `).all(classId);
}

// ---- Churn / Retention ----

export function getRetentionMetrics() {
  const db = getDb();

  const atRisk = db.prepare(`
    SELECT s.id, s.first_name, s.last_name, s.belt_rank, s.membership_status,
           s.last_attendance,
           julianday('now') - julianday(s.last_attendance) as days_since_last
    FROM students s
    WHERE s.membership_status = 'active'
      AND s.last_attendance < date('now', '-14 days')
    ORDER BY s.last_attendance ASC
  `).all();

  const churned = db.prepare(`
    SELECT s.id, s.first_name, s.last_name, s.belt_rank,
           s.start_date, s.last_attendance, s.notes,
           ROUND((julianday(s.last_attendance) - julianday(s.start_date)) / 30.0, 1) as months_active
    FROM students s
    WHERE s.membership_status = 'inactive'
    ORDER BY s.last_attendance DESC
  `).all();

  const beltDistribution = db.prepare(`
    SELECT belt_rank, COUNT(*) as count
    FROM students WHERE membership_status = 'active'
    GROUP BY belt_rank
    ORDER BY
      CASE belt_rank
        WHEN 'white' THEN 0
        WHEN 'blue' THEN 1
        WHEN 'purple' THEN 2
        WHEN 'brown' THEN 3
        WHEN 'black' THEN 4
      END
  `).all();

  const attendanceByWeek = db.prepare(`
    SELECT
      strftime('%Y-W%W', c.date) as week,
      COUNT(DISTINCT a.student_id) as unique_students,
      COUNT(*) as total_checkins
    FROM attendance a
    JOIN classes c ON a.class_id = c.id
    WHERE c.date >= date('now', '-60 days')
    GROUP BY week
    ORDER BY week
  `).all();

  return { atRisk, churned, beltDistribution, attendanceByWeek };
}

// ---- Schedule ----

export function getWeekSchedule(weekOffset = 0) {
  const db = getDb();

  // Get recurring schedule with class type info
  const recurring = db.prepare(`
    SELECT s.id, s.day_of_week, s.start_time, s.end_time, s.instructor,
           ct.id as class_type_id, ct.name as class_type, ct.description, ct.min_belt, ct.is_gi
    FROM schedule s
    JOIN class_types ct ON s.class_type_id = ct.id
    ORDER BY s.day_of_week, s.start_time
  `).all();

  // Get any class instances this week that have lesson plans attached
  const planned = db.prepare(`
    SELECT c.date, c.start_time, c.class_type_id,
           lp.title as lesson_title, lp.position_area
    FROM classes c
    JOIN lesson_plans lp ON c.lesson_plan_id = lp.id
    WHERE c.date >= date('now', ? || ' days', 'weekday 1', '-7 days')
      AND c.date < date('now', ? || ' days', 'weekday 1')
  `).all(weekOffset * 7, weekOffset * 7 + 7);

  return { recurring, planned };
}

// ---- Notes ----

export function getNotes(includeUsed = true) {
  const db = getDb();
  const where = includeUsed ? "" : "WHERE is_used = 0";
  return db.prepare(`
    SELECT n.*, lp.title as used_in_plan_title
    FROM notes n
    LEFT JOIN lesson_plans lp ON n.used_in_plan_id = lp.id
    ${where}
    ORDER BY n.created_at DESC
  `).all();
}

export function createNote(author: string, content: string, tags?: string) {
  const db = getDb();
  return db.prepare(
    "INSERT INTO notes (author, content, tags) VALUES (?, ?, ?)"
  ).run(author, content, tags || null);
}

export function deleteNote(id: number) {
  const db = getDb();
  return db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}

// ---- Community / Channels ----

export function getChannels(studentId?: number) {
  const db = getDb();

  if (studentId) {
    return db.prepare(`
      SELECT ch.*,
        (SELECT COUNT(*) FROM messages m WHERE m.channel_id = ch.id) as message_count,
        (SELECT COUNT(*) FROM messages m WHERE m.channel_id = ch.id
         AND m.created_at > COALESCE(cm.last_read_at, '2000-01-01')) as unread_count,
        cm.role,
        (SELECT m2.content FROM messages m2 WHERE m2.channel_id = ch.id ORDER BY m2.created_at DESC LIMIT 1) as last_message,
        (SELECT s.first_name FROM messages m3 JOIN students s ON m3.author_id = s.id
         WHERE m3.channel_id = ch.id ORDER BY m3.created_at DESC LIMIT 1) as last_message_author
      FROM channels ch
      JOIN channel_members cm ON cm.channel_id = ch.id AND cm.student_id = ?
      ORDER BY ch.type = 'announcement' DESC, unread_count DESC, ch.name
    `).all(studentId);
  }

  return db.prepare(`
    SELECT ch.*,
      (SELECT COUNT(*) FROM messages m WHERE m.channel_id = ch.id) as message_count,
      (SELECT COUNT(*) FROM channel_members WHERE channel_id = ch.id) as member_count
    FROM channels ch
    ORDER BY ch.name
  `).all();
}

export function getChannelMessages(channelId: number, limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT m.id, m.content, m.is_pinned, m.created_at, m.parent_id,
           s.id as author_id, s.first_name, s.last_name, s.belt_rank
    FROM messages m
    JOIN students s ON m.author_id = s.id
    WHERE m.channel_id = ?
    ORDER BY m.created_at ASC
    LIMIT ?
  `).all(channelId, limit);
}

export function getChannelMembers(channelId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT s.id, s.first_name, s.last_name, s.belt_rank, s.stripes,
           cm.role, cm.joined_at
    FROM channel_members cm
    JOIN students s ON cm.student_id = s.id
    WHERE cm.channel_id = ?
    ORDER BY cm.role DESC, s.last_name
  `).all(channelId);
}

export function sendMessage(channelId: number, authorId: number, content: string, parentId?: number) {
  const db = getDb();
  return db.prepare(
    "INSERT INTO messages (channel_id, author_id, content, parent_id) VALUES (?, ?, ?, ?)"
  ).run(channelId, authorId, content, parentId || null);
}

export function markChannelRead(channelId: number, studentId: number) {
  const db = getDb();
  return db.prepare(
    "UPDATE channel_members SET last_read_at = datetime('now') WHERE channel_id = ? AND student_id = ?"
  ).run(channelId, studentId);
}

// ---- Users / RBAC ----

export function getUsers() {
  const db = getDb();
  return db.prepare(`
    SELECT u.*,
           s.belt_rank, s.stripes, s.membership_type, s.membership_status, s.monthly_rate
    FROM users u
    LEFT JOIN students s ON u.student_id = s.id
    ORDER BY
      CASE u.role
        WHEN 'admin' THEN 0
        WHEN 'manager' THEN 1
        WHEN 'member' THEN 2
        WHEN 'guest' THEN 3
      END,
      u.display_name
  `).all();
}

export function updateUserRole(userId: number, role: string) {
  const db = getDb();
  return db.prepare(
    "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(role, userId);
}

// ---- Chat Sessions ----

export function createChatSession(
  userName = "Rodrigo",
  source = "planner",
  location?: { lat: number; lng: number; label?: string }
) {
  const db = getDb();
  return db.prepare(
    "INSERT INTO chat_sessions (user_name, source, location_lat, location_lng, location_label) VALUES (?, ?, ?, ?, ?)"
  ).run(userName, source, location?.lat ?? null, location?.lng ?? null, location?.label ?? null);
}

export function getChatSession(sessionId: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(sessionId);
}

export function addChatMessage(sessionId: number, role: string, content: string) {
  const db = getDb();
  db.prepare(
    "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)"
  ).run(sessionId, role, content);
  db.prepare(
    "UPDATE chat_sessions SET message_count = message_count + 1 WHERE id = ?"
  ).run(sessionId);
}

export function getChatMessages(sessionId: number) {
  const db = getDb();
  return db.prepare(
    "SELECT role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC"
  ).all(sessionId);
}

export function getRecentChatSessions(limit = 10) {
  const db = getDb();
  return db.prepare(`
    SELECT cs.*,
      (SELECT cm.content FROM chat_messages cm WHERE cm.session_id = cs.id AND cm.role = 'user' ORDER BY cm.created_at ASC LIMIT 1) as first_message
    FROM chat_sessions cs
    ORDER BY cs.started_at DESC
    LIMIT ?
  `).all(limit);
}

export function endChatSession(sessionId: number, summary?: string) {
  const db = getDb();
  db.prepare(
    "UPDATE chat_sessions SET ended_at = datetime('now'), summary = ? WHERE id = ?"
  ).run(summary || null, sessionId);
}

// ---- Instructor Insights ----

export function getInstructorInsights(activeOnly = true) {
  const db = getDb();
  const where = activeOnly ? "WHERE is_active = 1" : "";
  return db.prepare(`
    SELECT i.*, cs.started_at as session_date
    FROM instructor_insights i
    LEFT JOIN chat_sessions cs ON i.source_session_id = cs.id
    ${where}
    ORDER BY i.category, i.created_at DESC
  `).all();
}

export function getInsightsByCategory(category: string) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM instructor_insights WHERE category = ? AND is_active = 1 ORDER BY created_at DESC"
  ).all(category);
}

export function addInsight(
  category: string,
  content: string,
  sourceSessionId?: number,
  sourceQuote?: string,
  confidence = "observed"
) {
  const db = getDb();
  return db.prepare(
    "INSERT INTO instructor_insights (category, content, confidence, source_session_id, source_quote) VALUES (?, ?, ?, ?, ?)"
  ).run(category, content, confidence, sourceSessionId || null, sourceQuote || null);
}

export function deactivateInsight(id: number) {
  const db = getDb();
  return db.prepare(
    "UPDATE instructor_insights SET is_active = 0 WHERE id = ?"
  ).run(id);
}

export function getInsightsSummary() {
  const db = getDb();
  return db.prepare(`
    SELECT category, COUNT(*) as count
    FROM instructor_insights
    WHERE is_active = 1
    GROUP BY category
    ORDER BY count DESC
  `).all();
}

// ---- Content Pieces ----

export function createContentPiece(
  contentType: string,
  body: string,
  imagePrompt: string | null,
  sourceType: string,
  sourceText: string | null
) {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO content_pieces (content_type, body, image_prompt, source_type, source_text) VALUES (?, ?, ?, ?, ?)"
  ).run(contentType, body, imagePrompt, sourceType, sourceText);

  // Save initial version as revision 0
  db.prepare(
    "INSERT INTO content_revisions (content_piece_id, version, body, image_prompt) VALUES (?, 0, ?, ?)"
  ).run(result.lastInsertRowid, body, imagePrompt);

  return result;
}

export function getContentPieces(status?: string) {
  const db = getDb();
  const where = status ? "WHERE cp.status = ?" : "";
  const params = status ? [status] : [];
  return db.prepare(`
    SELECT cp.*,
      (SELECT COUNT(*) FROM content_revisions cr WHERE cr.content_piece_id = cp.id) as version_count
    FROM content_pieces cp
    ${where}
    ORDER BY
      CASE cp.status
        WHEN 'revision' THEN 0
        WHEN 'draft' THEN 1
        WHEN 'approved' THEN 2
        WHEN 'published' THEN 3
        WHEN 'archived' THEN 4
      END,
      cp.updated_at DESC
  `).all(...params);
}

export function getContentPiece(id: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM content_pieces WHERE id = ?").get(id);
}

export function updateContentPiece(
  id: number,
  body: string,
  imagePrompt: string | null,
  revisionNotes: string | null
) {
  const db = getDb();

  // Get current revision count
  const piece = db.prepare("SELECT revision_count FROM content_pieces WHERE id = ?").get(id) as { revision_count: number } | undefined;
  if (!piece) return null;

  const newVersion = piece.revision_count + 1;

  // Save the new revision
  db.prepare(
    "INSERT INTO content_revisions (content_piece_id, version, body, image_prompt, revision_notes) VALUES (?, ?, ?, ?, ?)"
  ).run(id, newVersion, body, imagePrompt, revisionNotes);

  // Update the main piece
  db.prepare(
    "UPDATE content_pieces SET body = ?, image_prompt = ?, revision_count = ?, revision_notes = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(body, imagePrompt, newVersion, revisionNotes, id);

  return { version: newVersion };
}

export function updateContentStatus(id: number, status: string) {
  const db = getDb();
  const extra = status === "published" ? ", published_at = datetime('now')" : "";
  return db.prepare(
    `UPDATE content_pieces SET status = ?${extra}, updated_at = datetime('now') WHERE id = ?`
  ).run(status, id);
}

export function updateContentBody(id: number, body: string) {
  const db = getDb();
  return db.prepare(
    "UPDATE content_pieces SET body = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(body, id);
}

export function scheduleContent(id: number, scheduledFor: string) {
  const db = getDb();
  return db.prepare(
    "UPDATE content_pieces SET scheduled_for = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(scheduledFor, id);
}

export function getContentRevisions(pieceId: number) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM content_revisions WHERE content_piece_id = ? ORDER BY version DESC"
  ).all(pieceId);
}

export function getContentQueueStats() {
  const db = getDb();
  return db.prepare(`
    SELECT status, COUNT(*) as count
    FROM content_pieces
    GROUP BY status
  `).all();
}

// ---- Survey Templates ----

export function getSurveyTemplates(activeOnly = true) {
  const db = getDb();
  const where = activeOnly ? "WHERE is_active = 1" : "";
  return db.prepare(`SELECT * FROM survey_templates ${where} ORDER BY created_at DESC`).all();
}

export function getSurveyTemplate(id: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM survey_templates WHERE id = ?").get(id);
}

export function createSurveyTemplate(
  name: string, slug: string, description: string, targetType: string, questions: string, createdBy = "Rodrigo"
) {
  const db = getDb();
  return db.prepare(
    "INSERT INTO survey_templates (name, slug, description, target_type, questions, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(name, slug, description, targetType, questions, createdBy);
}

export function updateSurveyTemplate(id: number, updates: { name?: string; description?: string; questions?: string; is_active?: number }) {
  const db = getDb();
  const sets: string[] = [];
  const vals: (string | number)[] = [];
  if (updates.name !== undefined) { sets.push("name = ?"); vals.push(updates.name); }
  if (updates.description !== undefined) { sets.push("description = ?"); vals.push(updates.description); }
  if (updates.questions !== undefined) { sets.push("questions = ?"); vals.push(updates.questions); }
  if (updates.is_active !== undefined) { sets.push("is_active = ?"); vals.push(updates.is_active); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  return db.prepare(`UPDATE survey_templates SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

// ---- Survey Sends ----

export function createSurveySend(
  templateId: number, token: string,
  recipientName: string, recipientEmail: string | null, recipientPhone: string | null,
  studentId: number | null, leadId: number | null,
  sentVia: string | null = null, expiresAt: string | null = null
) {
  const db = getDb();
  return db.prepare(
    `INSERT INTO survey_sends (template_id, token, student_id, lead_id, recipient_name, recipient_email, recipient_phone, sent_via, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(templateId, token, studentId, leadId, recipientName, recipientEmail, recipientPhone, sentVia, expiresAt);
}

export function getSurveySends(templateId?: number, status?: string) {
  const db = getDb();
  const conditions: string[] = [];
  const params: (number | string)[] = [];
  if (templateId) { conditions.push("ss.template_id = ?"); params.push(templateId); }
  if (status) { conditions.push("ss.status = ?"); params.push(status); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.prepare(`
    SELECT ss.*, st.name as template_name, st.slug as template_slug
    FROM survey_sends ss
    JOIN survey_templates st ON ss.template_id = st.id
    ${where}
    ORDER BY ss.sent_at DESC
  `).all(...params);
}

export function getSurveySendByToken(token: string) {
  const db = getDb();
  return db.prepare(`
    SELECT ss.*, st.name as template_name, st.questions as template_questions, st.description as template_description
    FROM survey_sends ss
    JOIN survey_templates st ON ss.template_id = st.id
    WHERE ss.token = ?
  `).get(token);
}

export function markSurveyOpened(token: string) {
  const db = getDb();
  return db.prepare(
    "UPDATE survey_sends SET status = 'opened', opened_at = COALESCE(opened_at, datetime('now')) WHERE token = ? AND status = 'sent'"
  ).run(token);
}

export function markSurveyCompleted(token: string) {
  const db = getDb();
  return db.prepare(
    "UPDATE survey_sends SET status = 'completed', completed_at = datetime('now') WHERE token = ?"
  ).run(token);
}

export function getSurveyResponses(sendId: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM survey_responses WHERE send_id = ? ORDER BY created_at ASC").all(sendId);
}

export function upsertSurveyResponse(sendId: number, questionKey: string, answer: string) {
  const db = getDb();
  return db.prepare(
    "INSERT INTO survey_responses (send_id, question_key, answer) VALUES (?, ?, ?) ON CONFLICT(send_id, question_key) DO UPDATE SET answer = ?, created_at = datetime('now')"
  ).run(sendId, questionKey, answer, answer);
}

export function getSurveySendStats() {
  const db = getDb();
  return db.prepare(`
    SELECT st.id as template_id, st.name as template_name, st.slug,
      COUNT(ss.id) as total_sent,
      SUM(CASE WHEN ss.status = 'opened' THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN ss.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN ss.status = 'sent' THEN 1 ELSE 0 END) as pending
    FROM survey_templates st
    LEFT JOIN survey_sends ss ON ss.template_id = st.id
    WHERE st.is_active = 1
    GROUP BY st.id
    ORDER BY st.name
  `).all();
}

// ---- Student Profiles (enrichment) ----

export function getStudentProfile(studentId?: number, leadId?: number) {
  const db = getDb();
  if (studentId) return db.prepare("SELECT * FROM student_profiles WHERE student_id = ?").get(studentId);
  if (leadId) return db.prepare("SELECT * FROM student_profiles WHERE lead_id = ?").get(leadId);
  return null;
}

export function upsertStudentProfile(
  fields: Record<string, string | number | null>,
  studentId?: number,
  leadId?: number
) {
  const db = getDb();

  // Check if profile exists
  let existing;
  if (studentId) existing = db.prepare("SELECT id FROM student_profiles WHERE student_id = ?").get(studentId);
  else if (leadId) existing = db.prepare("SELECT id FROM student_profiles WHERE lead_id = ?").get(leadId);

  if (existing) {
    // Update
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push((existing as { id: number }).id);
    db.prepare(`UPDATE student_profiles SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  } else {
    // Insert
    const cols = [...Object.keys(fields)];
    const vals: (string | number | null)[] = [...Object.values(fields)];
    if (studentId) { cols.push("student_id"); vals.push(studentId); }
    if (leadId) { cols.push("lead_id"); vals.push(leadId); }
    const placeholders = cols.map(() => "?").join(", ");
    db.prepare(`INSERT INTO student_profiles (${cols.join(", ")}) VALUES (${placeholders})`).run(...vals);
  }
}

export function getAllStudentProfiles() {
  const db = getDb();
  return db.prepare(`
    SELECT sp.*,
      COALESCE(s.first_name || ' ' || s.last_name, l.first_name || ' ' || COALESCE(l.last_name, '')) as name,
      CASE WHEN sp.student_id IS NOT NULL THEN 'student' ELSE 'lead' END as record_type,
      s.membership_status, s.belt_rank, s.last_attendance
    FROM student_profiles sp
    LEFT JOIN students s ON sp.student_id = s.id
    LEFT JOIN leads l ON sp.lead_id = l.id
    ORDER BY sp.updated_at DESC
  `).all();
}
