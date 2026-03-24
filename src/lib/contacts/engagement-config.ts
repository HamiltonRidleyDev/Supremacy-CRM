import type Database from "better-sqlite3";

// ---- Config Types ----

export interface TierEntry {
  max: number; // maxDays, maxHours, etc.
  score: number;
}

export interface MinTierEntry {
  min: number; // minClassesPerMonth, minInbound, etc.
  score: number;
}

export interface EngagementConfig {
  weights: {
    attendance: number;
    communication: number;
    progression: number;
    community: number;
    financial: number;
  };
  riskLevels: {
    healthy: number;   // score >= this → healthy
    cooling: number;   // score >= this → cooling
    atRisk: number;    // score >= this → at_risk
    ghost: number;     // score >= this → ghost
    // below ghost → churned
  };
  attendance: {
    recencyWeight: number;
    volumeWeight: number;
    recency: TierEntry[];          // sorted ascending by max (days since last class)
    volume: MinTierEntry[];        // sorted descending by min (classes per month)
    // Granular scoring sub-weights (when detailed records exist)
    frequencyWeight: number;
    trendWeight: number;
    consistencyWeight: number;
    defaultTargetPerMonth: number;
    trendTiers: MinTierEntry[];    // ratio thresholds
    consistencyMultiplier: number; // stddev multiplier (default 25)
  };
  communication: {
    replyWeight: number;
    initiatedWeight: number;
    replyTime: TierEntry[];        // sorted ascending by max (hours)
    inboundCount: MinTierEntry[];  // sorted descending by min
    neutralDefault: number;        // score when no MM link
  };
  progression: {
    advancementWeight: number;
    breadthWeight: number;
    beltExpectedMonths: Record<string, number>;
    totalCategories: number;       // technique categories (default 9)
  };
  community: {
    membershipWeight: number;
    activityWeight: number;
    channelTiers: MinTierEntry[];
    messageTiers: MinTierEntry[];
    neutralDefault: number;
  };
  financial: {
    paymentWeight: number;
    rateWeight: number;
    vacationScore: number;
    activeScore: number;
    noRateScore: number;
    rateMultiplier: number;        // (rate / avgRate) * this, capped at 100
  };
  riskFactors: {
    ghostDays: number;             // days absent → "ghost" label
    warningDays: number;           // days absent → flagged
    noticeDays: number;            // days absent → notice
    lowAttendanceThreshold: number;
    decliningAttendanceThreshold: number;
    lowProgressionThreshold: number;
  };
}

// ---- Default Configuration (current hardcoded values) ----

export const DEFAULT_ENGAGEMENT_CONFIG: EngagementConfig = {
  weights: {
    attendance: 0.4,
    communication: 0.2,
    progression: 0.2,
    community: 0.1,
    financial: 0.1,
  },
  riskLevels: {
    healthy: 80,
    cooling: 60,
    atRisk: 40,
    ghost: 20,
  },
  attendance: {
    recencyWeight: 0.6,
    volumeWeight: 0.4,
    recency: [
      { max: 3, score: 100 },
      { max: 7, score: 90 },
      { max: 14, score: 70 },
      { max: 30, score: 50 },
      { max: 60, score: 25 },
      { max: 90, score: 10 },
    ],
    volume: [
      { min: 8, score: 100 },
      { min: 4, score: 75 },
      { min: 2, score: 50 },
      { min: 1, score: 30 },
      { min: 0, score: 10 },
    ],
    frequencyWeight: 0.5,
    trendWeight: 0.3,
    consistencyWeight: 0.2,
    defaultTargetPerMonth: 12,
    trendTiers: [
      { min: 1.2, score: 90 },
      { min: 0.8, score: 60 },
      { min: 0.5, score: 30 },
      { min: 0, score: 10 },
    ],
    consistencyMultiplier: 25,
  },
  communication: {
    replyWeight: 0.6,
    initiatedWeight: 0.4,
    replyTime: [
      { max: 4, score: 100 },
      { max: 24, score: 80 },
      { max: 999, score: 50 },
    ],
    inboundCount: [
      { min: 6, score: 100 },
      { min: 3, score: 80 },
      { min: 1, score: 50 },
      { min: 0, score: 0 },
    ],
    neutralDefault: 50,
  },
  progression: {
    advancementWeight: 0.5,
    breadthWeight: 0.5,
    beltExpectedMonths: {
      white: 0,
      blue: 18,
      purple: 42,
      brown: 72,
      black: 108,
    },
    totalCategories: 9,
  },
  community: {
    membershipWeight: 0.4,
    activityWeight: 0.6,
    channelTiers: [
      { min: 3, score: 100 },
      { min: 2, score: 80 },
      { min: 1, score: 50 },
      { min: 0, score: 0 },
    ],
    messageTiers: [
      { min: 6, score: 100 },
      { min: 3, score: 70 },
      { min: 1, score: 40 },
      { min: 0, score: 0 },
    ],
    neutralDefault: 50,
  },
  financial: {
    paymentWeight: 0.7,
    rateWeight: 0.3,
    vacationScore: 50,
    activeScore: 100,
    noRateScore: 20,
    rateMultiplier: 80,
  },
  riskFactors: {
    ghostDays: 90,
    warningDays: 30,
    noticeDays: 14,
    lowAttendanceThreshold: 30,
    decliningAttendanceThreshold: 50,
    lowProgressionThreshold: 30,
  },
};

// ---- DB Access ----

const SETTINGS_KEY = "engagement_config";

