"use client";

import { useEffect, useState, useCallback } from "react";

interface Candidate {
  id: number;
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
  days_absent: number | null;
  total_classes: number | null;
  current_program: string;
  monthly_rate: number | null;
  goals: string | null;
  motivation: string | null;
  injuries_concerns: string | null;
  schedule_preference: string | null;
  recent_outreach_count: number;
  last_outreach_at: string | null;
}

interface QueueItem {
  id: number;
  contact_id: number;
  message_type: string;
  tone: string;
  body: string;
  subject: string | null;
  context_summary: string | null;
  status: string;
  approved_by: string | null;
  edited_body: string | null;
  sent_at: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  risk_level: string | null;
  belt_rank: string | null;
  days_absent: number | null;
}

interface Stats {
  ghost_count: number;
  at_risk_count: number;
  cooling_count: number;
  revenue_at_risk: number;
  sent_this_week: number;
}

type Tab = "queue" | "candidates";
type GenerateOptions = {
  contactId: number;
  messageType: "sms" | "email";
  tone: "warm" | "casual" | "concerned";
};

export default function ReEngagementPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("queue");
  const [generating, setGenerating] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);
  const [genOptions, setGenOptions] = useState<Partial<GenerateOptions>>({});

  const fetchData = useCallback(() => {
    fetch("/api/re-engagement")
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then((d) => {
        setCandidates(d.candidates || []);
        setQueue(d.queue || []);
        setStats(d.stats || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-switch to queue tab when there are pending items
  useEffect(() => {
    if (queue.length > 0 && tab === "candidates") {
      // Don't auto-switch if user is actively browsing candidates
    }
  }, [queue, tab]);

  const handleGenerate = async (contactId: number, messageType: "sms" | "email" = "sms", tone: "warm" | "casual" | "concerned" = "warm") => {
    setGenerating(contactId);
    try {
      const res = await fetch("/api/re-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, messageType, tone }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate");
      }
      setExpandedCandidate(null);
      setGenOptions({});
      setTab("queue");
      fetchData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(null);
    }
  };

  const handleAction = async (id: number, action: "approve" | "send" | "dismiss", editedBody?: string) => {
    setActing(id);
    try {
      await fetch("/api/re-engagement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, editedBody }),
      });
      setEditingId(null);
      setEditText("");
      fetchData();
    } catch {
      alert("Action failed");
    } finally {
      setActing(null);
    }
  };

  const handleSaveEdit = async (id: number) => {
    setActing(id);
    try {
      await fetch("/api/re-engagement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "edit", editedBody: editText }),
      });
      setEditingId(null);
      setEditText("");
      fetchData();
    } catch {
      alert("Save failed");
    } finally {
      setActing(null);
    }
  };

  const riskBadge = (level: string | null) => {
    const styles: Record<string, string> = {
      ghost: "bg-red-500/15 text-red-400",
      at_risk: "bg-orange-500/15 text-orange-400",
      cooling: "bg-yellow-500/15 text-yellow-400",
      healthy: "bg-green-500/15 text-green-400",
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${styles[level || ""] || "bg-white/5 text-muted"}`}>
        {(level || "unknown").replace("_", " ")}
      </span>
    );
  };

  const formatDaysAgo = (days: number | null) => {
    if (days == null) return "unknown";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const pendingCount = queue.filter(q => q.status === "pending").length;
  const approvedCount = queue.filter(q => q.status === "approved").length;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-20 text-muted animate-pulse">Loading re-engagement data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold">Student Re-engagement</h1>
        <p className="text-xs md:text-sm text-muted mt-1">
          Active members who stopped showing up. AI drafts personal check-ins for your review.
        </p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <div className="text-lg font-bold text-red-400">{stats.ghost_count}</div>
            <div className="text-[10px] text-muted">Ghost</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <div className="text-lg font-bold text-orange-400">{stats.at_risk_count}</div>
            <div className="text-[10px] text-muted">At Risk</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <div className="text-lg font-bold text-yellow-400">{stats.cooling_count}</div>
            <div className="text-[10px] text-muted">Cooling</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <div className="text-lg font-bold text-accent">${Math.round(stats.revenue_at_risk)}</div>
            <div className="text-[10px] text-muted">$/mo at risk</div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-card rounded-xl border border-border p-1 mb-5">
        <button
          onClick={() => setTab("queue")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "queue" ? "bg-accent text-white" : "text-muted hover:text-foreground"
          }`}
        >
          Review Queue
          {pendingCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab("candidates")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "candidates" ? "bg-accent text-white" : "text-muted hover:text-foreground"
          }`}
        >
          At-Risk Members
          <span className="ml-1.5 text-[10px] opacity-60">{candidates.length}</span>
        </button>
      </div>

      {error && (
        <div className="text-center py-8">
          <p className="text-danger text-sm">{error}</p>
          <button onClick={() => { setError(null); fetchData(); }} className="text-xs text-accent mt-2 hover:underline">Retry</button>
        </div>
      )}

      {/* ===== QUEUE TAB ===== */}
      {tab === "queue" && (
        <div>
          {queue.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">&#9993;</div>
              <p className="text-muted text-sm">No messages in queue</p>
              <p className="text-muted text-xs mt-1">Go to At-Risk Members to generate check-in messages</p>
              <button
                onClick={() => setTab("candidates")}
                className="mt-4 px-4 py-2 rounded-xl text-sm bg-accent text-white hover:bg-accent-dim transition-colors"
              >
                View At-Risk Members
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => (
                <div key={item.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-3 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs font-bold">
                        {item.first_name[0]}{item.last_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.first_name} {item.last_name}</p>
                        <div className="flex items-center gap-2">
                          {riskBadge(item.risk_level)}
                          {item.days_absent != null && (
                            <span className="text-[10px] text-muted">Last seen {formatDaysAgo(item.days_absent)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        item.message_type === "sms" ? "bg-blue-500/15 text-blue-400" : "bg-purple-500/15 text-purple-400"
                      }`}>
                        {item.message_type.toUpperCase()}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        item.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : "bg-green-500/15 text-green-400"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* AI Context */}
                  {item.context_summary && (
                    <div className="px-3 pb-2">
                      <p className="text-[11px] text-muted italic">{item.context_summary}</p>
                    </div>
                  )}

                  {/* Message body */}
                  <div className="px-3 pb-2">
                    {editingId === item.id ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-background border border-accent/30 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-accent/50"
                          rows={4}
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={acting === item.id}
                            className="flex-1 py-2 rounded-lg text-xs font-medium bg-accent text-white disabled:opacity-50"
                          >
                            Save Edit
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditText(""); }}
                            className="px-3 py-2 rounded-lg text-xs text-muted hover:text-foreground border border-border"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-background rounded-lg px-3 py-2.5">
                        {item.subject && (
                          <p className="text-xs font-medium text-accent mb-1">Subject: {item.subject}</p>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.edited_body || item.body}</p>
                        {item.edited_body && (
                          <p className="text-[10px] text-accent mt-1">Edited</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions — big touch-friendly buttons */}
                  {editingId !== item.id && item.status === "pending" && (
                    <div className="flex border-t border-border">
                      <button
                        onClick={() => handleAction(item.id, "dismiss")}
                        disabled={acting === item.id}
                        className="flex-1 py-3 text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors border-r border-border disabled:opacity-50"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => { setEditingId(item.id); setEditText(item.edited_body || item.body); }}
                        className="flex-1 py-3 text-xs font-medium text-accent hover:bg-accent/5 transition-colors border-r border-border"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleAction(item.id, "approve")}
                        disabled={acting === item.id}
                        className="flex-1 py-3 text-xs font-medium text-green-400 hover:bg-green-500/5 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                  {editingId !== item.id && item.status === "approved" && (
                    <div className="flex border-t border-border">
                      <button
                        onClick={() => handleAction(item.id, "dismiss")}
                        disabled={acting === item.id}
                        className="flex-1 py-3 text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors border-r border-border disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleAction(item.id, "send")}
                        disabled={acting === item.id}
                        className="flex-1 py-3 text-xs font-medium text-green-400 hover:bg-green-500/5 transition-colors disabled:opacity-50"
                      >
                        Mark as Sent
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {stats && stats.sent_this_week > 0 && (
            <p className="text-center text-[11px] text-muted mt-4">
              {stats.sent_this_week} message{stats.sent_this_week !== 1 ? "s" : ""} sent this week
            </p>
          )}
        </div>
      )}

      {/* ===== CANDIDATES TAB ===== */}
      {tab === "candidates" && (
        <div>
          {candidates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">&#127881;</div>
              <p className="text-muted text-sm">No at-risk members right now</p>
              <p className="text-muted text-xs mt-1">Everyone is showing up. Nice work, Professor.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const isExpanded = expandedCandidate === c.id;
                const isGenerating = generating === c.id;
                const hasRecentOutreach = c.recent_outreach_count > 0;

                return (
                  <div key={c.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    {/* Candidate row — tap to expand */}
                    <button
                      onClick={() => setExpandedCandidate(isExpanded ? null : c.id)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-card-hover transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        c.risk_level === "ghost" ? "bg-red-500/15 text-red-400" :
                        c.risk_level === "at_risk" ? "bg-orange-500/15 text-orange-400" :
                        "bg-yellow-500/15 text-yellow-400"
                      }`}>
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                          {hasRecentOutreach && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent shrink-0">contacted</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {riskBadge(c.risk_level)}
                          <span className="text-[10px] text-muted">
                            {c.days_absent != null ? `${formatDaysAgo(c.days_absent)}` : "?"}
                          </span>
                          {c.belt_rank && (
                            <span className="text-[10px] text-muted">{c.belt_rank}{c.stripes ? ` ${c.stripes}s` : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {c.monthly_rate != null && (
                          <p className="text-sm font-medium">${c.monthly_rate}</p>
                        )}
                        <p className="text-[10px] text-muted">/mo</p>
                      </div>
                      <svg className={`w-4 h-4 text-muted shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded detail + generate */}
                    {isExpanded && (
                      <div className="border-t border-border p-3 space-y-3">
                        {/* Context */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {c.current_program && (
                            <div><span className="text-muted">Program:</span> {c.current_program}</div>
                          )}
                          {c.total_classes != null && (
                            <div><span className="text-muted">Classes:</span> {c.total_classes}</div>
                          )}
                          {c.engagement_score != null && (
                            <div><span className="text-muted">Engagement:</span> {c.engagement_score}/100</div>
                          )}
                          {c.schedule_preference && (
                            <div><span className="text-muted">Prefers:</span> {c.schedule_preference}</div>
                          )}
                        </div>

                        {c.risk_factors.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {c.risk_factors.map((f, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                                {f.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}

                        {c.injuries_concerns && (
                          <p className="text-xs text-yellow-400">
                            Note: {c.injuries_concerns}
                          </p>
                        )}

                        {hasRecentOutreach && (
                          <p className="text-xs text-muted">
                            Already contacted in the last 14 days ({c.recent_outreach_count}x).
                            Consider waiting unless urgent.
                          </p>
                        )}

                        {/* Generate options */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={genOptions.messageType || "sms"}
                              onChange={(e) => setGenOptions(prev => ({ ...prev, messageType: e.target.value as any }))}
                              className="flex-1 bg-background border border-border rounded-lg px-2 py-2 text-xs focus:outline-none"
                            >
                              <option value="sms">SMS</option>
                              <option value="email">Email</option>
                            </select>
                            <select
                              value={genOptions.tone || (
                                c.days_absent && c.days_absent > 60 ? "concerned" :
                                c.days_absent && c.days_absent > 30 ? "warm" : "casual"
                              )}
                              onChange={(e) => setGenOptions(prev => ({ ...prev, tone: e.target.value as any }))}
                              className="flex-1 bg-background border border-border rounded-lg px-2 py-2 text-xs focus:outline-none"
                            >
                              <option value="casual">Casual</option>
                              <option value="warm">Warm</option>
                              <option value="concerned">Concerned</option>
                            </select>
                          </div>

                          <button
                            onClick={() => handleGenerate(
                              c.id,
                              (genOptions.messageType as any) || "sms",
                              (genOptions.tone as any) || (
                                c.days_absent && c.days_absent > 60 ? "concerned" :
                                c.days_absent && c.days_absent > 30 ? "warm" : "casual"
                              )
                            )}
                            disabled={isGenerating}
                            className="w-full py-3 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-dim transition-colors disabled:opacity-50 active:scale-[0.98]"
                          >
                            {isGenerating ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                AI is drafting...
                              </span>
                            ) : (
                              "Draft Check-in Message"
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
