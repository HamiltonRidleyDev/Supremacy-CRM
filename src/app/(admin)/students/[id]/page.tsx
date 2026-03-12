"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import InfoTip from "@/components/InfoTip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TechniqueExposure {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  belt_level: string;
  times_exposed: number;
  last_exposed: string;
}

interface Technique {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  belt_level: string;
}

interface AttendanceRecord {
  date: string;
  start_time: string;
  class_type: string;
  instructor: string;
  lesson_title: string | null;
  position_area: string | null;
}

interface ContactData {
  engagement_score: number | null;
  risk_level: string | null;
  risk_factors: string | null;
  score_attendance: number | null;
  score_communication: number | null;
  score_progression: number | null;
  score_community: number | null;
  score_financial: number | null;
  monthly_revenue: number | null;
  mm_id: string | null;
  contact_type: string | null;
  zivvy_id: string | null;
  scored_at: string | null;
}

interface ProfileData {
  motivation: string | null;
  goals: string | null;
  quit_reason: string | null;
  willing_to_return: string | null;
  injuries_concerns: string | null;
  schedule_preference: string | null;
  training_frequency_target: string | null;
  prior_training: string | null;
  prior_gym: string | null;
  gi_or_nogi: string | null;
  occupation: string | null;
  instagram_handle: string | null;
  household_members: string | null;
}

interface HouseholdMember {
  id: number;
  first_name: string;
  last_name: string;
  contact_type: string | null;
  engagement_score: number | null;
  risk_level: string | null;
  monthly_revenue: number | null;
  age_group: string | null;
  relationship: string | null;
  parent_is_student: number | null;
  belt_rank: string | null;
  membership_status: string | null;
  last_attendance: string | null;
}

interface ConversationData {
  thread_id: string;
  message_count: number;
  inbound_count: number;
  outbound_count: number;
  has_replied: number;
  response_time_avg_hrs: number | null;
  last_message_at: string | null;
  first_message_at: string | null;
  unread_count: number;
  workflow_touches: number;
}

interface MessageData {
  direction: string;
  content: string;
  created_at: string;
  source: string;
  status: string;
}

interface MonthTrend {
  month: string;
  classes: number;
}

interface PaymentTrend {
  month: string;
  paid: number;
}

