"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import InfoTip from "@/components/InfoTip";

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  belt_rank: string;
  stripes: number;
  membership_type: string;
  membership_status: string;
  monthly_rate: number;
  start_date: string;
  last_attendance: string;
  classes_last_30_days: number;
  total_classes: number;
  notes: string;
  engagement_score: number | null;
  risk_level: string | null;
  risk_factors: string | null;
  score_attendance: number | null;
  cost_per_class: number | null;
  ltv: number;
  household_names: string | null;
  household_size: number;
}

type SortKey =
  | "name"
  | "belt"
  | "status"
  | "last_30d"
  | "total"
  | "last_seen"
  | "rate"
  | "engagement"
  | "risk"
  | "cost_per_class";

type SortDir = "asc" | "desc";

type FilterType = "all" | "active" | "inactive" | "trial" | "at_risk" | "ghost";

const beltColors: Record<string, string> = {
  white: "bg-white text-black",
  blue: "bg-blue-600 text-white",
  purple: "bg-purple-700 text-white",
  brown: "bg-amber-800 text-white",
  black: "bg-black text-white border border-zinc-600",
};

const beltOrder: Record<string, number> = {
  white: 0,
  blue: 1,
  purple: 2,
  brown: 3,
  black: 4,
};

const riskOrder: Record<string, number> = {
  churned: 0,
  ghost: 1,
  at_risk: 2,
  cooling: 3,
  healthy: 4,
};

