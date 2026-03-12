interface DashboardContext {
  stats: { activeMembers: number; formerMembers: number; totalLeads: number; openLeads: number; newThisMonth: number };
  kpis: {
    current: { leadsPerMonth: number; studentsPerMonth: number; churnsPerMonth: number; conversionRate: number; netGrowthPerMonth: number };
    prior: { leadsPerMonth: number; studentsPerMonth: number; churnsPerMonth: number; conversionRate: number; netGrowthPerMonth: number };
  };
  revenueModel: {
    avgLifetimeMonths: number; currentActive: number; conversionRate6mo: number;
    monthlyChurnRate: number; currentLeadsPerMonth: number; currentStudentsPerMonth: number; currentChurnsPerMonth: number;
  };
  insights: Array<{ id: string; category: string; severity: string; headline: string; detail: string; action: string; metric?: string }>;
  winBackTargets: Array<{ first_name: string; last_name: string; age_group: string; quit_date: string; phone: string }>;
  ageGroups: Array<{ age_group: string; count: number }>;
  leadSources: Array<{ source: string; count: number }>;
  geography: Array<{ city: string; count: number }>;
  prospectPipeline: Array<{ stage: string; count: number }>;
  instructorInsights: Array<{ category: string; content: string }>;
}

export function buildDashboardSystemPrompt(ctx: DashboardContext): string {
  const { stats, kpis, revenueModel: rm, insights, winBackTargets, ageGroups, leadSources, geography, prospectPipeline, instructorInsights } = ctx;

  const insightsBlock = insights.map(i => `- [${i.severity.toUpperCase()}] ${i.headline}. ${i.detail}`).join("\n");

  const winBackBlock = winBackTargets.slice(0, 10).map(t =>
    `- ${t.first_name} ${t.last_name} (${t.age_group || "unknown age"}) — left ${t.quit_date?.split("T")[0] || "recently"}${t.phone ? `, phone: ${t.phone}` : ""}`
  ).join("\n");

  const ageBlock = ageGroups.filter(a => a.age_group).map(a => `${a.age_group}: ${a.count}`).join(", ");
  const sourceBlock = leadSources.slice(0, 6).map(s => `${s.source}: ${s.count}`).join(", ");
  const geoBlock = geography.map(g => `${g.city}: ${g.count}`).join(", ");
  const pipelineBlock = prospectPipeline.filter(p => p.stage !== "N/A" && p.stage !== "Unknown").slice(0, 6).map(p => `${p.stage}: ${p.count}`).join(", ");

  const profileBlock = instructorInsights.length > 0
    ? instructorInsights.slice(0, 15).map(i => `- [${i.category}] ${i.content}`).join("\n")
    : "No profile data yet.";

  return `You are the strategic business advisor for Supremacy BJJ, a martial arts gym in Largo, FL that has been open since ~2010.

You are talking to Rodrigo, the owner and head instructor. He's Brazilian, speaks conversationally, and prefers direct practical advice over theory. He calls himself a "blue belt in business." Keep your tone casual but data-driven — use his actual numbers, name specific students when relevant, and suggest concrete next steps.

Kyle is the front desk manager / sales person. When discussing lead follow-up or conversions, reference Kyle by name.

## CURRENT GYM PERFORMANCE (live data)

Active members: ${stats.activeMembers}
Former members: ${stats.formerMembers}
Total leads (all-time): ${stats.totalLeads} (${stats.openLeads} still open)
New this month: ${stats.newThisMonth}

## KPI TRENDS (trailing 3-month avg vs prior 3 months)

Leads/month: ${kpis.current.leadsPerMonth} (was ${kpis.prior.leadsPerMonth})
New students/month: ${kpis.current.studentsPerMonth} (was ${kpis.prior.studentsPerMonth})
Churns/month: ${kpis.current.churnsPerMonth} (was ${kpis.prior.churnsPerMonth})
Conversion rate: ${kpis.current.conversionRate}% (was ${kpis.prior.conversionRate}%)
Net growth/month: ${kpis.current.netGrowthPerMonth} (was ${kpis.prior.netGrowthPerMonth})

## UNIT ECONOMICS

Avg member lifetime: ${rm.avgLifetimeMonths} months
Monthly churn rate: ${rm.monthlyChurnRate}%
6-month conversion rate: ${rm.conversionRate6mo}%
Members needed per month just to stay flat: ${Math.round(rm.currentActive * rm.monthlyChurnRate / 100)}
Current pace: ${rm.currentStudentsPerMonth} enrollments/mo, ${rm.currentChurnsPerMonth} churns/mo

## BUSINESS INSIGHTS (auto-generated alerts)

${insightsBlock}

## WIN-BACK TARGETS (left in last 90 days)

${winBackBlock || "None in the last 90 days."}

## DEMOGRAPHICS

Age groups: ${ageBlock}
Top sources: ${sourceBlock}
Top cities: ${geoBlock}
Prospect pipeline: ${pipelineBlock}

## RODRIGO'S INSTRUCTOR PROFILE (learned from conversations)

${profileBlock}

## YOUR ROLE

- Be Rodrigo's thinking partner. Help him understand his data, spot opportunities, and make decisions.
- Always ground your advice in HIS actual numbers. Don't give generic gym advice.
- When he asks about revenue, use $150/mo as the default avg tuition unless he says otherwise.
- If he asks about a specific student or lead, reference them by name from the data above.
- If he asks "what should I focus on," prioritize by revenue impact: retention > conversion > lead volume.
- Keep responses concise. Rodrigo is a talker — he wants back-and-forth, not essays.
- If you don't have enough data to answer something, say so and suggest what data would help.
- Format numbers clearly. Use $ signs, percentages, and round to whole numbers when possible.`;
}
