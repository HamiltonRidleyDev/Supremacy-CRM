import type Database from "better-sqlite3";
import type { EngagementResult, RiskLevel, ScoreResult } from "./types";
import { getEngagementConfig, type EngagementConfig, type TierEntry, type MinTierEntry } from "./engagement-config";

// Belt numeric values for progression tracking
const BELT_ORDER: Record<string, number> = {
  white: 0, blue: 1, purple: 2, brown: 3, black: 4,
};

// ---- Tier Lookup Helpers ----

/** Find the score for a value in ascending tiers (e.g., days since last → max threshold) */
function lookupAscending(value: number, tiers: TierEntry[], fallback: number = 0): number {
  for (const tier of tiers) {
    if (value <= tier.max) return tier.score;
  }
  return fallback;
}

/** Find the score for a value in descending tiers (e.g., classes/month → min threshold) */
function lookupDescending(value: number, tiers: MinTierEntry[], fallback: number = 0): number {
  for (const tier of tiers) {
    if (value >= tier.min) return tier.score;
  }
  return fallback;
}

// ---- Individual Component Scorers ----

function scoreAttendance(
  db: Database.Database,
  studentId: number,
  cfg: EngagementConfig["attendance"]
): { score: number; details: string } {
  const hasAttendanceRecords = (db.prepare(`
    SELECT COUNT(*) as count FROM attendance WHERE student_id = ?
  `).get(studentId) as any)?.count || 0;

  if (hasAttendanceRecords > 0) {
    return scoreAttendanceFromRecords(db, studentId, cfg);
  }

  // Fallback: use students.last_attendance + total_classes from Zivvy sync
  const student = db.prepare(`
    SELECT last_attendance, total_classes, start_date FROM students WHERE id = ?
  `).get(studentId) as any;

  if (!student?.last_attendance) {
    return { score: 0, details: "No attendance data available" };
  }

  const lastAttendDate = new Date(student.last_attendance);
  const daysSinceLast = Math.floor((Date.now() - lastAttendDate.getTime()) / (24 * 60 * 60 * 1000));
  const totalClasses = student.total_classes || 0;

  // Recency score
  const recencyScore = lookupAscending(daysSinceLast, cfg.recency);

  // Volume score
  let volumeScore = 50;
  if (student.start_date) {
    const monthsActive = Math.max(1, (Date.now() - new Date(student.start_date).getTime()) / (30 * 24 * 60 * 60 * 1000));
    const classesPerMonth = totalClasses / monthsActive;
    volumeScore = lookupDescending(classesPerMonth, cfg.volume, 10);
  }

  const score = Math.round(recencyScore * cfg.recencyWeight + volumeScore * cfg.volumeWeight);
  const details = `Last trained ${daysSinceLast}d ago, ${totalClasses} total classes (Zivvy data)`;
  return { score, details };
}

function scoreAttendanceFromRecords(
  db: Database.Database,
  studentId: number,
  cfg: EngagementConfig["attendance"]
): { score: number; details: string } {
  const last30 = (db.prepare(`
    SELECT COUNT(*) as count FROM attendance
    WHERE student_id = ? AND checked_in_at >= datetime('now', '-30 days')
  `).get(studentId) as any)?.count || 0;

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

  const weeklyRaw = db.prepare(`
    SELECT strftime('%Y-%W', checked_in_at) as week, COUNT(*) as count
    FROM attendance
    WHERE student_id = ? AND checked_in_at >= datetime('now', '-56 days')
    GROUP BY week
  `).all(studentId) as Array<{ week: string; count: number }>;

  const profile = db.prepare(`
    SELECT training_frequency_target FROM student_profiles WHERE student_id = ?
  `).get(studentId) as any;
  const targetPerMonth = profile?.training_frequency_target
    ? parseInt(profile.training_frequency_target) * 4
    : cfg.defaultTargetPerMonth;

  // Frequency score
  const frequencyScore = Math.min(100, (last30 / Math.max(targetPerMonth, 1)) * 100);

  // Trend score
  let trendScore: number;
  if (recent14 === 0 && prior14 === 0) {
    trendScore = 0;
  } else if (prior14 === 0) {
    trendScore = recent14 > 0 ? 80 : 0;
  } else {
    const trendRatio = recent14 / prior14;
    trendScore = lookupDescending(trendRatio, cfg.trendTiers, 10);
  }

  // Consistency score
  const actualWeekCounts = weeklyRaw.map((w) => w.count);
  let consistencyScore = 50;
  if (actualWeekCounts.length >= 3) {
    const mean = actualWeekCounts.reduce((a, b) => a + b, 0) / actualWeekCounts.length;
    const variance = actualWeekCounts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / actualWeekCounts.length;
    const stddev = Math.sqrt(variance);
    consistencyScore = Math.max(0, Math.min(100, 100 - stddev * cfg.consistencyMultiplier));
  } else if (actualWeekCounts.length === 0) {
    consistencyScore = 0;
  }

  const score = Math.round(
    frequencyScore * cfg.frequencyWeight +
    trendScore * cfg.trendWeight +
    consistencyScore * cfg.consistencyWeight
  );
  const details = `${last30} classes/30d (target: ${targetPerMonth}), trend: ${recent14}→${prior14}, ${actualWeekCounts.length} active weeks`;
  return { score, details };
}

