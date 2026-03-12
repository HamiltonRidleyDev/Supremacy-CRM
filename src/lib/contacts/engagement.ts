import type Database from "better-sqlite3";
import type { EngagementResult, RiskLevel, ScoreResult } from "./types";

// ---- Weight Configuration ----
const WEIGHTS = {
  attendance: 0.4,
  communication: 0.2,
  progression: 0.2,
  community: 0.1,
  financial: 0.1,
};

// Belt numeric values for progression tracking
const BELT_ORDER: Record<string, number> = {
  white: 0, blue: 1, purple: 2, brown: 3, black: 4,
};

// Expected months per belt (approximate BJJ timeline)
const BELT_EXPECTED_MONTHS: Record<string, number> = {
  white: 0, blue: 18, purple: 42, brown: 72, black: 108,
};

// ---- Individual Component Scorers ----

function scoreAttendance(db: Database.Database, studentId: number): { score: number; details: string } {
  // Check if we have granular attendance records
  const hasAttendanceRecords = (db.prepare(`
    SELECT COUNT(*) as count FROM attendance WHERE student_id = ?
  `).get(studentId) as any)?.count || 0;

  if (hasAttendanceRecords > 0) {
    // Full scoring from attendance table
    return scoreAttendanceFromRecords(db, studentId);
  }

  // Fallback: use students.last_attendance + total_classes from Zivvy sync
  // This gives us recency and volume but not trend/consistency
  const student = db.prepare(`
    SELECT last_attendance, total_classes, start_date FROM students WHERE id = ?
  `).get(studentId) as any;

  if (!student?.last_attendance) {
    return { score: 0, details: "No attendance data available" };
  }

  const lastAttendDate = new Date(student.last_attendance);
  const daysSinceLast = Math.floor((Date.now() - lastAttendDate.getTime()) / (24 * 60 * 60 * 1000));
  const totalClasses = student.total_classes || 0;

  // Recency score (60% weight) — how recently did they train?
  let recencyScore: number;
  if (daysSinceLast <= 3) recencyScore = 100;
  else if (daysSinceLast <= 7) recencyScore = 90;
  else if (daysSinceLast <= 14) recencyScore = 70;
  else if (daysSinceLast <= 30) recencyScore = 50;
  else if (daysSinceLast <= 60) recencyScore = 25;
  else if (daysSinceLast <= 90) recencyScore = 10;
  else recencyScore = 0;

  // Volume score (40% weight) — how many total classes for their tenure?
  let volumeScore = 50; // default
  if (student.start_date) {
    const monthsActive = Math.max(1, (Date.now() - new Date(student.start_date).getTime()) / (30 * 24 * 60 * 60 * 1000));
    const classesPerMonth = totalClasses / monthsActive;
    // 8+ classes/month = excellent, 4-8 = good, 2-4 = fair, <2 = low
    if (classesPerMonth >= 8) volumeScore = 100;
    else if (classesPerMonth >= 4) volumeScore = 75;
    else if (classesPerMonth >= 2) volumeScore = 50;
    else if (classesPerMonth >= 1) volumeScore = 30;
    else volumeScore = 10;
  }

  const score = Math.round(recencyScore * 0.6 + volumeScore * 0.4);
  const details = `Last trained ${daysSinceLast}d ago, ${totalClasses} total classes (Zivvy data)`;
  return { score, details };
}