/** Deep merge: target values are overridden by source, preserving defaults for missing keys */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(defaults: any, overrides: any): any {
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (key in overrides) {
      const dVal = defaults[key];
      const oVal = overrides[key];
      if (dVal && typeof dVal === "object" && !Array.isArray(dVal) && oVal && typeof oVal === "object" && !Array.isArray(oVal)) {
        result[key] = deepMerge(dVal, oVal);
      } else {
        result[key] = oVal;
      }
    }
  }
  return result;
}

/** Load engagement config from DB, falling back to defaults for any missing values. */
export function getEngagementConfig(db: Database.Database): EngagementConfig {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(SETTINGS_KEY) as
    | { value: string }
    | undefined;

  if (!row) return DEFAULT_ENGAGEMENT_CONFIG;

  try {
    const saved = JSON.parse(row.value);
    return deepMerge(DEFAULT_ENGAGEMENT_CONFIG, saved);
  } catch {
    return DEFAULT_ENGAGEMENT_CONFIG;
  }
}

/** Save engagement config to DB. Validates weights sum and risk level ordering. */
export function saveEngagementConfig(db: Database.Database, config: EngagementConfig): void {
  // Validate weights sum to ~1.0
  const wSum =
    config.weights.attendance +
    config.weights.communication +
    config.weights.progression +
    config.weights.community +
    config.weights.financial;
  if (Math.abs(wSum - 1.0) > 0.02) {
    throw new Error(`Component weights must sum to 100% (currently ${Math.round(wSum * 100)}%)`);
  }

  // Validate risk level thresholds are descending
  const { healthy, cooling, atRisk, ghost } = config.riskLevels;
  if (!(healthy > cooling && cooling > atRisk && atRisk > ghost && ghost > 0)) {
    throw new Error("Risk level thresholds must be in descending order (Healthy > Cooling > At Risk > Ghost > 0)");
  }

  db.prepare(
    "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
  ).run(SETTINGS_KEY, JSON.stringify(config));
}

// ---- Signal Descriptions (for UI) ----

export const SIGNAL_DESCRIPTIONS = {
  weights: {
    title: "Component Weights",
    description: "How much each category contributes to the overall engagement score. Must total 100%.",
    fields: {
      attendance: "How often and recently the member trains. Heaviest signal — directly measures gym usage.",
      communication: "SMS/text responsiveness from Market Muscles conversations. NOTE: This data is currently frozen (MM API disabled March 2026). Consider reducing this weight.",
      progression: "Belt advancement pace relative to time invested, plus variety of techniques trained.",
      community: "Participation in in-app community channels and messaging. Only relevant if community features are active.",
      financial: "Payment status and rate tier relative to the gym average.",
    },
  },
  riskLevels: {
    title: "Risk Level Thresholds",
    description: "Score boundaries that determine each member's health classification. A member with a composite score of 72 and a 'Cooling' threshold of 60 would be classified as 'Cooling.'",
    fields: {
      healthy: "Members at or above this score are in good standing — training regularly, engaged, paying.",
      cooling: "Members at or above this score are showing early signs of disengagement — fewer classes, less interaction.",
      atRisk: "Members at or above this score need attention — significant drop in activity or communication.",
      ghost: "Members at or above this score have largely disappeared — very little recent activity.",
    },
  },
  attendance: {
    title: "Attendance",
    dataSource: "Zivvy class check-in records and attendance history",
    description: "Measures training frequency, recency, trend, and consistency. This is the most important signal for a BJJ gym.",
    sections: {
      recency: "How many days since their last class. Recent training is the strongest health indicator.",
      volume: "Average classes per month relative to their tenure. Higher frequency = more engaged.",
    },
  },
  communication: {
    title: "Communication",
    dataSource: "Market Muscles SMS conversation history (frozen as of March 2026)",
    description: "Measures how responsive the member is to gym outreach — do they reply to texts? How quickly? Do they ever initiate contact?",
    warning: "The Market Muscles CRM API was disabled in March 2026. Communication scores are based on historical data only. Consider reducing this weight to 0-5% until a new messaging source is connected.",
  },
  progression: {
    title: "Progression",
    dataSource: "Belt rank from Zivvy + technique categories from lesson plans",
    description: "Tracks whether the member is advancing at a reasonable pace for their time invested, and whether they're being exposed to a variety of techniques.",
  },
  community: {
    title: "Community",
    dataSource: "In-app community channels and messages",
    description: "Measures engagement with the gym's community features — channel memberships and message activity in the last 30 days.",
    warning: "If community channels haven't been set up yet, all members receive a neutral score of 50. Consider reducing this weight if the community feature isn't active.",
  },
  financial: {
    title: "Financial",
    dataSource: "Zivvy billing records",
    description: "Considers payment status (active, vacation hold, or no rate on file) and rate tier compared to the gym's average monthly rate.",
  },
  riskFactors: {
    title: "Risk Factor Triggers",
    description: "These thresholds control when specific warning labels appear on member profiles, independent of the composite score.",
    fields: {
      ghostDays: "Days absent before labeling as 'ghost' (e.g., 'No attendance in 95 days (ghost)').",
      warningDays: "Days absent before a warning flag (e.g., 'No attendance in 45 days').",
      noticeDays: "Days absent before a notice (e.g., '18 days since last class').",
      lowAttendanceThreshold: "Attendance component score below this triggers 'Very low attendance frequency.'",
      decliningAttendanceThreshold: "Attendance component score below this triggers 'Declining attendance trend.'",
      lowProgressionThreshold: "Progression component score below this triggers 'Limited technique exposure.'",
    },
  },
};
