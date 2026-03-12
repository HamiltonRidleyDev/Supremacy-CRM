import { apiHandler } from "@/lib/api-handler";
import {
  getDashboardStats,
  getRecentClasses,
  getRetentionMetrics,
  getAgeGroupDistribution,
  getLeadSourceDistribution,
  getProspectPipeline,
  getEnrollmentTrend,
  getWinBackTargets,
  getGeographicBreakdown,
  getZipDistribution,
  getBusinessInsights,
  getStrategicKPIs,
  getMonthlyNewStudentNames,
  getMonthlyChurnNames,
  getRevenueModelData,
} from "@/lib/queries";
import { ensureZivvySchema, ensureContactSchema } from "@/lib/db";
import { getNeedsAttention } from "@/lib/contacts/queries";

export const GET = apiHandler(() => {
  ensureZivvySchema();
  ensureContactSchema();
  const stats = getDashboardStats();
  const recentClasses = getRecentClasses();
  const retention = getRetentionMetrics();
  const ageGroups = getAgeGroupDistribution();
  const leadSources = getLeadSourceDistribution();
  const prospectPipeline = getProspectPipeline();
  const enrollmentTrend = getEnrollmentTrend();
  const winBackTargets = getWinBackTargets();
  const geography = getGeographicBreakdown();
  const zipDistribution = getZipDistribution();
  const insights = getBusinessInsights();
  const kpis = getStrategicKPIs();
  const newStudentNames = getMonthlyNewStudentNames();
  const churnNames = getMonthlyChurnNames();

  // Group names by month for easy lookup on the client
  const studentNamesByMonth: Record<string, string[]> = {};
  for (const r of newStudentNames) {
    if (!studentNamesByMonth[r.month]) studentNamesByMonth[r.month] = [];
    studentNamesByMonth[r.month].push(`${r.first_name} ${r.last_name}`.trim());
  }
  const churnNamesByMonth: Record<string, string[]> = {};
  for (const r of churnNames) {
    if (!churnNamesByMonth[r.month]) churnNamesByMonth[r.month] = [];
    churnNamesByMonth[r.month].push(`${r.first_name} ${r.last_name}`.trim());
  }

  return {
    stats,
    recentClasses,
    retention,
    ageGroups,
    leadSources,
    prospectPipeline,
    enrollmentTrend,
    winBackTargets,
    geography,
    zipDistribution,
    insights,
    kpis,
    revenueModel: getRevenueModelData(),
    studentNamesByMonth,
    churnNamesByMonth,
    needsAttention: getNeedsAttention(),
  };
});
