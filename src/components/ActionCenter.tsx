"use client";

import { useState } from "react";
import CostSparkline from "./CostSparkline";

interface CostTrendData {
  months: Array<{ month: string; paid: number; classes: number; cost_per_class: number | null }>;
  recent_cpc: number | null;
  prior_cpc: number | null;
  trend_pct: number | null;
}

interface ChildCandidate {
  id: number;
  zivvy_id?: string | null;
  first_name: string;
  last_name: string;
  age_group: string | null;
  belt_rank: string | null;
  stripes: number | null;
  current_program: string | null;
  total_classes: number | null;
  days_absent: number | null;
  last_attendance: string | null;
  risk_level: string | null;
  risk_factors: string[];
  monthly_rate: number | null;
  ltv: number | null;
  cost_per_class: number | null;
  quit_reason: string | null;
}

interface WinBackCandidate {
  id: number | string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  contact_type: string;
  risk_level: string;
  engagement_score: number | null;
  monthly_revenue: number | null;
  risk_factors: string[];
  age_group: string | null;
  belt_rank: string | null;
  stripes: number | null;
  last_attendance: string | null;
  start_date: string | null;
  total_classes: number | null;
  current_program: string | null;
  monthly_rate: number | null;
  ltv: number | null;
  cost_per_class: number | null;
  quit_reason: string | null;
  willing_to_return: string | null;
  goals: string | null;
  days_absent: number | null;
  conv_message_count: number | null;
  has_replied: number | null;
  zivvy_id?: string | null;
  household_member_count: number;
  pending_suggestions: number;
  // Household fields
  is_household?: boolean;
  children?: ChildCandidate[] | null;
  household_child_count?: number;
  household_revenue_at_risk?: number;
  household_ltv?: number;
  recipient_type?: string;
  all_parent_names?: string[];
}

interface Suggestion {
  id: number;
  contact_id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  message_type: string;
  tone: string;
  body: string;
  context_summary: string | null;
  status: string;
  risk_level: string | null;
  monthly_revenue: number | null;
  created_at: string;
}

interface ActionCenterProps {
  candidates: WinBackCandidate[];
  activeSuggestions: Suggestion[];
  costTrends: Record<string, CostTrendData>;
  onRefresh: () => void;
}

const beltColors: Record<string, string> = {
  White: "bg-gray-100 text-gray-800",
  white: "bg-gray-100 text-gray-800",
  Blue: "bg-blue-100 text-blue-800",
  blue: "bg-blue-100 text-blue-800",
  Purple: "bg-purple-100 text-purple-800",
  purple: "bg-purple-100 text-purple-800",
  Brown: "bg-amber-800/20 text-amber-700",
  brown: "bg-amber-800/20 text-amber-700",
  Black: "bg-gray-800 text-white",
  black: "bg-gray-800 text-white",
};

const riskStyles: Record<string, { bg: string; text: string; label: string }> = {
  ghost: { bg: "bg-danger/10", text: "text-danger", label: "Ghost" },
  at_risk: { bg: "bg-warning/10", text: "text-warning", label: "At Risk" },
  churned: { bg: "bg-gray-500/10", text: "text-muted", label: "Churned" },
  cooling: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Cooling" },
};

const toneOptions = [
  { value: "warm", label: "Warm", desc: "Empathetic, caring" },
  { value: "casual", label: "Casual", desc: "Buddy check-in" },
  { value: "urgent", label: "Urgent", desc: "Time-sensitive hook" },
] as const;