function scoreCommunication(
  db: Database.Database,
  mmId: string | null,
  cfg: EngagementConfig["communication"]
): { score: number; details: string } {
  if (!mmId) {
    return { score: cfg.neutralDefault, details: "No Market Muscles link (neutral)" };
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
    return { score: cfg.neutralDefault, details: "No conversation threads (neutral)" };
  }

  const replyRate = (conv.replied_count || 0) / conv.thread_count;
  const avgResponseHrs = conv.avg_response_hrs || 999;

  let replyScore: number;
  if (replyRate === 0) {
    replyScore = 0;
  } else {
    replyScore = lookupAscending(avgResponseHrs, cfg.replyTime, 50);
  }

  const inboundCount = conv.total_inbound || 0;
  const initiatedScore = lookupDescending(inboundCount, cfg.inboundCount, 0);

  const score = Math.round(replyScore * cfg.replyWeight + initiatedScore * cfg.initiatedWeight);
  const details = `${conv.thread_count} threads, ${conv.total_inbound || 0} inbound, reply rate: ${Math.round(replyRate * 100)}%, avg response: ${Math.round(avgResponseHrs)}h`;
  return { score, details };
}

function scoreProgression(
  db: Database.Database,
  studentId: number,
  beltRank: string | null,
  startDate: string | null,
  cfg: EngagementConfig["progression"]
): { score: number; details: string } {
  let advancementScore = 50;
  const beltNumeric = BELT_ORDER[beltRank || "white"] ?? 0;

  if (startDate) {
    const monthsActive = Math.max(
      1,
      (Date.now() - new Date(startDate).getTime()) / (30 * 24 * 60 * 60 * 1000)
    );
    let expectedBelt = 0;
    for (const [belt, months] of Object.entries(cfg.beltExpectedMonths)) {
      if (monthsActive >= months) expectedBelt = BELT_ORDER[belt] ?? 0;
    }
    if (beltNumeric >= expectedBelt) advancementScore = 100;
    else if (beltNumeric >= expectedBelt - 1) advancementScore = 50;
    else advancementScore = 20;
  }

  const categories = (db.prepare(`
    SELECT COUNT(DISTINCT t.category) as count
    FROM attendance a
    JOIN classes cl ON cl.id = a.class_id
    JOIN lesson_techniques lt ON lt.lesson_plan_id = cl.lesson_plan_id
    JOIN techniques t ON t.id = lt.technique_id
    WHERE a.student_id = ?
  `).get(studentId) as any)?.count || 0;

  const breadthScore = Math.round((categories / cfg.totalCategories) * 100);

  const score = Math.round(advancementScore * cfg.advancementWeight + breadthScore * cfg.breadthWeight);
  const details = `Belt: ${beltRank || "white"} (${beltNumeric}/4), ${categories}/${cfg.totalCategories} technique categories covered`;
  return { score, details };
}

