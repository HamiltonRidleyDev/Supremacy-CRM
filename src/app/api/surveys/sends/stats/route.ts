import { apiHandler } from "@/lib/api-handler";
import { getSurveySendStats } from "@/lib/queries";

export const GET = apiHandler(() => {
  return getSurveySendStats();
}, { minRole: "manager" });
