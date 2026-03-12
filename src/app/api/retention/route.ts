import { apiHandler } from "@/lib/api-handler";
import { getRetentionMetrics } from "@/lib/queries";
import { ensureContactSchema } from "@/lib/db";
import { getRetentionByRisk } from "@/lib/contacts/queries";

export const GET = apiHandler(() => {
  ensureContactSchema();
  const legacy = getRetentionMetrics();
  const riskPipeline = getRetentionByRisk();
  return { ...legacy, riskPipeline };
}, { minRole: "manager" });