function scoreAttendanceFromRecords(db: Database.Database, studentId: number): { score: number; details: string } {
  // Classes in last 30 days
  const last30 = (db.prepare(`
    SELECT COUNT(*) as count FROM attendance
    WHERE student_id = ? AND checked_in_at >= datetime('now', '-30 days')
  `).get(studentId) as any)?.count || 0;

  // Classes in last 14 days vs prior 14 days (trend)
  const recent14 = (db.prepare(`
    SELECT COUNT(*) as count FROM attendance
    WHERE student_id = ? AND checked_in_at >= datetime('now', '-14 days')
  `).get(studentId) as any)?.count || 0;

  const prior14 = (db.prepare(`
    SELECT COUNT(*) as count FROM attendance
    WHERE student_id = ?
      AND checked_in_at >= datetime('now', '-28 days')
      AND checked_in_at < datetime('now', '-14 days')
  `).get(studentId) as any)?.count || 0;

  // Weekly attendance over last 8 weeks for consistency
  const weeklyRaw = db.prepare(`
    SELECT strftime('%Y-%W', checked_in_at) as week, COUNT(*) as count
    FROM attendance
    WHERE student_id = ? AND checked_in_at >= datetime('now', '-56 days')
    GROUP BY week
  `).all(studentId) as Array<{ week: string; count: number }>;

  // Get training frequency target (default 3x/week = 12/month)
  const profile = db.prepare(`
    SELECT training_frequency_target FROM student_profiles WHERE student_id = ?
  `).get(studentId) as any;
  const targetPerMonth = profile?.training_frequency_target
    ? parseInt(profile.training_frequency_target) * 4
    : 12;

  // Frequency score (50%)
  const frequencyScore = Math.min(100, (last30 / Math.max(targetPerMonth, 1)) * 100);

  // Trend score (30%)
  let trendScore: number;
  if (recent14 === 0 && prior14 === 0) {
    trendScore = 0;
  } else if (prior14 === 0) {
    trendScore = recent14 > 0 ? 80 : 0;
  } else {
    const trendRatio = recent14 / prior14;
    if (trendRatio >= 1.2) trendScore = 90;
    else if (trendRatio >= 0.8) trendScore = 60;
    else if (trendRatio >= 0.5) trendScore = 30;
    else trendScore = 10;
  }

  // Consistency score (20%)
  const actualWeekCounts = weeklyRaw.map((w) => w.count);
  let consistencyScore = 50;
  if (actualWeekCounts.length >= 3) {
    const mean = actualWeekCounts.reduce((a, b) => a + b, 0) / actualWeekCounts.length;
    const variance = actualWeekCounts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / actualWeekCounts.length;
    const stddev = Math.sqrt(variance);
    consistencyScore = Math.max(0, Math.min(100, 100 - stddev * 25));
  } else if (actualWeekCounts.length === 0) {
    consistencyScore = 0;
  }

  const score = Math.round(frequencyScore * 0.5 + trendScore * 0.3 + consistencyScore * 0.2);
  const details = `${last30} classes/30d (target: ${targetPerMonth}), trend: ${recent14}→${prior14}, ${actualWeekCounts.length} active weeks`;
  return { score, details };
}

function scoreCommunication(db: Database.Database, mmId: string | null): { score: number; details: string } {
  if (!mmId) {
    return { score: 50, details: "No Market Muscles link (neutral)" };
  }

  const conv = db.prepare(`
    SELECT
      SUM(has_replied) as replied_count,
      COUNT(*) as thread_count,
      SUM(inbound_count) as total_inbound,
      AVG(response_time_avg_hrs) as avg_response_hrs
    FROM mm_conversations
    WHERE contact_id = ?
  `).get(mmId) as any;

  if (!conv || conv.thread_count === 0) {
    return { score: 50, details: "No conversation threads (neutral)" };
  }

  // Reply rate (60%)
  let replyScore: number;
  const replyRate = (conv.replied_count || 0) / conv.thread_count;
  const avgResponseHrs = conv.avg_response_hrs || 999;
  if (replyRate === 0) {
    replyScore = 0;
  } else if (avgResponseHrs < 4) {
    replyScore = 100;
  } else if (avgResponseHrs < 24) {
    replyScore = 80;
  } else {
    replyScore = 50;
  }

  // Initiated contact (40%)
  let initiatedScore: number;
  const inboundCount = conv.total_inbound || 0;
  if (inboundCount >= 6) initiatedScore = 100;
  else if (inboundCount >= 3) initiatedScore = 80;
  else if (inboundCount >= 1) initiatedScore = 50;
  else initiatedScore = 0;

  const score = Math.round(replyScore * 0.6 + initiatedScore * 0.4);
  const details = `${conv.thread_count} threads, ${conv.total_inbound || 0} inbound, reply rate: ${Math.round(replyRate * 100)}%, avg response: ${Math.round(avgResponseHrs)}h`;
  return { score, details };
}

