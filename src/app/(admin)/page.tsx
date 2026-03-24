"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardChat from "@/components/DashboardChat";
import ActionCenter from "@/components/ActionCenter";
import InfoTip from "@/components/InfoTip";
import PinnedItems from "@/components/PinnedItems";
import { useIsMobile } from "@/hooks/useIsMobile";

interface DashboardData {
  stats: {
    activeMembers: number;
    formerMembers: number;
    totalLeads: number;
    openLeads: number;
    monthlyRevenue: number;
    lessonPlansThisMonth: number;
    newThisMonth: number;
  };
  recentClasses: Array<{
    id: number;
    date: string;
    start_time: string;
    class_type: string;
    instructor: string;
    lesson_title: string | null;
    position_area: string | null;
    attendance_count: number;
  }>;
  retention: {
    atRisk: Array<{
      id: number;
      first_name: string;
      last_name: string;
      belt_rank: string;
      days_since_last: number;
    }>;
    churned: Array<{
      id: number;
      first_name: string;
      last_name: string;
      belt_rank: string;
      months_active: number;
      notes: string;
    }>;
    beltDistribution: Array<{ belt_rank: string; count: number }>;
  };
  ageGroups: Array<{ age_group: string; count: number }>;
  leadSources: Array<{ source: string; count: number }>;
  prospectPipeline: Array<{ stage: string; count: number }>;
  enrollmentTrend: Array<{ month: string; count: number }>;
  winBackTargets: Array<{
    id: number; first_name: string; last_name: string;
    age_group: string; source: string; quit_date: string;
    email: string; phone: string;
  }>;
  geography: Array<{ city: string; count: number }>;
  zipDistribution: Array<{ zip: string; count: number }>;
  insights: Array<{
    id: string;
    category: "growth" | "retention" | "leads" | "operations";
    severity: "critical" | "warning" | "positive" | "info";
    headline: string;
    detail: string;
    action: string;
    metric?: string;
  }>;
  studentNamesByMonth: Record<string, string[]>;
  churnNamesByMonth: Record<string, string[]>;
  revenueModel: {
    avgLifetimeMonths: number;
    currentActive: number;
    conversionRate6mo: number;
    monthlyChurnRate: number;
    currentLeadsPerMonth: number;
    currentStudentsPerMonth: number;
    currentChurnsPerMonth: number;
  };
  kpis: {
    monthly: Array<{
      month: string;
      newLeads: number;
      newStudents: number;
      churns: number;
      netGrowth: number;
      conversionRate: number;
    }>;
    current: { leadsPerMonth: number; studentsPerMonth: number; churnsPerMonth: number; conversionRate: number; netGrowthPerMonth: number };
    prior: { leadsPerMonth: number; studentsPerMonth: number; churnsPerMonth: number; conversionRate: number; netGrowthPerMonth: number };
  };
  needsAttention: {
    atRiskCount: number;
    ghostCount: number;
    coolingCount: number;
    healthyCount: number;
    revenueAtRisk: number;
    scoreDistribution: Record<string, number>;
    topAtRisk: Array<{
      id: number;
      first_name: string;
      last_name: string;
      engagement_score: number;
      risk_level: string;
      risk_factors: string[];
      monthly_revenue: number;
      last_attendance: string;
      days_absent: number;
    }>;
    lastScoredAt: string | null;
    avgScore: number;
  };
}

interface SyncInfo {
  status: string;
  started_at: string;
  completed_at: string | null;
  students_synced: number;
  leads_synced: number;
  former_synced: number;
  total_contacts: number;
  error_message: string | null;
}

const ageGroupColors: Record<string, string> = {
  Adults: "#3b82f6",
  "Tiny Ninjas": "#f59e0b",
  "Little Ninjas": "#10b981",
  Teens: "#8b5cf6",
  Unknown: "#6b7280",
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:border-accent/30 transition-colors">
      <p className="text-xs text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

function DataGapCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-card rounded-xl border border-dashed border-warning/40 p-4">
      <div className="flex items-center gap-2 mb-1">
        <svg className="h-3.5 w-3.5 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-xs font-semibold text-warning">{title}</p>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">{description}</p>
    </div>
  );
}

const severityStyles = {
  critical: { border: "border-danger/50", bg: "bg-danger/5", icon: "text-danger", badge: "bg-danger/10 text-danger" },
  warning: { border: "border-warning/50", bg: "bg-warning/5", icon: "text-warning", badge: "bg-warning/10 text-warning" },
  positive: { border: "border-success/50", bg: "bg-success/5", icon: "text-success", badge: "bg-success/10 text-success" },
  info: { border: "border-accent/50", bg: "bg-accent/5", icon: "text-accent", badge: "bg-accent/10 text-accent" },
};

const severityIcons = {
  critical: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
  warning: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  positive: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  info: <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
};

const categoryLabels: Record<string, string> = {
  retention: "Retention",
  growth: "Growth",
  leads: "Lead Funnel",
  operations: "Operations",
};