export default function ActionCenter({
  candidates,
  activeSuggestions,
  costTrends,
  onRefresh,
}: ActionCenterProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedMessages, setGeneratedMessages] = useState<
    Record<string, { id: number; body: string; subject: string | null; context: string | null; messageType: string; tone: string }>
  >({});
  const [selectedTone, setSelectedTone] = useState<Record<string, string>>({});
  const [selectedType, setSelectedType] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"candidates" | "queue">("candidates");
  const [costThreshold, setCostThreshold] = useState<number>(25);

  const handleGenerate = async (candidate: WinBackCandidate, cardKey: string) => {
    const key = cardKey;
    setGenerating(key);
    setError(null);
    try {
      const payload: any = {
        messageType: selectedType[key] || "sms",
        tone: selectedTone[key] || "warm",
      };

      if (candidate.is_household && candidate.children && candidate.children.length > 0) {
        // Household mode: send parent info + children array
        payload.isHousehold = true;
        payload.contactId = typeof candidate.id === "number" ? candidate.id : 0;
        payload.parentName = `${candidate.first_name} ${candidate.last_name}`;
        payload.children = candidate.children.map((ch) => ({
          id: ch.id,
          first_name: ch.first_name,
          last_name: ch.last_name,
          age_group: ch.age_group,
          belt_rank: ch.belt_rank,
          stripes: ch.stripes,
          current_program: ch.current_program,
          total_classes: ch.total_classes,
          days_absent: ch.days_absent,
          last_attendance: ch.last_attendance,
          risk_level: ch.risk_level,
          risk_factors: ch.risk_factors || [],
          monthly_rate: ch.monthly_rate,
          quit_reason: ch.quit_reason,
        }));
      } else {
        // Individual mode
        payload.contactId = candidate.id;
      }

      const res = await fetch("/api/winback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate message");
      }
      const data = await res.json();
      setGeneratedMessages((prev) => ({
        ...prev,
        [key]: {
          id: data.id,
          body: data.body,
          subject: data.subject,
          context: data.context,
          messageType: data.messageType,
          tone: data.tone,
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(null);
    }
  };

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleStatusUpdate = async (
    suggestionId: number,
    status: "approved" | "sent" | "dismissed"
  ) => {
    setUpdatingStatus(suggestionId);
    try {
      await fetch("/api/winback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, status }),
      });
      onRefresh();
    } catch {
      // silent fail
    } finally {
      setUpdatingStatus(null);
    }
  };

  const queueCount = activeSuggestions.length + Object.keys(generatedMessages).length;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
        Win-Back Actions &mdash; Data &rarr; Insight &rarr; Action
      </h2>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("candidates")}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            tab === "candidates"
              ? "bg-accent/10 text-accent border border-accent/30"
              : "bg-card border border-border text-muted hover:text-foreground"
          }`}
        >
          Candidates ({candidates.length})
        </button>
        <button
          onClick={() => setTab("queue")}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            tab === "queue"
              ? "bg-accent/10 text-accent border border-accent/30"
              : "bg-card border border-border text-muted hover:text-foreground"
          }`}
        >
          Message Queue ({queueCount})
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* CANDIDATES TAB */}
      {tab === "candidates" && (() => {
        const familyCandidates = candidates.filter(
          (c) => c.is_household && c.children && c.children.length > 0
        );
        const individualCandidates = candidates.filter(
          (c) => !(c.is_household && c.children && c.children.length > 0)
        );

        const renderCard = (c: WinBackCandidate, idx: number) => {
          const isHousehold = c.is_household && c.children && c.children.length > 0;
          const key = isHousehold ? `hh-${c.id}-${idx}` : `ind-${c.id}`;
          const risk = riskStyles[c.risk_level] || riskStyles.churned;
          const generated = generatedMessages[key];
          const isGenerating = generating === key;
          const tone = selectedTone[key] || "warm";
          const msgType = selectedType[key] || "sms";

          return (
            <div
              key={key}
              className={`bg-card rounded-xl border overflow-hidden ${
                isHousehold ? "border-accent/30" : "border-border"
              }`}
            >
              {/* Card Header */}
              <div className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs font-semibold">
                      {isHousehold ? (
                        <>
                          <span className="text-muted font-normal">To:</span>{" "}
                          {c.first_name} {c.last_name}
                          {c.all_parent_names && c.all_parent_names.length > 1 && (
                            <span className="text-muted font-normal">
                              {" "}(or {c.all_parent_names.slice(1).join(", ")})
                            </span>
                          )}
                        </>
                      ) : (
                        <>{c.first_name} {c.last_name}</>
                      )}
                    </h3>
                    <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${risk.bg} ${risk.text}`}>
                      {risk.label}
                    </span>
                    {!isHousehold && c.belt_rank && (
                      <span className={`px-1 py-0.5 text-[9px] font-medium rounded ${beltColors[c.belt_rank] || "bg-gray-100 text-gray-600"}`}>
                        {c.belt_rank}{c.stripes ? ` ${c.stripes}s` : ""}
                      </span>
                    )}
                    {!isHousehold && c.age_group && (
                      <span className="text-[9px] text-muted">{c.age_group}</span>
                    )}
                  </div>

                  {/* Household: show children */}
                  {isHousehold && c.children && (
                    <div className="mt-1.5 space-y-0.5">
                      {c.children.map((child) => {
                        const childRisk = riskStyles[child.risk_level || ""] || riskStyles.churned;
                        const cpcOver = child.cost_per_class != null && child.cost_per_class >= costThreshold;
                        return (
                          <div key={child.id} className="flex items-center gap-1.5 pl-2 border-l-2 border-accent/20">
                            <span className="text-[11px] font-medium">{child.first_name}</span>
                            <span className={`px-1 py-0.5 text-[8px] rounded ${childRisk.bg} ${childRisk.text}`}>
                              {childRisk.label}
                            </span>
                            {child.age_group && (
                              <span className="text-[9px] text-muted">{child.age_group}</span>
                            )}
                            {child.days_absent != null && (
                              <span className="text-[9px] text-danger font-medium">{child.days_absent}d</span>
                            )}
                            {child.monthly_rate != null && (
                              <span className="text-[9px] text-muted">${child.monthly_rate}/mo</span>
                            )}
                            {child.cost_per_class != null && (
                              <span className={`text-[9px] font-medium ${cpcOver ? "text-danger" : "text-success"}`}
                                title={`$${child.cost_per_class.toFixed(0)}/class${cpcOver ? " — over threshold" : ""}`}
                              >
                                ${child.cost_per_class.toFixed(0)}/cls
                              </span>
                            )}
                            {child.zivvy_id && costTrends[String(child.zivvy_id)] && (
                              <CostSparkline trend={costTrends[String(child.zivvy_id)]} threshold={costThreshold} width={60} height={18} />
                            )}
                          </div>
                        );
                      })}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {c.household_revenue_at_risk != null && c.household_revenue_at_risk > 0 && (
                          <span className="text-[10px] text-danger font-medium">
                            ${c.household_revenue_at_risk}/mo at risk
                          </span>
                        )}
                        {c.household_ltv != null && c.household_ltv > 0 && (
                          <span className="text-[10px] text-muted">
                            LTV ${c.household_ltv.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Individual: show context */}
                  {!isHousehold && (() => {
                    const cpcOver = c.cost_per_class != null && c.cost_per_class >= costThreshold;
                    return (
                    <>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
                        {c.days_absent != null && (
                          <span><span className="text-danger font-medium">{c.days_absent}d</span> absent</span>
                        )}
                        {c.monthly_rate != null && <span>${c.monthly_rate}/mo</span>}
                        {c.total_classes != null && <span>{c.total_classes} cls</span>}
                        {c.current_program && <span>{c.current_program}</span>}
                        {c.ltv != null && <span>LTV ${c.ltv.toLocaleString()}</span>}
                        {c.cost_per_class != null && (
                          <span className={`font-medium ${cpcOver ? "text-danger" : "text-success"}`}
                            title={`$${c.cost_per_class.toFixed(0)}/class${cpcOver ? " — over threshold" : ""}`}
                          >
                            ${c.cost_per_class.toFixed(0)}/cls
                          </span>
                        )}
                      </div>
                      {/* Cost trend sparkline */}
                      {c.zivvy_id && costTrends[String(c.zivvy_id)] && (
                        <div className="mt-1">
                          <CostSparkline trend={costTrends[String(c.zivvy_id)]} threshold={costThreshold} />
                        </div>
                      )}
                      {c.risk_factors && c.risk_factors.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.risk_factors.slice(0, 2).map((f, i) => (
                            <span key={i} className="text-[9px] px-1 py-0.5 bg-danger/5 text-danger/70 rounded">{f}</span>
                          ))}
                        </div>
                      )}
                      {c.quit_reason && (
                        <p className="mt-1 text-[10px] text-warning/80 italic truncate">
                          Left: {c.quit_reason}
                        </p>
                      )}
                    </>
                    );
                  })()}
                </div>

                {/* Contact info */}
                <div className="text-right flex-shrink-0">
                  {c.phone && <p className="text-[10px] font-mono text-muted">{c.phone}</p>}
                </div>
              </div>

              {/* Action Bar */}
              <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
                <div className="flex gap-0.5">
                  {toneOptions.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setSelectedTone((prev) => ({ ...prev, [key]: t.value }))}
                      className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                        tone === t.value
                          ? "bg-accent/20 text-accent border border-accent/30"
                          : "bg-background border border-border text-muted hover:text-foreground"
                      }`}
                      title={t.desc}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-0.5">
                  {(["sms", "email"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType((prev) => ({ ...prev, [key]: type }))}
                      className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                        msgType === type
                          ? "bg-accent/20 text-accent border border-accent/30"
                          : "bg-background border border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleGenerate(c, key)}
                  disabled={isGenerating}
                  className="ml-auto px-2 py-1 text-[10px] font-medium rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      ...
                    </>
                  ) : generated ? (
                    "Redo"
                  ) : c.pending_suggestions > 0 ? (
                    "New Msg"
                  ) : isHousehold ? (
                    "Message Parent"
                  ) : (
                    "Generate"
                  )}
                </button>
              </div>

              {/* Generated Message Preview */}
              {generated && (
                <div className="border-t border-border bg-background/50 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[9px] font-medium text-accent uppercase">
                      {generated.messageType} &mdash; {generated.tone}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopy(generated.body, generated.id)}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors"
                      >
                        {copied === generated.id ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(generated.id, "approved")}
                        disabled={updatingStatus === generated.id}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(generated.id, "dismissed")}
                        disabled={updatingStatus === generated.id}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-gray-500/10 text-muted border border-border hover:bg-gray-500/20 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  {generated.subject && (
                    <p className="text-[11px] font-medium mb-1">Subject: {generated.subject}</p>
                  )}

                  <div className="bg-card rounded-lg border border-border p-2 mb-1.5">
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{generated.body}</p>
                  </div>

                  {generated.context && (
                    <p className="text-[10px] text-muted italic">AI: {generated.context}</p>
                  )}
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            {candidates.length === 0 && (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <p className="text-muted text-sm">No win-back candidates found.</p>
                <p className="text-muted text-xs mt-1">Run engagement scoring to identify at-risk and ghost members.</p>
              </div>
            )}

            {candidates.length > 0 && (
              <>
              {/* Cost-per-class threshold control */}
              <div className="flex items-center gap-3 mb-3 p-2.5 bg-card rounded-lg border border-border">
                <label className="text-[10px] text-muted uppercase tracking-wider font-semibold whitespace-nowrap">
                  Cost/Class Alert
                </label>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={5}
                  value={costThreshold}
                  onChange={(e) => setCostThreshold(Number(e.target.value))}
                  className="flex-1 h-1 accent-accent max-w-[180px]"
                />
                <span className="text-xs font-mono font-semibold text-accent min-w-[40px]">${costThreshold}</span>
                <span className="text-[10px] text-muted">
                  <span className="text-danger font-medium">Red</span> = paying &ge;${costThreshold}/class
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Families Column */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded font-medium">FAMILY</span>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                      Households ({familyCandidates.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {familyCandidates.length === 0 ? (
                      <p className="text-xs text-muted p-4 text-center bg-card rounded-xl border border-border">
                        No family candidates
                      </p>
                    ) : (
                      familyCandidates.map((c, idx) => renderCard(c, idx))
                    )}
                  </div>
                </div>

                {/* Individuals Column */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                      Individuals ({individualCandidates.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {individualCandidates.length === 0 ? (
                      <p className="text-xs text-muted p-4 text-center bg-card rounded-xl border border-border">
                        No individual candidates
                      </p>
                    ) : (
                      individualCandidates.map((c, idx) => renderCard(c, idx))
                    )}
                  </div>
                </div>
              </div>
              </>
            )}
          </>
        );
      })()}

      {/* QUEUE TAB */}
      {tab === "queue" && (
        <div className="space-y-3">
          {activeSuggestions.length === 0 && Object.keys(generatedMessages).length === 0 && (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <p className="text-muted text-sm">No messages in queue.</p>
              <p className="text-muted text-xs mt-1">Generate messages from the Candidates tab.</p>
            </div>
          )}

          {activeSuggestions.map((s) => (
            <div key={s.id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-semibold">{s.first_name} {s.last_name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      s.status === "approved" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"
                    }`}>
                      {s.status}
                    </span>
                    <span className="text-[10px] text-muted uppercase">{s.message_type} &mdash; {s.tone}</span>
                    <span className="text-[10px] text-muted">{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {s.phone && <p className="text-xs font-mono text-muted">{s.phone}</p>}
                  {s.email && <p className="text-[10px] text-muted truncate max-w-[160px]">{s.email}</p>}
                </div>
              </div>

              <div className="bg-background rounded-lg border border-border p-3 mb-2">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{s.body}</p>
              </div>

              {s.context_summary && (
                <p className="text-[11px] text-muted italic mb-2">{s.context_summary}</p>
              )}

              <div className="flex gap-1.5">
                <button
                  onClick={() => handleCopy(s.body, s.id)}
                  className="px-2 py-1 text-[10px] rounded bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors"
                >
                  {copied === s.id ? "Copied!" : "Copy Message"}
                </button>
                {s.status === "suggested" && (
                  <button
                    onClick={() => handleStatusUpdate(s.id, "approved")}
                    disabled={updatingStatus === s.id}
                    className="px-2 py-1 text-[10px] rounded bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => handleStatusUpdate(s.id, "sent")}
                  disabled={updatingStatus === s.id}
                  className="px-2 py-1 text-[10px] rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                >
                  Mark Sent
                </button>
                <button
                  onClick={() => handleStatusUpdate(s.id, "dismissed")}
                  disabled={updatingStatus === s.id}
                  className="px-2 py-1 text-[10px] rounded bg-gray-500/10 text-muted border border-border hover:bg-gray-500/20 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