function BeltBadge({ rank, stripes }: { rank: string; stripes: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${beltColors[rank] || "bg-zinc-700 text-white"}`}
    >
      {rank.charAt(0).toUpperCase() + rank.slice(1)}
      {stripes > 0 && <span className="opacity-70">{"I".repeat(stripes)}</span>}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active" ? "bg-success" : status === "trial" ? "bg-warning" : "bg-danger";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function EngagementBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-zinc-700 text-zinc-400 text-xs font-bold">
        --
      </span>
    );
  }
  const bg =
    score >= 70 ? "bg-green-600" : score >= 40 ? "bg-yellow-500 text-black" : "bg-red-600";
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${bg} text-white`}
      style={score >= 40 && score < 70 ? { color: "#000" } : undefined}
    >
      {score}
    </span>
  );
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) {
    return <span className="text-xs text-muted">--</span>;
  }
  const styles: Record<string, string> = {
    healthy: "bg-green-600/20 text-green-400 border-green-600/30",
    cooling: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    at_risk: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    ghost: "bg-red-600/20 text-red-400 border-red-600/30",
    churned: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
  };
  const label: Record<string, string> = {
    healthy: "Healthy",
    cooling: "Cooling",
    at_risk: "At Risk",
    ghost: "Ghost",
    churned: "Churned",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles[level] || "bg-zinc-700 text-zinc-300 border-zinc-600"}`}
    >
      {label[level] || level}
    </span>
  );
}

function CostPerClass({ cost }: { cost: number | null }) {
  if (cost === null || cost === undefined) {
    return <span className="text-xs text-muted">--</span>;
  }
  const color = cost > 25 ? "text-red-400" : "text-green-400";
  return <span className={`text-sm font-medium ${color}`}>${cost.toFixed(0)}</span>;
}

function HouseholdBadge({ size }: { size: number }) {
  if (!size || size <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-700/60 text-xs text-zinc-300">
      <svg
        className="w-3.5 h-3.5 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
      {size}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="w-3 h-3 ml-1 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
      </svg>
    );
  }
  return dir === "asc" ? (
    <svg className="w-3 h-3 ml-1 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-3 h-3 ml-1 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function comparator(a: Student, b: Student, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "name": {
      cmp = a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
      break;
    }
    case "belt": {
      cmp = (beltOrder[a.belt_rank] ?? -1) - (beltOrder[b.belt_rank] ?? -1);
      if (cmp === 0) cmp = a.stripes - b.stripes;
      break;
    }
    case "status": {
      cmp = a.membership_status.localeCompare(b.membership_status);
      break;
    }
    case "last_30d": {
      cmp = a.classes_last_30_days - b.classes_last_30_days;
      break;
    }
    case "total": {
      cmp = a.total_classes - b.total_classes;
      break;
    }
    case "last_seen": {
      const da = a.last_attendance || "";
      const db = b.last_attendance || "";
      cmp = da.localeCompare(db);
      break;
    }
    case "rate": {
      cmp = a.monthly_rate - b.monthly_rate;
      break;
    }
    case "engagement": {
      const ea = a.engagement_score ?? -1;
      const eb = b.engagement_score ?? -1;
      cmp = ea - eb;
      break;
    }
    case "risk": {
      const ra = riskOrder[a.risk_level ?? ""] ?? -1;
      const rb = riskOrder[b.risk_level ?? ""] ?? -1;
      cmp = ra - rb;
      break;
    }
    case "cost_per_class": {
      const ca = a.cost_per_class ?? 9999;
      const cb = b.cost_per_class ?? 9999;
      cmp = ca - cb;
      break;
    }
  }
  return dir === "asc" ? cmp : -cmp;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    fetch("/api/students")
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then(setStudents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const filtered = useMemo(() => {
    let list = students;
    switch (filter) {
      case "active":
        list = list.filter((s) => s.membership_status === "active");
        break;
      case "inactive":
        list = list.filter((s) => s.membership_status === "inactive");
        break;
      case "trial":
        list = list.filter((s) => s.membership_type === "trial");
        break;
      case "at_risk":
        list = list.filter((s) => s.risk_level === "at_risk" || s.risk_level === "cooling");
        break;
      case "ghost":
        list = list.filter((s) => s.risk_level === "ghost");
        break;
    }
    return [...list].sort((a, b) => {
      const primary = comparator(a, b, sortKey, sortDir);
      if (primary !== 0) return primary;
      // Secondary sort: last_name ASC
      return a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
    });
  }, [students, filter, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted animate-pulse">Loading students...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-danger font-medium">Failed to load students</p>
          <p className="text-sm text-muted mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-accent hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "trial", label: "Trial" },
    { key: "at_risk", label: "At Risk" },
    { key: "ghost", label: "Ghost" },
  ];

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: "name", label: "Student" },
    { key: "belt", label: "Belt" },
    { key: "status", label: "Status" },
    { key: "engagement", label: "Engage" },
    { key: "risk", label: "Risk" },
    { key: "last_30d", label: "30d", align: "text-center" },
    { key: "total", label: "Total", align: "text-center" },
    { key: "last_seen", label: "Last Seen" },
    { key: "rate", label: "Rate", align: "text-right" },
    { key: "cost_per_class", label: "$/Class", align: "text-right" },
  ];

  return (
    <div className="max-w-[1400px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-muted mt-1">
            {students.length} total members
            {filter !== "all" && ` \u00b7 ${filtered.length} shown`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key
                  ? f.key === "at_risk"
                    ? "bg-orange-500/15 text-orange-400"
                    : f.key === "ghost"
                      ? "bg-red-600/15 text-red-400"
                      : "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="border-b border-border text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium cursor-pointer select-none hover:text-foreground transition-colors ${col.align || ""}`}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {col.key === "engagement" && <InfoTip text="0-100 score based on attendance (40%), communication (20%), progression (20%), community (10%), financial (10%). Higher = more engaged." />}
                    {col.key === "risk" && <InfoTip text="Healthy (80+), Cooling (60-79), At Risk (40-59), Ghost (20-39). Based on engagement score." />}
                    {col.key === "cost_per_class" && <InfoTip text="Total payments / total classes attended. Over $25 means they're paying but not training enough — a churn signal." />}
                    {col.key === "last_30d" && <InfoTip text="Classes attended in the last 30 days. 0 is a red flag. 8+ is solid (about 2x/week)." />}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                HH
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-5 py-12 text-center text-muted">
                  No students match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-card-hover transition-colors">
                  {/* Name */}
                  <td className="px-4 py-3">
                    <Link href={`/students/${s.id}`} className="hover:text-accent transition-colors">
                      <p className="text-sm font-medium whitespace-nowrap">
                        {s.first_name} {s.last_name}
                      </p>
                    </Link>
                  </td>

                  {/* Belt */}
                  <td className="px-4 py-3">
                    <BeltBadge rank={s.belt_rank} stripes={s.stripes} />
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusDot status={s.membership_status} />
                      <span className="text-xs capitalize whitespace-nowrap">
                        {s.membership_type === "trial" ? "Trial" : s.membership_status}
                      </span>
                    </div>
                  </td>

                  {/* Engagement Score */}
                  <td className="px-4 py-3">
                    <EngagementBadge score={s.engagement_score} />
                  </td>

                  {/* Risk Level */}
                  <td className="px-4 py-3">
                    <RiskBadge level={s.risk_level} />
                  </td>

                  {/* Last 30d */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-sm font-medium ${
                        s.classes_last_30_days === 0
                          ? "text-danger"
                          : s.classes_last_30_days >= 8
                            ? "text-success"
                            : "text-foreground"
                      }`}
                    >
                      {s.classes_last_30_days}
                    </span>
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-center text-sm">{s.total_classes}</td>

                  {/* Last Seen */}
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                    {s.last_attendance
                      ? new Date(s.last_attendance + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "Never"}
                  </td>

                  {/* Rate */}
                  <td className="px-4 py-3 text-right text-sm">
                    {s.monthly_rate > 0 ? (
                      `$${s.monthly_rate}`
                    ) : (
                      <span className="text-xs text-muted">
                        {s.membership_type === "step_up" ? "Step-Up" : "Free"}
                      </span>
                    )}
                  </td>

                  {/* Cost/Class */}
                  <td className="px-4 py-3 text-right">
                    <CostPerClass cost={s.cost_per_class} />
                  </td>

                  {/* Household */}
                  <td className="px-4 py-3">
                    <HouseholdBadge size={s.household_size} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