function scoreCommunity(
  db: Database.Database,
  studentId: number,
  cfg: EngagementConfig["community"]
): { score: number; details: string } {
  const channelCount = (db.prepare(`
    SELECT COUNT(*) as count FROM channel_members WHERE student_id = ?
  `).get(studentId) as any)?.count || 0;

  const recentMessages = (db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE author_id = ? AND created_at >= datetime('now', '-30 days')
  `).get(studentId) as any)?.count || 0;

  const membershipScore = lookupDescending(channelCount, cfg.channelTiers, 0);
  const activityScore = lookupDescending(recentMessages, cfg.messageTiers, 0);

  const totalChannels = (db.prepare("SELECT COUNT(*) as count FROM channels").get() as any)?.count || 0;
  if (totalChannels === 0) {
    return { score: cfg.neutralDefault, details: "Community not yet active (neutral)" };
  }

  const score = Math.round(membershipScore * cfg.membershipWeight + activityScore * cfg.activityWeight);
  const details = `${channelCount} channels, ${recentMessages} messages/30d`;
  return { score, details };
}

function scoreFinancial(
  db: Database.Database,
  monthlyRate: number | null,
  billingMethod: string | null,
  onVacation: boolean,
  cfg: EngagementConfig["financial"]
): { score: number; details: string } {
  const avgRate = (db.prepare(`
    SELECT AVG(monthly_rate) as avg FROM students
    WHERE membership_status = 'active' AND monthly_rate > 0
  `).get() as any)?.avg || 100;

  let paymentScore: number;
  if (onVacation) {
    paymentScore = cfg.vacationScore;
  } else if (monthlyRate && monthlyRate > 0) {
    paymentScore = cfg.activeScore;
  } else {
    paymentScore = cfg.noRateScore;
  }

  const rate = monthlyRate || 0;
  const rateScore = avgRate > 0 ? Math.min(100, Math.round((rate / avgRate) * cfg.rateMultiplier)) : 50;

  const score = Math.round(paymentScore * cfg.paymentWeight + rateScore * cfg.rateWeight);
  const details = `$${rate}/mo (avg: $${Math.round(avgRate)}), ${onVacation ? "on vacation" : billingMethod || "active"}`;
  return { score, details };
}

// ---- Risk Factor Generation ----

function generateRiskFactors(
  db: Database.Database,
  studentId: number | null,
  components: { attendance: number; communication: number; progression: number },
  cfg: EngagementConfig["riskFactors"]
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
      if (daysAbsent > cfg.ghostDays) factors.push(`No attendance in ${daysAbsent} days (ghost)`);
      else if (daysAbsent > cfg.warningDays) factors.push(`No attendance in ${daysAbsent} days`);
      else if (daysAbsent > cfg.noticeDays) factors.push(`${daysAbsent} days since last class`);
    } else if (student?.membership_status === "active") {
      factors.push("No attendance date on file");
    }
  }

  if (components.attendance < cfg.lowAttendanceThreshold) factors.push("Very low attendance frequency");
  if (components.attendance >= cfg.lowAttendanceThreshold && components.attendance < cfg.decliningAttendanceThreshold) factors.push("Declining attendance trend");
  if (components.communication === 0) factors.push("Never replied to messages");
  if (components.progression < cfg.lowProgressionThreshold) factors.push("Limited technique exposure");

  return factors;
}

// ---- Main Scoring Functions ----

/**
 * Compute engagement score for a single contact.
 * Loads thresholds from the DB-stored config (falls back to defaults).
 */
export function computeEngagement(
  db: Database.Database,
  contactId: number,
  configOverride?: EngagementConfig
): EngagementResult {
  const config = configOverride || getEngagementConfig(db);

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

  let student: any = null;
  if (contact.student_id) {
    student = db.prepare("SELECT * FROM students WHERE id = ?").get(contact.student_id);
  }

  const attendance = isActiveMember && contact.student_id
    ? scoreAttendance(db, contact.student_id, config.attendance)
    : { score: 0, details: isActiveMember ? "No student link" : "Not an active member" };

  const communication = scoreCommunication(db, contact.mm_id, config.communication);

  const progression = isActiveMember && contact.student_id
    ? scoreProgression(db, contact.student_id, student?.belt_rank, student?.start_date, config.progression)
    : { score: 0, details: "Not an active member" };

  const community = isActiveMember && contact.student_id
    ? scoreCommunity(db, contact.student_id, config.community)
    : { score: 0, details: "Not an active member" };

  const financial = isActiveMember
    ? scoreFinancial(db, student?.monthly_rate, student?.billing_method, !!student?.on_vacation, config.financial)
    : { score: 0, details: "Not an active member" };

  // Composite score
  const score = Math.round(
    attendance.score * config.weights.attendance +
    communication.score * config.weights.communication +
    progression.score * config.weights.progression +
    community.score * config.weights.community +
    financial.score * config.weights.financial
  );

  // Risk level
  let risk_level: RiskLevel;
  if (!isActiveMember) {
    risk_level = contact.contact_type === "former_member" ? "churned" : "healthy";
  } else if (score >= config.riskLevels.healthy) risk_level = "healthy";
  else if (score >= config.riskLevels.cooling) risk_level = "cooling";
  else if (score >= config.riskLevels.atRisk) risk_level = "at_risk";
  else if (score >= config.riskLevels.ghost) risk_level = "ghost";
  else risk_level = "churned";

  const risk_factors = isActiveMember
    ? generateRiskFactors(db, contact.student_id, {
        attendance: attendance.score,
        communication: communication.score,
        progression: progression.score,
      }, config.riskFactors)
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
 * Loads config once and reuses for all contacts.
 */
export function batchComputeEngagement(db: Database.Database): ScoreResult {
  const start = Date.now();
  const config = getEngagementConfig(db);

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
      const result = computeEngagement(db, contact.id, config);
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
