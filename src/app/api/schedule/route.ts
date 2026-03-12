import { apiHandler } from "@/lib/api-handler";
import { getWeekSchedule } from "@/lib/queries";

export const GET = apiHandler((request) => {
  const { searchParams } = new URL(request.url);
  const weekOffset = parseInt(searchParams.get("week") || "0");
  return getWeekSchedule(weekOffset);
}, { minRole: "member" });