function scoreProgression(
  db: Database.Database,
  studentId: number,
  beltRank: string | null,
  startDate: string | null
): { score: number; details: string } {
  // Advancement rate (50%)
  let advancementScore = 50; // default if we can't compute
  const beltNumeric = BELT_ORDER[beltRank || "white"] ?? 0;

  if (startDate) {
    const monthsActive = Math.max(
      1,
      (Date.now() - new Date(startDate).getTime()) / (30 * 24 * 60 * 60 * 1000)
    );
    // Find expected belt for time invested
    let expectedBelt = 0;
    for (const [belt, months] of Object.entries(BELT_EXPECTED_MONTHS)) {
      if (monthsActive >= months) expectedBelt = BELT_ORDER[belt];
    }
    if (beltNumeric >= expectedBelt) advancementScore = 100;
    else if (beltNumeric >= expectedBelt - 1) advancementScore = 50;
    else advancementScore = 20;
  }

  // Technique breadth (50%)
  const categories = (db.prepare(`
    SELECT COUNT(DISTINCT t.category) as count
    FROM attendance a
    JOIN classes cl ON cl.id = a.class_id
    JOIN lesson_techniques lt ON lt.lesson_plan_id = cl.lesson_plan_id
    JOIN techniques t ON t.id = lt.technique_id
    WHERE a.student_id = ?
  `).get(studentId) as any)?.count || 0;

  const breadthScore = Math.round((categories / 9) * 100); // 9 technique categories

  const score = Math.round(advancementScore * 0.5 + breadthScore * 0.5);
  const details = `Belt: ${beltRank || "white"} (${beltNumeric}/4), ${categories}/9 technique categories covered`;
  return { score, details };
}

