"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BriefingData {
  stats: {
    activeMembers: number;
    formerMembers: number;
    totalLeads: number;
    openLeads: number;
    monthlyRevenue: number;
    lessonPlansThisMonth: number;
    newThisMonth: number;
  };
  attention: {
    atRiskCount: number;
    ghostCount: number;
    coolingCount: number;
    healthyCount: number;
    revenueAtRisk: number;
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
    avgScore: number;
  };
  todayClasses: Array<{
    id: number;
    date: string;
    start_time: string;
    class_type: string;
    instructor: string;
    lesson_title: string | null;
    attendance_count: number;
  }>;
  newLeads: Array<{
    id: number;
    first_name: string;
    last_name: string;
    source: string;
    interest: string;
    created_at: string;
    phone: string;
  }>;
  pendingContent: Array<{
    id: number;
    content_type: string;
    body: string;
    created_at: string;
  }>;
  pendingWinback: Array<{
    id: number;
    body: string;
    message_type: string;
    tone: string;
    created_at: string;
    first_name: string;
    last_name: string;
    phone: string;
  }>;
  unreadConversations: Array<{
    contact_id: string;
    contact_name: string;
    unread_count: number;
    last_message_at: string;
    last_message_preview: string;
  }>;
  pendingAccessRequests: Array<{
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    message: string | null;
    created_at: string;
  }>;
}

