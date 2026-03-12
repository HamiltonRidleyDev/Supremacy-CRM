import { apiHandler } from "@/lib/api-handler";
import { getLeads, getLeadConversionFunnel } from "@/lib/queries";

export const GET = apiHandler(() => {
  const leads = getLeads();
  const funnel = getLeadConversionFunnel();
  return { leads, funnel };
}, { minRole: "manager" });