function InsightCard({ insight }: { insight: DashboardData["insights"][0] }) {
  const style = severityStyles[insight.severity];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-3 transition-all flex flex-col`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <svg className={`h-3.5 w-3.5 ${style.icon} flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {severityIcons[insight.severity]}
        </svg>
        <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${style.badge}`}>
          {categoryLabels[insight.category]}
        </span>
        {insight.metric && (
          <span className="text-[10px] font-mono text-muted ml-auto">{insight.metric}</span>
        )}
      </div>
      <p className="text-xs font-semibold leading-snug">{insight.headline}</p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[11px] text-muted hover:text-foreground mt-1.5 transition-colors text-left"
      >
        {expanded ? "Hide" : "What should I do?"}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[11px] text-muted leading-relaxed">{insight.detail}</p>
          <div className="bg-background/50 rounded p-2 border border-border/50">
            <p className="text-[11px] text-muted leading-relaxed"><span className="font-medium text-foreground">Action:</span> {insight.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BarChart({ data, colorFn, maxWidth = 100 }: {
  data: Array<{ label: string; value: number }>;
  colorFn?: (label: string) => string;
  maxWidth?: number;
}) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs text-muted truncate max-w-[60%]">{d.label}</span>
            <span className="text-xs font-medium">{d.value}</span>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / max) * maxWidth}%`,
                backgroundColor: colorFn?.(d.label) || "#3b82f6",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Approximate centroids for Pinellas County zip codes
const zipCoords: Record<string, { lat: number; lng: number; area: string }> = {
  "33701": { lat: 27.773, lng: -82.640, area: "Downtown St Pete" },
  "33702": { lat: 27.821, lng: -82.631, area: "NE St Pete" },
  "33703": { lat: 27.834, lng: -82.622, area: "NE St Pete" },
  "33704": { lat: 27.791, lng: -82.636, area: "St Pete" },
  "33705": { lat: 27.748, lng: -82.660, area: "S St Pete" },
  "33707": { lat: 27.747, lng: -82.728, area: "Gulfport" },
  "33708": { lat: 27.770, lng: -82.770, area: "Treasure Island" },
  "33709": { lat: 27.789, lng: -82.738, area: "Kenneth City" },
  "33710": { lat: 27.798, lng: -82.719, area: "NW St Pete" },
  "33713": { lat: 27.785, lng: -82.679, area: "St Pete" },
  "33714": { lat: 27.815, lng: -82.681, area: "N St Pete" },
  "33716": { lat: 27.855, lng: -82.640, area: "Gateway" },
  "33755": { lat: 27.966, lng: -82.798, area: "Clearwater" },
  "33756": { lat: 27.958, lng: -82.775, area: "Clearwater" },
  "33759": { lat: 27.913, lng: -82.722, area: "Clearwater" },
  "33760": { lat: 27.906, lng: -82.709, area: "Clearwater" },
  "33761": { lat: 27.925, lng: -82.725, area: "Clearwater" },
  "33762": { lat: 27.880, lng: -82.668, area: "Feathersound" },
  "33763": { lat: 27.944, lng: -82.740, area: "Clearwater" },
  "33764": { lat: 27.907, lng: -82.747, area: "Clearwater" },
  "33766": { lat: 27.906, lng: -82.755, area: "Clearwater" },
  "33767": { lat: 27.978, lng: -82.827, area: "Clearwater Beach" },
  "33770": { lat: 27.909, lng: -82.806, area: "Largo" },
  "33771": { lat: 27.909, lng: -82.768, area: "Largo" },
  "33772": { lat: 27.840, lng: -82.788, area: "Seminole" },
  "33773": { lat: 27.893, lng: -82.790, area: "Largo" },
  "33774": { lat: 27.858, lng: -82.789, area: "Seminole" },
  "33776": { lat: 27.843, lng: -82.749, area: "Seminole" },
  "33777": { lat: 27.853, lng: -82.728, area: "Seminole" },
  "33778": { lat: 27.878, lng: -82.753, area: "Largo" },
  "33781": { lat: 27.841, lng: -82.698, area: "Pinellas Park" },
  "33782": { lat: 27.855, lng: -82.676, area: "Pinellas Park" },
  "33786": { lat: 27.935, lng: -82.843, area: "Indian Rocks" },
  "34655": { lat: 28.150, lng: -82.655, area: "New Port Richey" },
  "34683": { lat: 28.086, lng: -82.755, area: "Palm Harbor" },
  "34698": { lat: 28.014, lng: -82.784, area: "Dunedin" },
};

// Simplified Pinellas peninsula outline (lat/lng pairs, clockwise from NW)
const peninsulaOutline: [number, number][] = [
  [28.08, -82.79], [28.08, -82.63],  // north edge
  [28.00, -82.63], [27.96, -82.64], [27.92, -82.64], [27.88, -82.65], // east coast (Tampa Bay)
  [27.84, -82.63], [27.80, -82.63], [27.76, -82.64], [27.73, -82.65], [27.71, -82.67],
  [27.71, -82.74], // south tip
  [27.73, -82.78], [27.77, -82.80], [27.82, -82.81], [27.87, -82.82], // west coast (Gulf)
  [27.92, -82.83], [27.97, -82.83], [28.00, -82.82], [28.05, -82.80],
];

// Map projection: lat/lng → SVG x/y
const MAP_BOUNDS = { latMin: 27.68, latMax: 28.12, lngMin: -82.88, lngMax: -82.56 };
const SVG_W = 380;
const SVG_H = 480;

function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * SVG_W,
    y: ((MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * SVG_H,
  };
}

// Supremacy BJJ location (Largo)
const GYM_LOC = project(27.893, -82.789);

function ZipBubbleMap({ data }: { data: Array<{ zip: string; count: number }> }) {
  const [hovered, setHovered] = useState<{ zip: string; count: number; area: string; x: number; y: number } | null>(null);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Build peninsula SVG path
  const landPath = peninsulaOutline
    .map((p, i) => {
      const { x, y } = project(p[0], p[1]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ") + " Z";

  // Only render zips we have coordinates for
  const mapped = data
    .filter((d) => zipCoords[d.zip])
    .map((d) => {
      const coord = zipCoords[d.zip];
      const { x, y } = project(coord.lat, coord.lng);
      const r = 6 + Math.sqrt(d.count / maxCount) * 18;
      return { ...d, x, y, r, area: coord.area };
    });

  // Outside-map zips summary
  const unmapped = data.filter((d) => !zipCoords[d.zip]);
  const unmappedTotal = unmapped.reduce((s, d) => s + d.count, 0);

  // Region labels
  const labels = [
    { text: "Clearwater", ...project(27.97, -82.76) },
    { text: "Largo", ...project(27.91, -82.81) },
    { text: "Seminole", ...project(27.83, -82.80) },
    { text: "St. Pete", ...project(27.77, -82.65) },
    { text: "Pinellas Park", ...project(27.84, -82.68) },
  ];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto">
        {/* Water background */}
        <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#0c1929" rx="8" />

        {/* Land mass */}
        <path d={landPath} fill="#1a2332" stroke="#2a3a4a" strokeWidth="1" />

        {/* Region labels */}
        {labels.map((l) => (
          <text
            key={l.text}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            className="fill-[#3a4a5a] text-[9px] font-medium pointer-events-none select-none"
          >
            {l.text}
          </text>
        ))}

        {/* Gym marker */}
        <g>
          <circle cx={GYM_LOC.x} cy={GYM_LOC.y} r="4" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
          <text
            x={GYM_LOC.x}
            y={GYM_LOC.y - 8}
            textAnchor="middle"
            className="fill-[#ef4444] text-[8px] font-bold pointer-events-none select-none"
          >
            SUPREMACY
          </text>
        </g>

        {/* Bubbles — render smallest first so big ones are on top */}
        {[...mapped].sort((a, b) => a.count - b.count).map((d) => {
          const opacity = 0.3 + (d.count / maxCount) * 0.5;
          return (
            <g
              key={d.zip}
              onMouseEnter={() => setHovered({ zip: d.zip, count: d.count, area: d.area, x: d.x, y: d.y })}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <circle
                cx={d.x}
                cy={d.y}
                r={d.r}
                fill="#3b82f6"
                opacity={opacity}
                stroke="#60a5fa"
                strokeWidth="1"
              />
              {d.count >= 5 && (
                <text
                  x={d.x}
                  y={d.y + 3.5}
                  textAnchor="middle"
                  className="fill-white text-[10px] font-bold pointer-events-none select-none"
                >
                  {d.count}
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip */}
        {hovered && (
          <g>
            <rect
              x={hovered.x + 12}
              y={hovered.y - 24}
              width={Math.max(hovered.area.length, hovered.zip.length + 4) * 7 + 16}
              height="36"
              rx="4"
              fill="#1e293b"
              stroke="#334155"
              strokeWidth="1"
            />
            <text x={hovered.x + 20} y={hovered.y - 8} className="fill-white text-[11px] font-semibold">
              {hovered.area}
            </text>
            <text x={hovered.x + 20} y={hovered.y + 6} className="fill-[#94a3b8] text-[10px]">
              {hovered.zip} — {hovered.count} students
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-white/30" />
            <span className="text-[10px] text-muted">Gym</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#3b82f6]/50 border border-[#60a5fa]" />
            <span className="text-[10px] text-muted">Students by zip</span>
          </div>
        </div>
        {unmappedTotal > 0 && (
          <span className="text-[10px] text-muted">+{unmappedTotal} outside area</span>
        )}
      </div>
    </div>
  );
}

function SyncButton({ label, endpoint, formatResult }: {
  label: string;
  endpoint: string;
  formatResult?: (data: any) => string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.status === "error" || (data.error && data.status !== "success")) {
        setError(data.error || "Sync failed");
      } else {
        setResult(formatResult ? formatResult(data) : "Done");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-success truncate max-w-[180px]">{result}</span>}
      {error && <span className="text-xs text-danger truncate max-w-[180px]" title={error}>{error}</span>}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-card-hover disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        {syncing ? (
          <>
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Syncing...
          </>
        ) : (
          <>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {label}
          </>
        )}
      </button>
    </div>
  );
}

function SyncPanel() {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <SyncButton
        label="Sync Zivvy"
        endpoint="/api/sync"
        formatResult={(d) => `${d.students_synced + d.leads_synced + d.former_synced} contacts in ${(d.duration_ms / 1000).toFixed(0)}s`}
      />
      <SyncButton
        label="Sync Market Muscles"
        endpoint="/api/sync-mm"
        formatResult={(d) => `${d.contacts_synced} contacts, ${d.conversations_synced} convos`}
      />
      <SyncButton
        label="Enrich Data"
        endpoint="/api/sync-enrich"
        formatResult={(d) => `${d.engagement?.contacts_scored || 0} scored`}
      />
    </div>
  );
}

function formatMonth(monthStr: string) {
  const [, m] = monthStr.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[parseInt(m)] || m;
}

type Section = "attention" | "kpis" | "targets" | "insights" | "winback" | "snapshot" | "trends" | "pipeline" | "gaps";

const sections: { key: Section; label: string }[] = [
  { key: "attention", label: "Attention" },
  { key: "kpis", label: "KPIs" },
  { key: "targets", label: "$ Targets" },
  { key: "insights", label: "Insights" },
  { key: "winback", label: "Win-Back" },
  { key: "snapshot", label: "Snapshot" },
  { key: "trends", label: "Trends" },
  { key: "pipeline", label: "Pipeline" },
  { key: "gaps", label: "Data Gaps" },
];

export default function Dashboard() {
  const { isMobile, isReady } = useIsMobile();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Section | null;
  const [activeSection, setActiveSection] = useState<Section>(tabParam && sections.some(s => s.key === tabParam) ? tabParam : "attention");
  const [avgTuition, setAvgTuition] = useState(150);
  const [memberGoal, setMemberGoal] = useState(300);
  const [winbackData, setWinbackData] = useState<{ candidates: any[]; activeSuggestions: any[]; costTrends: Record<string, any> } | null>(null);
  const [winbackLoading, setWinbackLoading] = useState(false);

  // Desktop default: redirect to Daily Briefing on first app open only.
  // Once the user has navigated anywhere, they can return to / freely.
  useEffect(() => {
    if (isReady && !isMobile) {
      const key = "supremacy_landed";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        router.replace("/briefing");
      }
    }
  }, [isReady, isMobile, router]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fetchWinback = useCallback(() => {
    setWinbackLoading(true);
    fetch("/api/winback")
      .then((r) => r.json())
      .then(setWinbackData)
      .catch(() => {})
      .finally(() => setWinbackLoading(false));
  }, []);

  useEffect(() => {
    if (activeSection === "winback" && !winbackData) {
      fetchWinback();
    }
  }, [activeSection, winbackData, fetchWinback]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-danger font-medium">Failed to load dashboard</p>
          <p className="text-sm text-muted mt-1">{error || "No data returned"}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm text-accent hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const { stats, insights, ageGroups, leadSources, prospectPipeline, enrollmentTrend, winBackTargets, geography, zipDistribution, kpis, revenueModel, studentNamesByMonth, churnNamesByMonth } = data;
  const enrollMax = Math.max(...enrollmentTrend.map((e) => e.count), 1);

  // Sort insights: critical first, then warning, then info, then positive
  const sortedInsights = [...insights].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2, positive: 3 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="max-w-7xl">
      {/* Header with sync */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Supremacy BJJ — Largo, FL</p>
        </div>
        <SyncPanel />
      </div>

      {/* Pinned items from Quick chat */}
      <div className="mb-6">
        <PinnedItems />
      </div>

      {/* Top Stats — compact row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Active Students" value={stats.activeMembers} sub={`+${stats.newThisMonth} this month`} color="text-success" />
        <StatCard label="Monthly Revenue" value={`$${(stats.monthlyRevenue / 1000).toFixed(1)}k`} />
        <StatCard label="At Risk" value={(data.needsAttention?.atRiskCount || 0) + (data.needsAttention?.ghostCount || 0)} sub={data.needsAttention?.revenueAtRisk ? `$${data.needsAttention.revenueAtRisk.toLocaleString()}/mo at risk` : undefined} color="text-danger" />
        <StatCard label="Total Leads" value={stats.totalLeads.toLocaleString()} sub={`${stats.openLeads.toLocaleString()} open`} color="text-accent" />
        <StatCard label="Lesson Plans" value={stats.lessonPlansThisMonth} sub="created this month" />
      </div>

      {/* Section Pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              activeSection === s.key
                ? "bg-accent text-white"
                : "bg-card border border-border text-muted hover:text-foreground hover:border-accent/40"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* AT-RISK / ATTENTION CENTER */}
      {activeSection === "attention" && (() => {
        const attn = data.needsAttention;
        if (!attn) return (
          <div className="bg-card rounded-xl border border-dashed border-border p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center text-muted mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-sm font-semibold mb-1">Engagement Scoring Not Yet Run</p>
            <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
              This tab shows which members are at risk of leaving based on attendance, communication, and progression patterns.
              To populate it: 1) Sync data from Zivvy, 2) Run engagement scoring via the Contacts API. Once scored, you'll see a risk breakdown and prioritized outreach list.
            </p>
            <Link href="/getting-started" className="inline-block mt-4 text-xs text-accent hover:underline">
              Learn more in Getting Started
            </Link>
          </div>
        );

        const totalAtRisk = attn.atRiskCount + attn.ghostCount;
        const totalScored = attn.healthyCount + attn.coolingCount + attn.atRiskCount + attn.ghostCount;
        const healthyPct = totalScored > 0 ? Math.round((attn.healthyCount / totalScored) * 100) : 0;

        const riskBadgeColor: Record<string, string> = {
          ghost: "bg-red-500/15 text-red-400",
          at_risk: "bg-orange-500/15 text-orange-400",
          cooling: "bg-yellow-500/15 text-yellow-400",
          healthy: "bg-green-500/15 text-green-400",
        };

        return (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Member Health Overview</h2>

            {/* Risk Distribution Bar */}
            <div className="bg-card rounded-xl border border-border p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold">Risk Distribution <InfoTip text="Shows how your active members are distributed across health categories. Healthy members need no action; Ghost members are paying but haven't trained in 90+ days." wide={true} /></p>
                  <p className="text-xs text-muted mt-0.5">{totalScored} scored members — {healthyPct}% healthy</p>
                </div>
                {attn.lastScoredAt && (
                  <span className="text-[10px] text-muted">
                    Scored {new Date(attn.lastScoredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>

              {/* Stacked bar */}
              <div className="h-6 flex rounded-full overflow-hidden mb-3">
                {attn.healthyCount > 0 && (
                  <div className="bg-green-500/60 transition-all" style={{ width: `${(attn.healthyCount / totalScored) * 100}%` }}
                    title={`${attn.healthyCount} healthy`} />
                )}
                {attn.coolingCount > 0 && (
                  <div className="bg-yellow-500/60 transition-all" style={{ width: `${(attn.coolingCount / totalScored) * 100}%` }}
                    title={`${attn.coolingCount} cooling`} />
                )}
                {attn.atRiskCount > 0 && (
                  <div className="bg-orange-500/60 transition-all" style={{ width: `${(attn.atRiskCount / totalScored) * 100}%` }}
                    title={`${attn.atRiskCount} at risk`} />
                )}
                {attn.ghostCount > 0 && (
                  <div className="bg-red-500/60 transition-all" style={{ width: `${(attn.ghostCount / totalScored) * 100}%` }}
                    title={`${attn.ghostCount} ghost`} />
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500/60" /> Healthy ({attn.healthyCount})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /> Cooling ({attn.coolingCount})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500/60" /> At Risk ({attn.atRiskCount})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500/60" /> Ghost ({attn.ghostCount})</span>
              </div>
            </div>

            {/* Revenue at Risk Alert */}
            {attn.revenueAtRisk > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-400">${attn.revenueAtRisk.toLocaleString()}/mo revenue at risk <InfoTip text="Monthly revenue from members classified as At Risk or Ghost. This is money that will disappear if they cancel." /></p>
                  <p className="text-xs text-muted mt-0.5">{totalAtRisk} members need outreach — avg engagement score: {attn.avgScore ?? "N/A"}</p>
                </div>
                <button
                  onClick={() => setActiveSection("winback")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                >
                  Open Win-Back
                </button>
              </div>
            )}

            {/* Top At-Risk Members Table */}
            {attn.topAtRisk.length > 0 && (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Members Needing Attention</h3>
                    <p className="text-xs text-muted mt-0.5">Sorted by revenue impact — click to view details</p>
                  </div>
                  <Link href="/students" className="text-xs text-accent hover:underline">View All Students</Link>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-2.5 text-[10px] text-muted uppercase tracking-wider font-medium">Member</th>
                      <th className="px-4 py-2.5 text-[10px] text-muted uppercase tracking-wider font-medium">Score</th>
                      <th className="px-4 py-2.5 text-[10px] text-muted uppercase tracking-wider font-medium">Risk</th>
                      <th className="px-4 py-2.5 text-[10px] text-muted uppercase tracking-wider font-medium">Days Absent</th>
                      <th className="px-4 py-2.5 text-[10px] text-muted uppercase tracking-wider font-medium text-right">Revenue</th>
                      <th className="px-4 py-2.5 text-[10px] text-muted uppercase tracking-wider font-medium">Risk Factors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attn.topAtRisk.map((m) => (
                      <tr key={m.id} className="hover:bg-card-hover transition-colors">
                        <td className="px-4 py-2.5">
                          <Link href={`/students/${m.id}`} className="text-sm font-medium hover:text-accent transition-colors">
                            {m.first_name} {m.last_name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            (m.engagement_score ?? 0) >= 70 ? "bg-green-500/15 text-green-400" :
                            (m.engagement_score ?? 0) >= 40 ? "bg-yellow-500/15 text-yellow-400" :
                            "bg-red-500/15 text-red-400"
                          }`}>
                            {m.engagement_score ?? "?"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${riskBadgeColor[m.risk_level] || "bg-zinc-500/15 text-zinc-400"}`}>
                            {m.risk_level?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-sm ${m.days_absent > 60 ? "text-red-400 font-semibold" : m.days_absent > 30 ? "text-orange-400" : "text-muted"}`}>
                            {m.days_absent > 0 ? `${m.days_absent}d` : "--"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {m.monthly_revenue > 0 ? (
                            <span className="text-sm font-medium">${m.monthly_revenue}/mo</span>
                          ) : (
                            <span className="text-xs text-muted">--</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(m.risk_factors || []).slice(0, 2).map((f, i) => (
                              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted truncate max-w-[120px]">{f}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* STRATEGIC KPIs */}
      {activeSection === "kpis" && (() => {
        const { monthly, current, prior } = kpis;
        const chartData = monthly.slice(-12);
        const maxLeads = Math.max(...chartData.map(m => m.newLeads), 1);
        const maxEnrollChurn = Math.max(...chartData.map(m => Math.max(m.newStudents, m.churns)), 1);
        const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const fmtMonth = (mo: string) => { const [y, m] = mo.split("-"); return `${monthNames[parseInt(m)]} '${y.slice(2)}`; };
        const fmtMonthShort = (mo: string) => monthNames[parseInt(mo.split("-")[1])];

        function trend(curr: number, prev: number): { dir: "up" | "down" | "flat"; pct: number; color: string } {
          if (prev === 0 && curr === 0) return { dir: "flat", pct: 0, color: "text-muted" };
          if (prev === 0) return { dir: "up", pct: 100, color: "text-success" };
          const pct = Math.round(((curr - prev) / prev) * 100);
          if (Math.abs(pct) < 3) return { dir: "flat", pct: 0, color: "text-muted" };
          return { dir: pct > 0 ? "up" : "down", pct: Math.abs(pct), color: pct > 0 ? "text-success" : "text-danger" };
        }
        function churnTrendFn(curr: number, prev: number) {
          const t = trend(curr, prev);
          if (t.dir === "up") return { ...t, color: "text-danger" };
          if (t.dir === "down") return { ...t, color: "text-success" };
          return t;
        }

        const leadsTrend = trend(current.leadsPerMonth, prior.leadsPerMonth);
        const studentsTrend = trend(current.studentsPerMonth, prior.studentsPerMonth);
        const churnTrendVal = churnTrendFn(current.churnsPerMonth, prior.churnsPerMonth);
        const convTrend = trend(current.conversionRate, prior.conversionRate);
        const netTrend = (() => {
          const t = trend(
            Math.abs(current.netGrowthPerMonth),
            Math.abs(prior.netGrowthPerMonth)
          );
          // Override: positive net growth getting better = green, getting worse = red
          if (current.netGrowthPerMonth > prior.netGrowthPerMonth) return { dir: "up" as const, pct: t.pct, color: "text-success" };
          if (current.netGrowthPerMonth < prior.netGrowthPerMonth) return { dir: "down" as const, pct: t.pct, color: "text-danger" };
          return { dir: "flat" as const, pct: 0, color: "text-muted" };
        })();

        const arrow = (dir: "up" | "down" | "flat") =>
          dir === "up" ? "\u25B2" : dir === "down" ? "\u25BC" : "\u25C6";

        return (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Strategic KPIs — 3-Month Trend</h2>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider">Leads / Month</p>
                <p className="text-xl font-bold mt-1">{current.leadsPerMonth}</p>
                <p className={`text-xs mt-1 ${leadsTrend.color}`}>
                  {arrow(leadsTrend.dir)} {leadsTrend.pct > 0 ? `${leadsTrend.pct}%` : "Flat"} <span className="text-muted">vs prior 3mo</span>
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider">New Students / Mo</p>
                <p className="text-xl font-bold text-success mt-1">{current.studentsPerMonth}</p>
                <p className={`text-xs mt-1 ${studentsTrend.color}`}>
                  {arrow(studentsTrend.dir)} {studentsTrend.pct > 0 ? `${studentsTrend.pct}%` : "Flat"} <span className="text-muted">vs prior 3mo</span>
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider">Churns / Month</p>
                <p className="text-xl font-bold text-danger mt-1">{current.churnsPerMonth}</p>
                <p className={`text-xs mt-1 ${churnTrendVal.color}`}>
                  {arrow(churnTrendVal.dir)} {churnTrendVal.pct > 0 ? `${churnTrendVal.pct}%` : "Flat"} <span className="text-muted">vs prior 3mo</span>
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider">Conversion Rate</p>
                <p className="text-xl font-bold text-accent mt-1">{current.conversionRate}%</p>
                <p className={`text-xs mt-1 ${convTrend.color}`}>
                  {arrow(convTrend.dir)} {convTrend.pct > 0 ? `${convTrend.pct}%` : "Flat"} <span className="text-muted">vs prior 3mo</span>
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 col-span-2 lg:col-span-1">
                <p className="text-[10px] text-muted uppercase tracking-wider">Net Growth / Mo</p>
                <p className={`text-xl font-bold mt-1 ${current.netGrowthPerMonth >= 0 ? "text-success" : "text-danger"}`}>
                  {current.netGrowthPerMonth >= 0 ? "+" : ""}{current.netGrowthPerMonth}
                </p>
                <p className={`text-xs mt-1 ${netTrend.color}`}>
                  {arrow(netTrend.dir)} {netTrend.pct > 0 ? `${netTrend.pct}%` : "Flat"} <span className="text-muted">vs prior 3mo</span>
                </p>
              </div>
            </div>

            {/* Lead Volume — own scale */}
            <div className="bg-card rounded-xl border border-border mb-4">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Lead Volume</h3>
                  <p className="text-xs text-muted mt-0.5">New prospects per month</p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-[#3b82f6] inline-block" />
                  <span className="text-muted">Leads</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex gap-2" style={{ height: "128px" }}>
                  {chartData.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center group relative">
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-[10px] whitespace-nowrap z-10 shadow-lg pointer-events-none">
                        <p className="font-semibold text-white mb-0.5">{fmtMonth(m.month)}</p>
                        <p className="text-[#3b82f6]">{m.newLeads} new leads</p>
                      </div>
                      <span className="text-[10px] font-medium text-muted flex-shrink-0">{m.newLeads}</span>
                      <div className="flex-1 w-full flex items-end">
                        <div
                          className="bg-[#3b82f6] rounded-t w-full transition-all group-hover:bg-[#60a5fa]"
                          style={{ height: `${(m.newLeads / maxLeads) * 100}%`, minHeight: m.newLeads > 0 ? "4px" : "0" }}
                        />
                      </div>
                      <span className="text-[9px] text-muted mt-1 flex-shrink-0">{fmtMonthShort(m.month)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Enrollments vs Churn — shared scale, with name tooltips */}
            {(() => {
              // Reconstruct active student count per month by working backwards from current
              const activeCounts: number[] = new Array(chartData.length);
              let running = stats.activeMembers;
              for (let i = chartData.length - 1; i >= 0; i--) {
                activeCounts[i] = running;
                running = running - chartData[i].newStudents + chartData[i].churns;
              }
              const activeMin = Math.min(...activeCounts);
              const activeMax = Math.max(...activeCounts);
              const activeRange = activeMax - activeMin || 1;
              const barAreaH = 140;
              // Line occupies full chart height, scaled to active count range with some padding
              const linePadTop = 8;
              const linePadBot = 20;
              const lineH = barAreaH + 16 - linePadTop - linePadBot;

              return (
                <div className="bg-card rounded-xl border border-border mb-4">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Enrollments vs Churn</h3>
                      <p className="text-xs text-muted mt-0.5">New sign-ups vs members lost — hover for names</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px]">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#10b981] inline-block" /> Enrolled</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" /> Churned</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-white/80 inline-block rounded" /> Active</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="relative">
                      {/* Bars layer */}
                      <div className="flex gap-2">
                        {chartData.map((m, i) => {
                          const enrolled = studentNamesByMonth[m.month] || [];
                          const churned = churnNamesByMonth[m.month] || [];
                          const enrollPx = Math.round((m.newStudents / maxEnrollChurn) * barAreaH);
                          const churnPx = Math.round((m.churns / maxEnrollChurn) * barAreaH);
                          return (
                            <div key={m.month} className="flex-1 flex flex-col items-center group relative">
                              {/* Rich tooltip with names */}
                              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2.5 text-[10px] z-20 shadow-lg pointer-events-none min-w-[160px] max-w-[220px]">
                                <p className="font-semibold text-white mb-1.5">{fmtMonth(m.month)}</p>
                                <p className="text-white/90 font-medium mb-1">{activeCounts[i]} active members</p>
                                <div className="mb-1.5">
                                  <p className="text-[#10b981] font-medium">{m.newStudents} enrolled</p>
                                  {enrolled.length > 0 && (
                                    <div className="ml-2 mt-0.5 space-y-px">
                                      {enrolled.slice(0, 10).map((name, j) => (
                                        <p key={j} className="text-[#d1fae5] leading-snug">{name}</p>
                                      ))}
                                      {enrolled.length > 10 && <p className="text-muted">+{enrolled.length - 10} more</p>}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[#ef4444] font-medium">{m.churns} churned</p>
                                  {churned.length > 0 && (
                                    <div className="ml-2 mt-0.5 space-y-px">
                                      {churned.slice(0, 10).map((name, j) => (
                                        <p key={j} className="text-[#fecaca] leading-snug">{name}</p>
                                      ))}
                                      {churned.length > 10 && <p className="text-muted">+{churned.length - 10} more</p>}
                                    </div>
                                  )}
                                </div>
                                <div className={`mt-1.5 pt-1.5 border-t border-[#334155] font-medium ${m.netGrowth >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                                  Net: {m.netGrowth >= 0 ? "+" : ""}{m.netGrowth}
                                </div>
                              </div>
                              {/* Numbers + bars */}
                              <div className="w-full flex gap-0.5">
                                <div className="flex-1 flex flex-col items-center justify-end" style={{ height: `${barAreaH + 16}px` }}>
                                  <span className="text-[9px] font-medium text-[#10b981] mb-0.5">{m.newStudents}</span>
                                  <div
                                    className="w-full bg-[#10b981] rounded-t transition-all group-hover:bg-[#34d399]"
                                    style={{ height: `${enrollPx}px`, minHeight: m.newStudents > 0 ? "4px" : "0" }}
                                  />
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-end" style={{ height: `${barAreaH + 16}px` }}>
                                  <span className="text-[9px] font-medium text-[#ef4444] mb-0.5">{m.churns}</span>
                                  <div
                                    className="w-full bg-[#ef4444] rounded-t transition-all group-hover:bg-[#f87171]"
                                    style={{ height: `${churnPx}px`, minHeight: m.churns > 0 ? "4px" : "0" }}
                                  />
                                </div>
                              </div>
                              <span className="text-[9px] text-muted mt-1">{fmtMonthShort(m.month)}</span>
                              <span className={`text-[9px] font-semibold ${m.netGrowth > 0 ? "text-[#10b981]" : m.netGrowth < 0 ? "text-[#ef4444]" : "text-muted"}`}>
                                {m.netGrowth > 0 ? "+" : ""}{m.netGrowth}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Active member line overlay */}
                      {(() => {
                        const svgW = 1000;
                        const svgH = barAreaH + 16;
                        const points = activeCounts.map((count, i) => {
                          const x = ((i + 0.5) / chartData.length) * svgW;
                          const y = linePadTop + lineH - ((count - activeMin) / activeRange) * lineH;
                          return { x, y, count };
                        });
                        const linePoints = points.map(p => `${p.x},${p.y}`).join(" ");
                        const shadowPoints = points.map(p => `${p.x},${p.y + 1}`).join(" ");
                        return (
                          <svg
                            className="absolute inset-0 pointer-events-none z-10"
                            viewBox={`0 0 ${svgW} ${svgH}`}
                            preserveAspectRatio="none"
                            style={{ width: "100%", height: `${svgH}px` }}
                          >
                            <polyline
                              fill="none"
                              stroke="rgba(0,0,0,0.4)"
                              strokeWidth="4"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              points={shadowPoints}
                              vectorEffect="non-scaling-stroke"
                            />
                            <polyline
                              fill="none"
                              stroke="rgba(255,255,255,0.85)"
                              strokeWidth="2"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              points={linePoints}
                              vectorEffect="non-scaling-stroke"
                            />
                            {points.map((p, i) => (
                              <g key={i}>
                                <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#1a1a2e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                <text
                                  x={p.x}
                                  y={p.y - 8}
                                  textAnchor="middle"
                                  fontWeight="bold"
                                  style={{ fontSize: "9px", fill: "rgba(255,255,255,0.75)" }}
                                  vectorEffect="non-scaling-stroke"
                                >
                                  {p.count}
                                </text>
                              </g>
                            ))}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Conversion Rate Trend */}
            <div className="bg-card rounded-xl border border-border">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold">Conversion Rate Trend</h3>
                <p className="text-xs text-muted mt-0.5">New students / new leads per month. Industry benchmark: 3-5%</p>
              </div>
              <div className="p-5">
                {(() => {
                  const maxRate = Math.max(...chartData.map(d => d.conversionRate), 10);
                  // The bar area is the middle flex section (between the % label on top and month label on bottom).
                  // % label height ~16px, month label ~16px, so bar area = 128 - 32 = 96px.
                  // Benchmark line position from bottom of the full 128px container:
                  // bottom offset = month label height (16px) + (3/maxRate) * bar area height (96px)
                  const barAreaH = 96;
                  const benchmarkBottom = 16 + (3 / maxRate) * barAreaH;
                  return (
                    <div className="relative" style={{ height: "128px" }}>
                      {/* 3% benchmark line */}
                      <div className="absolute left-0 right-0 flex items-center gap-2 pointer-events-none z-10" style={{ bottom: `${benchmarkBottom}px` }}>
                        <div className="flex-1 border-t-2 border-dashed border-white/80" />
                        <span className="text-[10px] font-bold text-white whitespace-nowrap bg-white/20 backdrop-blur-sm border border-white/40 rounded-full px-2 py-0.5">3%</span>
                        <div className="flex-1 border-t-2 border-dashed border-white/80" />
                      </div>
                      <div className="flex gap-2 h-full">
                        {chartData.map((m) => {
                          const barH = maxRate > 0 ? (m.conversionRate / maxRate) * 100 : 0;
                          const isGood = m.conversionRate >= 3;
                          const enrolled = studentNamesByMonth[m.month] || [];
                          return (
                            <div key={m.month} className="flex-1 flex flex-col items-center group relative">
                              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-[10px] z-10 shadow-lg pointer-events-none min-w-[140px]">
                                <p className="font-semibold text-white">{fmtMonth(m.month)}: {m.conversionRate}%</p>
                                <p className="text-muted">{m.newStudents} signed / {m.newLeads} leads</p>
                                {enrolled.length > 0 && (
                                  <div className="mt-1 pt-1 border-t border-[#334155]">
                                    {enrolled.slice(0, 6).map((name, i) => (
                                      <p key={i} className="text-[#d1fae5] leading-snug">{name}</p>
                                    ))}
                                    {enrolled.length > 6 && <p className="text-muted">+{enrolled.length - 6} more</p>}
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-muted flex-shrink-0">{m.conversionRate > 0 ? `${m.conversionRate}%` : ""}</span>
                              <div className="flex-1 w-full flex items-end">
                                <div
                                  className={`w-full rounded-t transition-all ${isGood ? "bg-[#10b981] group-hover:bg-[#34d399]" : "bg-[#f59e0b] group-hover:bg-[#fbbf24]"}`}
                                  style={{ height: `${barH}%`, minHeight: m.conversionRate > 0 ? "4px" : "0" }}
                                />
                              </div>
                              <span className="text-[9px] text-muted mt-1 flex-shrink-0">{fmtMonthShort(m.month)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* $ TARGETS */}
      {activeSection === "targets" && (() => {
              const rm = revenueModel;
              const [tuition, setTuition] = [avgTuition, setAvgTuition];
              const [goalMembers, setGoalMembers] = [memberGoal, setMemberGoal];

              const ltv = tuition * rm.avgLifetimeMonths;
              const revenuePerLead = (rm.conversionRate6mo / 100) * ltv;
              const currentMRR = rm.currentActive * tuition;

              // Steady-state: to maintain N members at X% churn, need N * churnRate new/month
              const churnRateDecimal = rm.monthlyChurnRate / 100;
              const maintainCurrent = rm.currentActive * churnRateDecimal;
              const maintainLeads = rm.conversionRate6mo > 0 ? maintainCurrent / (rm.conversionRate6mo / 100) : 0;

              // Goal analysis
              const gap = goalMembers - rm.currentActive;
              const goalMRR = goalMembers * tuition;
              const maintainGoal = goalMembers * churnRateDecimal;
              const maintainGoalLeads = rm.conversionRate6mo > 0 ? maintainGoal / (rm.conversionRate6mo / 100) : 0;

              // Time to reach goal at current pace
              const netPerMonth = rm.currentStudentsPerMonth - rm.currentChurnsPerMonth;
              const monthsToGoal = gap > 0 && netPerMonth > 0 ? Math.ceil(gap / netPerMonth) : gap <= 0 ? 0 : Infinity;

              // Extra leads needed beyond current pace
              const extraStudentsNeeded = gap > 0 ? maintainGoal - rm.currentStudentsPerMonth : 0;
              const extraLeadsNeeded = rm.conversionRate6mo > 0 ? Math.max(0, extraStudentsNeeded) / (rm.conversionRate6mo / 100) : 0;

              return (
                <div className="bg-card rounded-xl border border-border mt-6">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-sm font-semibold">Revenue Model — The Leaky Bucket</h3>
                    <p className="text-xs text-muted mt-0.5">Your gym is a bucket with holes. Members flow in through leads, and leak out through churn. Here&apos;s the math.</p>
                  </div>
                  <div className="p-5 space-y-6">
                    {/* Unit Economics */}
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-3">Your Unit Economics</p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-background rounded-lg p-3 border border-border/50">
                          <p className="text-[10px] text-muted">Avg Member Lifetime</p>
                          <p className="text-lg font-bold">{rm.avgLifetimeMonths} <span className="text-xs text-muted font-normal">months</span></p>
                        </div>
                        <div className="bg-background rounded-lg p-3 border border-border/50">
                          <p className="text-[10px] text-muted">Monthly Churn Rate</p>
                          <p className="text-lg font-bold text-danger">{rm.monthlyChurnRate}%</p>
                          <p className="text-[10px] text-muted">~{Math.round(rm.currentActive * churnRateDecimal)} leave/mo</p>
                        </div>
                        <div className="bg-background rounded-lg p-3 border border-border/50">
                          <p className="text-[10px] text-muted">Lifetime Value (LTV)</p>
                          <p className="text-lg font-bold text-success">${ltv.toLocaleString()}</p>
                          <p className="text-[10px] text-muted">{rm.avgLifetimeMonths}mo × ${tuition}</p>
                        </div>
                        <div className="bg-background rounded-lg p-3 border border-border/50">
                          <p className="text-[10px] text-muted">Revenue per Lead</p>
                          <p className="text-lg font-bold text-accent">${Math.round(revenuePerLead)}</p>
                          <p className="text-[10px] text-muted">{rm.conversionRate6mo}% conv × ${ltv.toLocaleString()} LTV</p>
                        </div>
                      </div>
                    </div>

                    {/* Current State */}
                    <div className="bg-background rounded-lg p-4 border border-border/50">
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">Current State</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm"><span className="font-bold">{rm.currentActive}</span> active members</span>
                        <span className="text-muted">×</span>
                        <span className="text-sm">$<input
                          type="number"
                          value={tuition}
                          onChange={(e) => setTuition(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-14 bg-card border border-border rounded px-1.5 py-0.5 text-sm font-bold text-center inline-block"
                        />/mo avg</span>
                        <span className="text-muted">=</span>
                        <span className="text-sm font-bold text-success">${currentMRR.toLocaleString()}/mo MRR</span>
                      </div>
                      <p className="text-xs text-muted mt-2">
                        To just <span className="font-medium text-foreground">stay flat</span> at {rm.currentActive} members, you need <span className="font-medium text-foreground">{maintainCurrent.toFixed(0)} new students/mo</span> ({maintainLeads.toFixed(0)} leads).
                        You&apos;re getting {rm.currentStudentsPerMonth}/mo — {rm.currentStudentsPerMonth >= maintainCurrent
                          ? <span className="text-success font-medium">you&apos;re above replacement</span>
                          : <span className="text-danger font-medium">{(maintainCurrent - rm.currentStudentsPerMonth).toFixed(1)} short of replacement</span>
                        }.
                      </p>
                    </div>

                    {/* Goal Planner */}
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-3">Goal Planner</p>
                      <div className="bg-background rounded-lg p-4 border border-border/50">
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          <span className="text-sm">I want to reach</span>
                          <input
                            type="number"
                            value={goalMembers}
                            onChange={(e) => setGoalMembers(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 bg-card border border-border rounded px-1.5 py-0.5 text-sm font-bold text-center"
                          />
                          <span className="text-sm">active members</span>
                          <span className="text-muted">=</span>
                          <span className="text-sm font-bold text-success">${goalMRR.toLocaleString()}/mo</span>
                        </div>

                        {gap <= 0 ? (
                          <div className="bg-success/10 border border-success/30 rounded-lg p-3">
                            <p className="text-sm font-medium text-success">You&apos;re already there! Focus on retention to stay above {goalMembers}.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                              <div className="bg-card rounded-lg p-3 border border-accent/30">
                                <p className="text-[10px] text-muted">Gap to Fill</p>
                                <p className="text-lg font-bold text-accent">+{gap} members</p>
                                <p className="text-[10px] text-muted">+${(gap * tuition).toLocaleString()}/mo revenue</p>
                              </div>
                              <div className="bg-card rounded-lg p-3 border border-border">
                                <p className="text-[10px] text-muted">To Maintain {goalMembers}</p>
                                <p className="text-lg font-bold">{maintainGoal.toFixed(0)} <span className="text-xs font-normal text-muted">students/mo</span></p>
                                <p className="text-[10px] text-muted">{maintainGoalLeads.toFixed(0)} leads/mo at {rm.conversionRate6mo}% conv</p>
                              </div>
                              <div className="bg-card rounded-lg p-3 border border-border">
                                <p className="text-[10px] text-muted">At Current Pace</p>
                                {netPerMonth > 0 ? (
                                  <>
                                    <p className="text-lg font-bold">{monthsToGoal} <span className="text-xs font-normal text-muted">months</span></p>
                                    <p className="text-[10px] text-muted">net +{netPerMonth.toFixed(1)}/mo right now</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-lg font-bold text-danger">Shrinking</p>
                                    <p className="text-[10px] text-muted">net {netPerMonth.toFixed(1)}/mo — need more leads</p>
                                  </>
                                )}
                              </div>
                            </div>

                            {extraLeadsNeeded > 0 && (
                              <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                                <p className="text-xs leading-relaxed">
                                  <span className="font-semibold">The math:</span> At {goalMembers} members with {rm.monthlyChurnRate}% monthly churn,
                                  you&apos;d lose ~{maintainGoal.toFixed(0)} members/month. To replace them you need {maintainGoalLeads.toFixed(0)} leads/month
                                  (at {rm.conversionRate6mo}% conversion). You&apos;re currently at {rm.currentLeadsPerMonth} leads/mo —
                                  {maintainGoalLeads > rm.currentLeadsPerMonth
                                    ? <span className="font-semibold text-accent"> need {Math.ceil(maintainGoalLeads - rm.currentLeadsPerMonth)} more leads/mo to sustain that level.</span>
                                    : <span className="font-semibold text-success"> your current lead flow can sustain this.</span>
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Key Levers */}
                    <div className="bg-background rounded-lg p-4 border border-border/50">
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">Biggest Levers</p>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="text-success font-bold mt-px">1.</span>
                          <p><span className="font-semibold">Reduce churn by 1%</span> <span className="text-muted">({rm.monthlyChurnRate}% → {(rm.monthlyChurnRate - 1).toFixed(1)}%) = save ~{Math.round(rm.currentActive * 0.01)} members/mo = <span className="text-success font-medium">+${Math.round(rm.currentActive * 0.01 * tuition * rm.avgLifetimeMonths).toLocaleString()} LTV</span></span></p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-accent font-bold mt-px">2.</span>
                          <p><span className="font-semibold">Improve conversion by 2%</span> <span className="text-muted">({rm.conversionRate6mo}% → {(rm.conversionRate6mo + 2).toFixed(1)}%) at {rm.currentLeadsPerMonth} leads/mo = <span className="text-accent font-medium">+{((rm.currentLeadsPerMonth * 0.02)).toFixed(1)} students/mo</span></span></p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-bold mt-px">3.</span>
                          <p><span className="font-semibold">Add 20 more leads/mo</span> <span className="text-muted">at {rm.conversionRate6mo}% conversion = +{(20 * rm.conversionRate6mo / 100).toFixed(1)} students/mo = <span className="font-medium">+${Math.round(20 * rm.conversionRate6mo / 100 * tuition).toLocaleString()}/mo</span></span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
      })()}

      {/* INSIGHTS */}
      {activeSection === "insights" && sortedInsights.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">What Needs Your Attention</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Win-Back Action Center */}
      {activeSection === "winback" && (
        winbackLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-muted animate-pulse text-sm">Loading win-back candidates...</div>
          </div>
        ) : winbackData ? (
          <ActionCenter
            candidates={winbackData.candidates}
            activeSuggestions={winbackData.activeSuggestions}
            costTrends={winbackData.costTrends || {}}
            onRefresh={fetchWinback}
          />
        ) : (
          <div className="bg-card rounded-xl border border-dashed border-border p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center text-muted mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </div>
            <p className="text-sm font-semibold mb-1">Set Up Win-Back</p>
            <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
              Win-back candidates are identified by engagement scoring. First, sync your data from Zivvy (Dashboard &gt; Sync button),
              then run engagement scoring from the Contacts API. Once scored, at-risk and ghost members will appear here with
              AI-generated outreach messages.
            </p>
            <Link href="/getting-started" className="inline-block mt-4 text-xs text-accent hover:underline">
              Learn more in Getting Started
            </Link>
          </div>
        )
      )}

      {/* Business Snapshot */}
      {activeSection === "snapshot" && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Business Snapshot</h2>

          {/* Student Reach Map — full width */}
          <div className="bg-card rounded-xl border border-border mb-6">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold">Student Reach — Pinellas County</h3>
              <p className="text-xs text-muted mt-0.5">Active students by zip code. Hover for details.</p>
            </div>
            <div className="p-4 max-w-md mx-auto">
              <ZipBubbleMap data={zipDistribution} />
            </div>
          </div>

          {/* Age Groups + Lead Sources side by side */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold">Students by Age Group</h3>
              </div>
              <div className="p-4">
                <BarChart
                  data={ageGroups.filter(a => a.age_group && a.age_group !== "").map((a) => ({ label: a.age_group, value: a.count }))}
                  colorFn={(label) => ageGroupColors[label] || "#6b7280"}
                />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold">Where Students Come From</h3>
              </div>
              <div className="p-4">
                <BarChart
                  data={leadSources.slice(0, 6).map((s) => ({ label: s.source, value: s.count }))}
                  colorFn={() => "#10b981"}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enrollment Trend */}
      {activeSection === "trends" && enrollmentTrend.length > 0 && (
        <div className="bg-card rounded-xl border border-border mb-8">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">New Student Enrollments — Last 12 Months</h3>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-1 h-28">
              {enrollmentTrend.map((e) => (
                <div key={e.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-muted">{e.count}</span>
                  <div
                    className="w-full rounded-t bg-accent/80 transition-all"
                    style={{ height: `${(e.count / enrollMax) * 100}%`, minHeight: e.count > 0 ? "4px" : "0" }}
                  />
                  <span className="text-[10px] text-muted">{formatMonth(e.month)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Prospect Pipeline */}
      {activeSection === "pipeline" && (
        <div className="bg-card rounded-xl border border-border mb-8">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Prospect Pipeline</h3>
            <p className="text-xs text-muted mt-0.5">{stats.totalLeads.toLocaleString()} total prospects</p>
          </div>
          <div className="p-4">
            <BarChart
              data={prospectPipeline.filter((p) => p.stage !== "N/A" && p.stage !== "Unknown").slice(0, 8).map((p) => ({ label: p.stage, value: p.count }))}
              colorFn={() => "#f59e0b"}
            />
          </div>
        </div>
      )}

      {/* Data Gaps */}
      {activeSection === "gaps" && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Data Gaps — Unlock with CSV Import</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <DataGapCard title="Belt Ranks" description="Import Contact Program Overview CSV for rank distribution and promotion tracking." />
            <DataGapCard title="At-Risk Detection" description="Need attendance dates to flag students who are slipping before they quit." />
            <DataGapCard title="Revenue Dashboard" description="Tuition amounts in CSV will power revenue tracking and churn cost analysis." />
            <DataGapCard title="Class Attendance" description="Per-class check-in records from Zivvy Attendance reports for trend analysis." />
          </div>
        </div>
      )}

      <DashboardChat />
    </div>
  );
}