const riskColors: Record<string, string> = {
  ghost: "bg-red-500/15 text-red-400 border-red-500/30",
  at_risk: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cooling: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

export default function DailyBriefingPage() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/daily-briefing")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted animate-pulse">Loading your daily briefing...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-danger">Failed to load briefing</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const totalActions =
    data.attention.topAtRisk.length +
    data.newLeads.length +
    data.pendingWinback.length +
    data.unreadConversations.length +
    data.pendingContent.length +
    (data.pendingAccessRequests?.length || 0);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-muted">{today}</p>
        <h1 className="text-3xl font-bold mt-1">Daily Briefing</h1>
        <p className="text-muted mt-2">
          {totalActions > 0
            ? `${totalActions} items need your attention today`
            : "All clear — no urgent actions needed"}
        </p>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <QuickStat label="Active Members" value={data.stats.activeMembers} />
        <QuickStat
          label="Revenue"
          value={`$${(data.stats.monthlyRevenue / 1000).toFixed(1)}k`}
        />
        <QuickStat
          label="At Risk"
          value={data.attention.atRiskCount + data.attention.ghostCount}
          alert={data.attention.atRiskCount + data.attention.ghostCount > 0}
        />
        <QuickStat label="New Leads" value={data.newLeads.length} accent />
      </div>

      {/* Revenue at Risk Alert */}
      {data.attention.revenueAtRisk > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-400">
              ${data.attention.revenueAtRisk.toLocaleString()}/mo at risk
            </p>
            <p className="text-xs text-muted mt-0.5">
              {data.attention.ghostCount} ghost members + {data.attention.atRiskCount} at-risk
            </p>
          </div>
          <Link
            href="/?tab=winback"
            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
          >
            View Win-Back
          </Link>
        </div>
      )}

      {/* Access Requests Alert */}
      {data.pendingAccessRequests && data.pendingAccessRequests.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-lg">&#128275;</span>
              <p className="text-sm font-semibold text-amber-400">
                {data.pendingAccessRequests.length} Access Request{data.pendingAccessRequests.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href="/access-requests"
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
            >
              Review
            </Link>
          </div>
          <div className="space-y-2">
            {data.pendingAccessRequests.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted ml-2">
                    {r.email || r.phone}
                  </span>
                </div>
                <span className="text-[10px] text-muted">
                  {new Date(r.created_at + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            These people tried to log in but their email/phone didn&apos;t match a contact on file.
          </p>
        </div>
      )}

      {/* Action Sections */}
      <div className="space-y-6">
        {/* Members Needing Attention */}
        {data.attention.topAtRisk.length > 0 && (
          <BriefingSection
            title="Members Needing Attention"
            count={data.attention.topAtRisk.length}
            linkHref="/students"
            linkLabel="View All Students"
          >
            <div className="divide-y divide-border">
              {data.attention.topAtRisk.slice(0, 5).map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        m.engagement_score >= 40
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {m.engagement_score ?? "?"}
                    </div>
                    <div>
                      <Link
                        href={`/students/${m.id}`}
                        className="text-sm font-medium hover:text-accent transition-colors"
                      >
                        {m.first_name} {m.last_name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            riskColors[m.risk_level] || "bg-zinc-500/10 text-zinc-400"
                          }`}
                        >
                          {m.risk_level?.replace("_", " ")}
                        </span>
                        {m.days_absent > 0 && (
                          <span className="text-[10px] text-muted">
                            {m.days_absent}d absent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {m.monthly_revenue > 0 && (
                      <p className="text-sm font-medium">${m.monthly_revenue}/mo</p>
                    )}
                    {m.risk_factors.length > 0 && (
                      <p className="text-[10px] text-muted truncate max-w-[180px]">
                        {m.risk_factors[0]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </BriefingSection>
        )}

        {/* New Leads to Follow Up */}
        {data.newLeads.length > 0 && (
          <BriefingSection
            title="New Leads to Follow Up"
            count={data.newLeads.length}
            linkHref="/leads"
            linkLabel="View Pipeline"
          >
            <div className="divide-y divide-border">
              {data.newLeads.map((l) => (
                <div key={l.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {l.first_name} {l.last_name}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {l.source} — {l.interest?.replace("_", " ")}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    {new Date(l.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </BriefingSection>
        )}

        {/* Unread Conversations */}
        {data.unreadConversations.length > 0 && (
          <BriefingSection
            title="Unread Messages"
            count={data.unreadConversations.reduce((s, c) => s + c.unread_count, 0)}
          >
            <div className="divide-y divide-border">
              {data.unreadConversations.map((c, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{c.contact_name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                      {c.unread_count} unread
                    </span>
                  </div>
                  {c.last_message_preview && (
                    <p className="text-xs text-muted mt-1 truncate">
                      {c.last_message_preview}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </BriefingSection>
        )}

        {/* Pending Win-Back Messages */}
        {data.pendingWinback.length > 0 && (
          <BriefingSection
            title="Win-Back Messages Ready"
            count={data.pendingWinback.length}
            linkHref="/?tab=winback"
            linkLabel="Open Win-Back"
          >
            <div className="divide-y divide-border">
              {data.pendingWinback.map((w) => (
                <div key={w.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">
                      {w.first_name} {w.last_name}
                    </p>
                    <span className="text-[10px] text-muted capitalize">
                      {w.message_type} / {w.tone}
                    </span>
                  </div>
                  <p className="text-xs text-muted line-clamp-2">{w.body}</p>
                </div>
              ))}
            </div>
          </BriefingSection>
        )}

        {/* Pending Content */}
        {data.pendingContent.length > 0 && (
          <BriefingSection
            title="Content Awaiting Review"
            count={data.pendingContent.length}
            linkHref="/content"
            linkLabel="Open Content Studio"
          >
            <div className="divide-y divide-border">
              {data.pendingContent.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent capitalize">
                      {c.content_type.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-muted">
                      {new Date(c.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted line-clamp-2 mt-1">{c.body}</p>
                </div>
              ))}
            </div>
          </BriefingSection>
        )}

        {/* Today's Classes */}
        {data.todayClasses.length > 0 && (
          <BriefingSection
            title="Recent Classes"
            count={data.todayClasses.length}
            linkHref="/schedule"
            linkLabel="View Schedule"
          >
            <div className="divide-y divide-border">
              {data.todayClasses.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {c.lesson_title || c.class_type}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {c.start_time} — {c.instructor}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{c.attendance_count}</p>
                    <p className="text-[10px] text-muted">attended</p>
                  </div>
                </div>
              ))}
            </div>
          </BriefingSection>
        )}
      </div>

      {/* Quick Actions Footer */}
      <div className="mt-10 mb-8 grid grid-cols-3 gap-3">
        <Link
          href="/planner"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent/15 text-accent hover:bg-accent/25 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Plan a Lesson
        </Link>
        <Link
          href="/content"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          Create Content
        </Link>
        <Link
          href="/notes"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
          Quick Note
        </Link>
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  alert,
  accent,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        alert
          ? "bg-red-500/5 border-red-500/20"
          : accent
          ? "bg-accent/5 border-accent/20"
          : "bg-card border-border"
      }`}
    >
      <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
      <p
        className={`text-xl font-bold mt-0.5 ${
          alert ? "text-red-400" : accent ? "text-accent" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function BriefingSection({
  title,
  count,
  linkHref,
  linkLabel,
  children,
}: {
  title: string;
  count: number;
  linkHref?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-muted font-medium">
            {count}
          </span>
        </div>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="text-[11px] text-accent hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