interface StudentData {
  student: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    belt_rank: string;
    stripes: number;
    membership_type: string;
    membership_status: string;
    monthly_rate: number;
    start_date: string;
    last_attendance: string;
    notes: string;
  };
  knowledge: {
    exposed: TechniqueExposure[];
    allTechniques: Technique[];
  };
  attendance: AttendanceRecord[];
  contact: ContactData | null;
  profile: ProfileData | null;
  household: HouseholdMember[];
  conversations: ConversationData | null;
  recentMessages: MessageData[];
  attendanceTrend: MonthTrend[];
  paymentTrend: PaymentTrend[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const beltColors: Record<string, string> = {
  white: "bg-white text-black",
  blue: "bg-blue-600 text-white",
  purple: "bg-purple-700 text-white",
  brown: "bg-amber-800 text-white",
  black: "bg-black text-white border border-zinc-600",
};

const categoryLabels: Record<string, string> = {
  guard: "Guard",
  passing: "Passing",
  takedowns: "Takedowns",
  submissions: "Submissions",
  escapes: "Escapes",
  sweeps: "Sweeps",
  back: "Back Attacks",
  top_control: "Top Control",
  turtle: "Turtle",
};

const categoryColors: Record<string, string> = {
  guard: "border-blue-500",
  passing: "border-orange-500",
  takedowns: "border-red-500",
  submissions: "border-purple-500",
  escapes: "border-green-500",
  sweeps: "border-cyan-500",
  back: "border-yellow-500",
  top_control: "border-pink-500",
  turtle: "border-teal-500",
};

const TABS = ["Overview", "Knowledge Map", "Conversations", "Attendance"] as const;
type TabName = (typeof TABS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreBarColor(val: number | null): string {
  if (val == null) return "bg-zinc-600";
  if (val >= 70) return "bg-green-500";
  if (val >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function riskBadgeClass(risk: string | null): string {
  switch (risk) {
    case "critical":
      return "bg-red-600/20 text-red-400 border-red-600/40";
    case "high":
      return "bg-orange-600/20 text-orange-400 border-orange-600/40";
    case "medium":
      return "bg-yellow-600/20 text-yellow-400 border-yellow-600/40";
    case "low":
      return "bg-green-600/20 text-green-400 border-green-600/40";
    default:
      return "bg-zinc-600/20 text-zinc-400 border-zinc-600/40";
  }
}

function engagementColor(score: number | null): string {
  if (score == null) return "#71717a";
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#eab308";
  return "#ef4444";
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "--";
  return `$${val.toFixed(2)}`;
}

function formatDate(d: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!d) return "--";
  return new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString(
    "en-US",
    opts || { month: "short", day: "numeric", year: "numeric" }
  );
}

function timeAgo(d: string | null | undefined): string {
  if (!d) return "--";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EngagementCircle({ score }: { score: number | null }) {
  const color = engagementColor(score);
  const display = score != null ? score : "?";
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 flex-shrink-0"
      style={{ borderColor: color, color }}
      title={`Engagement Score: ${display}`}
    >
      {display}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = value ?? 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBarColor(value)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right">{value ?? "--"}</span>
    </div>
  );
}

function AttendanceTrendChart({ data }: { data: MonthTrend[] }) {
  const months = [...data].reverse(); // chronological
  if (months.length === 0)
    return <p className="text-sm text-muted">No attendance trend data</p>;

  const maxClasses = Math.max(...months.map((m) => m.classes), 1);

  return (
    <div className="flex items-end gap-1.5 h-28">
      {months.map((m) => {
        const heightPct = (m.classes / maxClasses) * 100;
        const monthLabel = m.month.slice(5); // MM
        return (
          <div key={m.month} className="flex flex-col items-center flex-1 min-w-0">
            <span className="text-[10px] text-muted mb-1">{m.classes}</span>
            <div className="w-full flex justify-center">
              <div
                className="w-full max-w-[28px] rounded-t bg-accent/70 transition-all"
                style={{ height: `${Math.max(heightPct, 4)}%` }}
                title={`${m.month}: ${m.classes} classes`}
              />
            </div>
            <span className="text-[9px] text-muted mt-1 truncate w-full text-center">{monthLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function PaymentTrendBars({ data }: { data: PaymentTrend[] }) {
  const months = [...data].reverse();
  if (months.length === 0)
    return <p className="text-sm text-muted">No payment trend data</p>;

  const maxPaid = Math.max(...months.map((m) => m.paid), 1);

  return (
    <div className="flex items-end gap-1.5 h-24">
      {months.map((m) => {
        const heightPct = (m.paid / maxPaid) * 100;
        const monthLabel = m.month.slice(5);
        return (
          <div key={m.month} className="flex flex-col items-center flex-1 min-w-0">
            <span className="text-[10px] text-muted mb-1">${Math.round(m.paid)}</span>
            <div className="w-full flex justify-center">
              <div
                className="w-full max-w-[28px] rounded-t bg-green-500/60 transition-all"
                style={{ height: `${Math.max(heightPct, 4)}%` }}
                title={`${m.month}: $${m.paid.toFixed(2)}`}
              />
            </div>
            <span className="text-[9px] text-muted mt-1 truncate w-full text-center">{monthLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProfileCard({ profile }: { profile: ProfileData | null }) {
  if (!profile) {
    return (
      <div className="bg-card rounded-xl border border-dashed border-border p-5">
        <h3 className="font-semibold mb-3">Profile</h3>
        <p className="text-xs text-muted leading-relaxed">
          No profile data yet. Send a survey to collect this member's goals, motivation, schedule preferences, and more. Profile data helps the AI generate better win-back messages.
        </p>
      </div>
    );
  }

  const fields: { label: string; key: keyof ProfileData }[] = [
    { label: "Motivation", key: "motivation" },
    { label: "Goals", key: "goals" },
    { label: "Schedule", key: "schedule_preference" },
    { label: "Target Frequency", key: "training_frequency_target" },
    { label: "Gi / No-Gi", key: "gi_or_nogi" },
    { label: "Injuries / Concerns", key: "injuries_concerns" },
    { label: "Occupation", key: "occupation" },
    { label: "Prior Training", key: "prior_training" },
    { label: "Prior Gym", key: "prior_gym" },
    { label: "Instagram", key: "instagram_handle" },
    { label: "Quit Reason", key: "quit_reason" },
    { label: "Willing to Return", key: "willing_to_return" },
    { label: "Household", key: "household_members" },
  ];

  const populated = fields.filter((f) => profile[f.key]);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-semibold mb-3">Profile</h3>
      {populated.length === 0 ? (
        <p className="text-sm text-muted">No profile data</p>
      ) : (
        <div className="space-y-2.5">
          {populated.map((f) => (
            <div key={f.key}>
              <p className="text-[10px] uppercase tracking-wider text-muted">{f.label}</p>
              <p className="text-sm">{profile[f.key]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HouseholdCard({ members }: { members: HouseholdMember[] }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-semibold mb-3">Household</h3>
      {members.length === 0 ? (
        <p className="text-xs text-muted leading-relaxed">No household links detected. Family relationships are identified automatically during sync by matching shared phone numbers, email addresses, or parent names.</p>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <Link
              key={m.id}
              href={`/students/${m.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-card-hover transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.first_name} {m.last_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {m.belt_rank && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${beltColors[m.belt_rank] || "bg-zinc-600 text-white"}`}>
                      {m.belt_rank}
                    </span>
                  )}
                  {m.relationship && (
                    <span className="text-[10px] text-muted capitalize">{m.relationship}</span>
                  )}
                  {m.membership_status && (
                    <span className={`text-[10px] ${m.membership_status === "active" ? "text-green-400" : "text-zinc-500"}`}>
                      {m.membership_status}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {m.engagement_score != null && (
                  <span className="text-xs font-medium" style={{ color: engagementColor(m.engagement_score) }}>
                    {m.engagement_score}
                  </span>
                )}
                {m.risk_level && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${riskBadgeClass(m.risk_level)}`}>
                    {m.risk_level}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function StudentDetailPage() {
  const params = useParams();
  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("Overview");

  useEffect(() => {
    fetch(`/api/students/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted animate-pulse">Loading student...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-danger font-medium">Failed to load student</p>
          <p className="text-sm text-muted mt-1">{error || "Student not found"}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm text-accent hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { student, knowledge, attendance, contact, profile, household, conversations, recentMessages, attendanceTrend, paymentTrend } = data;

  // Knowledge map calculations
  const exposedIds = new Set(knowledge.exposed.map((t) => t.id));
  const missed = knowledge.allTechniques.filter((t) => !exposedIds.has(t.id));
  const categories = [...new Set(knowledge.allTechniques.map((t) => t.category))];
  const coveragePercent =
    knowledge.allTechniques.length > 0
      ? Math.round((knowledge.exposed.length / knowledge.allTechniques.length) * 100)
      : 0;

  const beltOrder = ["white", "blue", "purple", "brown", "black"];
  const studentBeltIdx = beltOrder.indexOf(student.belt_rank);
  const upsellOpportunities = missed.filter((t) => {
    const techBeltIdx = beltOrder.indexOf(t.belt_level);
    return techBeltIdx <= studentBeltIdx;
  });

  // Derived metrics
  const totalAttendance = attendanceTrend.reduce((s, m) => s + m.classes, 0);
  const totalPaid = paymentTrend.reduce((s, m) => s + m.paid, 0);
  const costPerClass = totalAttendance > 0 ? totalPaid / totalAttendance : null;
  const ltv = paymentTrend.reduce((s, m) => s + m.paid, 0);

  // Parse risk factors
  const riskFactors: string[] = contact?.risk_factors
    ? contact.risk_factors.split(",").map((f: string) => f.trim()).filter(Boolean)
    : [];

  return (
    <div className="max-w-7xl">
      <Link href="/students" className="text-sm text-muted hover:text-accent transition-colors mb-4 inline-block">
        &larr; Back to Students
      </Link>

      {/* ----------------------------------------------------------------- */}
      {/* Header Card                                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Engagement circle */}
            {contact && <EngagementCircle score={contact.engagement_score} />}

            <div>
              <h1 className="text-2xl font-bold">
                {student.first_name} {student.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm font-medium ${beltColors[student.belt_rank]}`}
                >
                  {student.belt_rank.charAt(0).toUpperCase() + student.belt_rank.slice(1)} Belt
                  {student.stripes > 0 && <span className="opacity-70 ml-1">{"I".repeat(student.stripes)}</span>}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    student.membership_status === "active" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                  }`}
                >
                  {student.membership_status}
                </span>
                {student.membership_type !== "standard" && (
                  <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent capitalize">
                    {student.membership_type}
                  </span>
                )}
                {contact?.risk_level && (
                  <span className={`text-xs px-2 py-1 rounded border ${riskBadgeClass(contact.risk_level)}`}>
                    {contact.risk_level} risk
                  </span>
                )}
              </div>

              {/* Risk factors pills */}
              {riskFactors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {riskFactors.map((factor, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30"
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-right text-sm text-muted flex-shrink-0 space-y-1">
            <p>
              Member since{" "}
              {new Date(student.start_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
            <p>{student.email}</p>
            {student.phone && <p>{student.phone}</p>}
            <div className="flex items-center gap-3 justify-end mt-2 text-xs">
              {costPerClass != null && (
                <span title="Cost per class" className="inline-flex items-center gap-1">
                  CPC: <span className="font-medium text-foreground">{formatCurrency(costPerClass)}</span>
                  <InfoTip text="Total payments / total classes. Over $25/class means they may not feel they're getting their money's worth." />
                </span>
              )}
              {ltv > 0 && (
                <span title="Lifetime value">
                  LTV: <span className="font-medium text-foreground">{formatCurrency(ltv)}</span>
                </span>
              )}
              {contact?.monthly_revenue != null && (
                <span title="Monthly revenue">
                  MRR: <span className="font-medium text-foreground">{formatCurrency(contact.monthly_revenue)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        {student.notes && <p className="text-sm text-muted mt-3 border-t border-border pt-3">{student.notes}</p>}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Tab Bar                                                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Tab Content                                                       */}
      {/* ----------------------------------------------------------------- */}

      {activeTab === "Overview" && (
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Left column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Engagement Breakdown */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold mb-4">Engagement Breakdown <InfoTip text="Five components weighted: Attendance (40%), Communication (20%), Progression (20%), Community (10%), Financial (10%). Each scored 0-100 independently." /></h3>
              {contact ? (
                <div className="space-y-3">
                  <ScoreBar label="Attendance" value={contact.score_attendance} />
                  <ScoreBar label="Communication" value={contact.score_communication} />
                  <ScoreBar label="Progression" value={contact.score_progression} />
                  <ScoreBar label="Community" value={contact.score_community} />
                  <ScoreBar label="Financial" value={contact.score_financial} />
                </div>
              ) : (
                <p className="text-sm text-muted">No engagement data available</p>
              )}
            </div>

            {/* Attendance Trend */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Attendance Trend <InfoTip text="Monthly class count over the past 12 months. A declining trend is an early warning sign." /></h3>
                <span className="text-xs text-muted">Last {attendanceTrend.length} months</span>
              </div>
              <AttendanceTrendChart data={attendanceTrend} />
            </div>

            {/* Payment Overview */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Payment Overview</h3>
                <div className="flex items-center gap-4 text-xs text-muted">
                  {contact?.monthly_revenue != null && <span>MRR: {formatCurrency(contact.monthly_revenue)}</span>}
                  {costPerClass != null && <span>CPC: {formatCurrency(costPerClass)}</span>}
                  {ltv > 0 && <span>LTV: {formatCurrency(ltv)}</span>}
                </div>
              </div>
              <PaymentTrendBars data={paymentTrend} />
            </div>
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-6">
            <ProfileCard profile={profile} />
            <HouseholdCard members={household} />
          </div>
        </div>
      )}

      {activeTab === "Knowledge Map" && (
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Knowledge Coverage */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl border border-border">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Knowledge Map <InfoTip text="Techniques this student has been exposed to through class attendance. Gaps are private lesson opportunities." wide={true} /></h2>
                  <p className="text-xs text-muted mt-1">
                    Techniques this student has been exposed to through class attendance
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-accent">{coveragePercent}%</p>
                  <p className="text-xs text-muted">
                    {knowledge.exposed.length}/{knowledge.allTechniques.length} techniques
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {categories.map((cat) => {
                  const allInCat = knowledge.allTechniques.filter((t) => t.category === cat);
                  const exposedInCat = knowledge.exposed.filter((t) => t.category === cat);
                  const catPercent = Math.round((exposedInCat.length / allInCat.length) * 100);

                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium">{categoryLabels[cat] || cat}</h3>
                        <span className="text-xs text-muted">
                          {exposedInCat.length}/{allInCat.length}
                        </span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all ${
                            catPercent === 100 ? "bg-success" : catPercent > 50 ? "bg-accent" : "bg-warning"
                          }`}
                          style={{ width: `${catPercent}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {allInCat.map((tech) => {
                          const exp = knowledge.exposed.find((e) => e.id === tech.id);
                          return (
                            <span
                              key={tech.id}
                              className={`text-xs px-2 py-0.5 rounded border ${
                                exp
                                  ? `border-l-2 ${categoryColors[cat] || "border-accent"} bg-card-hover text-foreground`
                                  : "border-border text-muted opacity-50"
                              }`}
                              title={exp ? `Seen ${exp.times_exposed}x, last ${exp.last_exposed}` : "Not yet covered"}
                            >
                              {tech.name}
                              {exp && exp.times_exposed > 1 && (
                                <span className="text-accent ml-1">{exp.times_exposed}x</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Upsell sidebar */}
          <div className="space-y-6">
            {upsellOpportunities.length > 0 && (
              <div className="bg-card rounded-xl border border-accent/30">
                <div className="p-5 border-b border-border bg-accent/5 rounded-t-xl">
                  <h2 className="font-semibold text-accent">Private Lesson Opportunities</h2>
                  <p className="text-xs text-muted mt-1">
                    Belt-appropriate techniques {student.first_name} hasn&apos;t been exposed to
                  </p>
                </div>
                <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                  {upsellOpportunities.slice(0, 20).map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-1">
                      <span className="text-sm">{t.name}</span>
                      <span className="text-xs text-muted capitalize">{categoryLabels[t.category] || t.category}</span>
                    </div>
                  ))}
                  {upsellOpportunities.length > 20 && (
                    <p className="text-xs text-muted pt-2">+{upsellOpportunities.length - 20} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "Conversations" && (
        <div className="space-y-6 mb-6">
          {/* Stats bar */}
          {conversations ? (
            <>
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-4">Conversation Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Total Messages</p>
                    <p className="text-lg font-bold">{conversations.message_count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Inbound / Outbound</p>
                    <p className="text-lg font-bold">
                      {conversations.inbound_count} / {conversations.outbound_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Avg Response Time</p>
                    <p className="text-lg font-bold">
                      {conversations.response_time_avg_hrs != null
                        ? `${conversations.response_time_avg_hrs.toFixed(1)}h`
                        : "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Last Contact</p>
                    <p className="text-lg font-bold">{timeAgo(conversations.last_message_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Has Replied</p>
                    <p className="text-lg font-bold">{conversations.has_replied ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Unread</p>
                    <p className="text-lg font-bold">{conversations.unread_count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Workflow Touches</p>
                    <p className="text-lg font-bold">{conversations.workflow_touches}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">First Contact</p>
                    <p className="text-lg font-bold">{formatDate(conversations.first_message_at, { month: "short", day: "numeric" })}</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="bg-card rounded-xl border border-border">
                <div className="p-5 border-b border-border">
                  <h3 className="font-semibold">Recent Messages</h3>
                </div>
                <div className="p-5 space-y-3 max-h-[600px] overflow-y-auto">
                  {recentMessages.length === 0 ? (
                    <p className="text-sm text-muted">No messages synced</p>
                  ) : (
                    [...recentMessages].reverse().map((msg, i) => {
                      const isInbound = msg.direction === "inbound";
                      return (
                        <div key={i} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
                          <div
                            className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                              isInbound ? "bg-card-hover" : "bg-accent/10"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className={`flex items-center gap-2 mt-1 ${isInbound ? "" : "justify-end"}`}>
                              <span className="text-[10px] text-muted">
                                {formatDate(msg.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </span>
                              {msg.source && (
                                <span className="text-[10px] text-muted/60 capitalize">{msg.source}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card rounded-xl border border-dashed border-border p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center text-muted mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-sm font-semibold mb-1">No Conversation History</p>
              <p className="text-xs text-muted leading-relaxed max-w-sm mx-auto">
                SMS and email conversations sync from Market Muscles. If this member has been contacted through the CRM, their messages will appear here after the next sync.
              </p>
              <p className="text-xs text-muted mt-3">
                Run <span className="font-medium text-foreground/70">Sync Market Muscles</span> from the Dashboard to pull the latest conversations.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "Attendance" && (
        <div className="space-y-6 mb-6">
          {/* Trend at top */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Monthly Attendance</h3>
              <span className="text-xs text-muted">{totalAttendance} total classes tracked</span>
            </div>
            <AttendanceTrendChart data={attendanceTrend} />
          </div>

          {/* Attendance table */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">Attendance History</h2>
              <p className="text-xs text-muted mt-1">{attendance.length} classes in app records</p>
            </div>
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {attendance.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-semibold mb-1">No Attendance Records Yet</p>
                  <p className="text-xs text-muted leading-relaxed max-w-sm mx-auto">
                    Attendance data comes from two sources: Zivvy class check-ins (synced via enrichment) and lesson plans tracked in the app. Once this student attends a tracked class, their history will appear here.
                  </p>
                </div>
              ) : (
                attendance.map((a, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{a.lesson_title || a.class_type}</p>
                      <p className="text-xs text-muted">
                        {new Date(a.date + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <p className="text-xs text-muted">
                      {a.class_type} &mdash; {a.instructor}
                      {a.position_area && <span className="text-accent ml-1">{a.position_area}</span>}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