function scoreCommunity(db: Database.Database, studentId: number): { score: number; details: string } {
  // Check if community tables have any data
  const channelCount = (db.prepare(`
    SELECT COUNT(*) as count FROM channel_members WHERE student_id = ?
  `).get(studentId) as any)?.count || 0;

  const recentMessages = (db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE author_id = ? AND created_at >= datetime('now', '-30 days')
  `).get(studentId) as any)?.count || 0;

  // Channel membership (40%)
  let membershipScore: number;
  if (channelCount >= 3) membershipScore = 100;
  else if (channelCount >= 2) membershipScore = 80;
  else if (channelCount >= 1) membershipScore = 50;
  else membershipScore = 0;

  // Message activity (60%)
  let activityScore: number;
  if (recentMessages >= 6) activityScore = 100;
  else if (recentMessages >= 3) activityScore = 70;
  else if (recentMessages >= 1) activityScore = 40;
  else activityScore = 0;

  // If no community data exists at all (no channels created yet), score neutral
  const totalChannels = (db.prepare("SELECT COUNT(*) as count FROM channels").get() as any)?.count || 0;
  if (totalChannels === 0) {
    return { score: 50, details: "Community not yet active (neutral)" };
  }

  const score = Math.round(membershipScore * 0.4 + activityScore * 0.6);
  const details = `${channelCount} channels, ${recentMessages} messages/30d`;
  return { score, details };
}

function scoreFinancial(
  db: Database.Database,
  monthlyRate: number | null,
  billingMethod: string | null,
  onVacation: boolean
): { score: number; details: string } {
  // Get average rate for normalization
  const avgRate = (db.prepare(`
    SELECT AVG(monthly_rate) as avg FROM students
    WHERE membership_status = 'active' AND monthly_rate > 0
  `).get() as any)?.avg || 100;

  // Payment status (70%)
  let paymentScore: number;
  if (onVacation) {
    paymentScore = 50;
  } else if (monthlyRate && monthlyRate > 0) {
    paymentScore = 100;
  } else {
    paymentScore = 20; // no rate on file (step-up, comp, etc.)
  }

  // Rate tier (30%)
  const rate = monthlyRate || 0;
  const rateScore = avgRate > 0 ? Math.min(100, Math.round((rate / avgRate) * 80)) : 50;

  const score = Math.round(paymentScore * 0.7 + rateScore * 0.3);
  const details = `$${rate}/mo (avg: $${Math.round(avgRate)}), ${onVacation ? "on vacation" : billingMethod || "active"}`;
  return { score, details };
}

// ---- Risk Factor Generation ----

function generateRiskFactors(
  db: Database.Database,
  studentId: number | null,
  components: { attendance: number; communication: number; progression: number }
): string[] {
  const factors: string[] = [];

  if (studentId) {
    const student = db.prepare(
      "SELECT last_attendance, membership_status, on_vacation FROM students WHERE id = ?"
    ).get(studentId) as any;

    if (student?.on_vacation) {
      factors.push("On vacation hold");
    } else if (student?.last_attendance) {
      const daysAbsent = Math.floor(
        (Date.now() - new Date(student.last_attendance).getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysAbsent > 90) factors.push(`No attendance in ${daysAbsent} days (ghost)`);
      else if (daysAbsent > 30) factors.push(`No attendance in ${daysAbsent} days`);
      else if (daysAbsent > 14) factors.push(`${daysAbsent} days since last class`);
    } else if (student?.membership_status === "active") {
      factors.push("No attendance date on file");
    }
  }

  if (components.attendance < 30) factors.push("Very low attendance frequency");
  if (components.attendance >= 30 && components.attendance < 50) factors.push("Declining attendance trend");
  if (components.communication === 0) factors.push("Never replied to messages");
  if (components.progression < 30) factors.push("Limited technique exposure");

  return factors;
}

// ---- Main Scoring Functions ----

/**
 * Compute engagement score for a single contact.
 */
export function computeEngagement(db: Database.Database, contactId: number): EngagementResult {
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId) as any;
  if (!contact) {
    return {
      score: 0,
      components: {
        attendance: { score: 0, details: "Contact not found" },
        communication: { score: 0, details: "" },
        progression: { score: 0, details: "" },
        community: { score: 0, details: "" },
        financial: { score: 0, details: "" },
      },
      risk_level: "churned",
      risk_factors: ["Contact not found"],
    };
  }

  const isActiveMember = contact.contact_type === "active_member";

  // Get student data if available
  let student: any = null;
  if (contact.student_id) {
    student = db.prepare("SELECT * FROM students WHERE id = ?").get(contact.student_id);
  }

  // Compute each component
  const attendance = isActiveMember && contact.student_id
    ? scoreAttendance(db, contact.student_id)
    : { score: 0, details: isActiveMember ? "No student link" : "Not an active member" };

  const communication = scoreCommunication(db, contact.mm_id);

  const progression = isActiveMember && contact.student_id
    ? scoreProgression(db, contact.student_id, student?.belt_rank, student?.start_date)
    : { score: 0, details: "Not an active member" };

  const community = isActiveMember && contact.student_id
    ? scoreCommunity(db, contact.student_id)
    : { score: 0, details: "Not an active member" };

  const financial = isActiveMember
    ? scoreFinancial(db, student?.monthly_rate, student?.billing_method, !!student?.on_vacation)
    : { score: 0, details: "Not an active member" };

  // Composite score
  const score = Math.round(
    attendance.score * WEIGHTS.attendance +
    communication.score * WEIGHTS.communication +
    progression.score * WEIGHTS.progression +
    community.score * WEIGHTS.community +
    financial.score * WEIGHTS.financial
  );

  // Risk level
  let risk_level: RiskLevel;
  if (!isActiveMember) {
    risk_level = contact.contact_type === "former_member" ? "churned" : "healthy";
  } else if (score >= 80) risk_level = "healthy";
  else if (score >= 60) risk_level = "cooling";
  else if (score >= 40) risk_level = "at_risk";
  else if (score >= 20) risk_level = "ghost";
  else risk_level = "churned";

  const risk_factors = isActiveMember
    ? generateRiskFactors(db, contact.student_id, {
        attendance: attendance.score,
        communication: communication.score,
        progression: progression.score,
      })
    : [];

  return {
    score,
    components: { attendance, communication, progression, community, financial },
    risk_level,
    risk_factors,
  };
}

/**
 * Batch compute engagement scores for all contacts.
 * Only scores active_member and former_member contacts (prospects/leads get default scores).
 */
export function batchComputeEngagement(db: Database.Database): ScoreResult {
  const start = Date.now();

  const contacts = db.prepare(`
    SELECT id, contact_type FROM contacts
    WHERE contact_type IN ('active_member', 'former_member')
  `).all() as Array<{ id: number; contact_type: string }>;

  const updateStmt = db.prepare(`
    UPDATE contacts SET
      engagement_score = ?,
      score_attendance = ?,
      score_communication = ?,
      score_progression = ?,
      score_community = ?,
      score_financial = ?,
      risk_level = ?,
      risk_factors = ?,
      scored_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const distribution: Record<RiskLevel, number> = {
    healthy: 0, cooling: 0, at_risk: 0, ghost: 0, churned: 0,
  };
  let totalScore = 0;

  const batch = db.transaction(() => {
    for (const contact of contacts) {
      const result = computeEngagement(db, contact.id);
      updateStmt.run(
        result.score,
        result.components.attendance.score,
        result.components.communication.score,
        result.components.progression.score,
        result.components.community.score,
        result.components.financial.score,
        result.risk_level,
        JSON.stringify(result.risk_factors),
        contact.id
      );
      distribution[result.risk_level]++;
      totalScore += result.score;
    }
  });

  batch();

  return {
    contacts_scored: contacts.length,
    distribution,
    avg_score: contacts.length > 0 ? Math.round((totalScore / contacts.length) * 10) / 10 : 0,
    duration_ms: Date.now() - start,
  };
}
