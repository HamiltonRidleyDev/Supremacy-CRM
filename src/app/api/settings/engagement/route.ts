import { apiHandler } from "@/lib/api-handler";
import { getDb, ensureContactSchema } from "@/lib/db";
import {
  getEngagementConfig,
  saveEngagementConfig,
  DEFAULT_ENGAGEMENT_CONFIG,
  SIGNAL_DESCRIPTIONS,
} from "@/lib/contacts/engagement-config";
import { batchComputeEngagement } from "@/lib/contacts/engagement";

/**
 * GET /api/settings/engagement — Returns current config, defaults, signal descriptions, and distribution
 */
export const GET = apiHandler(() => {
  ensureContactSchema();
  const db = getDb();

  const config = getEngagementConfig(db);

  // Current distribution
  const distribution = db.prepare(`
    SELECT risk_level, COUNT(*) as count, ROUND(AVG(engagement_score), 1) as avg_score
    FROM contacts WHERE risk_level IS NOT NULL
    GROUP BY risk_level
  `).all();

  const totalScored = (db.prepare(
    "SELECT COUNT(*) as count FROM contacts WHERE scored_at IS NOT NULL"
  ).get() as any)?.count || 0;

  return {
    config,
    defaults: DEFAULT_ENGAGEMENT_CONFIG,
    descriptions: SIGNAL_DESCRIPTIONS,
    distribution,
    totalScored,
  };
}, { minRole: "admin" });

/**
 * PATCH /api/settings/engagement — Save config and optionally re-score all members
 * Query param: ?rescore=true to trigger batch re-scoring after save
 */
export const PATCH = apiHandler(async (request) => {
  ensureContactSchema();
  const db = getDb();

  const body = await request.json();
  const { config, rescore } = body as { config: any; rescore?: boolean };

  if (!config) {
    return { error: "Missing config in request body" };
  }

  // Merge with defaults to ensure all fields exist
  const merged = { ...DEFAULT_ENGAGEMENT_CONFIG };
  for (const key of Object.keys(DEFAULT_ENGAGEMENT_CONFIG) as Array<keyof typeof DEFAULT_ENGAGEMENT_CONFIG>) {
    if (key in config) {
      if (typeof config[key] === "object" && !Array.isArray(config[key])) {
        (merged as any)[key] = { ...(DEFAULT_ENGAGEMENT_CONFIG as any)[key], ...config[key] };
      } else {
        (merged as any)[key] = config[key];
      }
    }
  }

  saveEngagementConfig(db, merged);

  let scoreResult = null;
  if (rescore) {
    scoreResult = batchComputeEngagement(db);
  }

  // Return updated distribution
  const distribution = db.prepare(`
    SELECT risk_level, COUNT(*) as count, ROUND(AVG(engagement_score), 1) as avg_score
    FROM contacts WHERE risk_level IS NOT NULL
    GROUP BY risk_level
  `).all();

  return {
    success: true,
    config: merged,
    distribution,
    scoreResult,
  };
}, { minRole: "admin" });
