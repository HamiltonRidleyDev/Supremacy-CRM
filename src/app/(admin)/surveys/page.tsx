"use client";

import { useState, useEffect, useCallback } from "react";

interface Template {
  id: number;
  name: string;
  slug: string;
  description: string;
  target_type: string;
  questions: string;
  is_active: number;
  created_at: string;
}

interface Send {
  id: number;
  template_id: number;
  template_name: string;
  token: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  student_id: number | null;
  lead_id: number | null;
  status: string;
  sent_at: string;
  sent_via: string | null;
  opened_at: string | null;
  completed_at: string | null;
}

interface SendStats {
  template_id: number;
  template_name: string;
  slug: string;
  total_sent: number;
  opened: number;
  completed: number;
  pending: number;
}

interface Profile {
  id: number;
  student_id: number | null;
  lead_id: number | null;
  name: string;
  record_type: string;
  membership_status: string | null;
  belt_rank: string | null;
  preferred_contact: string | null;
  instagram_handle: string | null;
  motivation: string | null;
  goals: string | null;
  schedule_preference: string | null;
  prior_training: string | null;
  quit_reason: string | null;
  willing_to_return: string | null;
  updated_at: string;
}

interface Recipient {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  membership_status?: string;
  status?: string;
}

type Tab = "overview" | "sends" | "profiles";

export default function SurveysPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<SendStats[]>([]);
  const [sends, setSends] = useState<Send[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Send modal state
  const [sendModal, setSendModal] = useState<{ templateId: number; templateName: string; targetType: string } | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; links: Array<{ token: string; name: string; url: string }> } | null>(null);
  const [recipientFilter, setRecipientFilter] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Detail panel
  const [detailSend, setDetailSend] = useState<Send | null>(null);
  const [detailResponses, setDetailResponses] = useState<Array<{ question_key: string; answer: string }>>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const tpl = await fetch("/api/surveys/templates").then((r) => r.json());
    const st = await fetch("/api/surveys/sends/stats").then((r) => r.json());
    const sn = await fetch("/api/surveys/sends").then((r) => r.json());
    setTemplates(Array.isArray(tpl) ? tpl : []);
    setStats(Array.isArray(st) ? st : []);
    setSends(Array.isArray(sn) ? sn : []);
    setLoading(false);
  }, []);

  const loadProfiles = useCallback(async () => {
    // We don't have a profiles API yet, so let's use the sends data to show completion status
    // For a proper profiles view, we'd need a dedicated endpoint
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openSendModal = async (template: Template) => {
    setSendModal({ templateId: template.id, templateName: template.name, targetType: template.target_type });
    setSelectedIds([]);
    setSendResult(null);
    setRecipientFilter("");

    // Fetch recipients based on target type
    const endpoint = template.target_type === "lead" ? "/api/leads" : "/api/students";
    const res = await fetch(endpoint);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.students || data.leads || []);
    setRecipients(list);
  };

  const sendSurveys = async () => {
    if (!sendModal || selectedIds.length === 0) return;
    setSendingBulk(true);
    try {
      const res = await fetch("/api/surveys/sends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: sendModal.templateId,
          recipient_type: sendModal.targetType === "lead" ? "lead" : "student",
          recipient_ids: selectedIds,
        }),
      });
      const data = await res.json();
      setSendResult(data);
      // Refresh stats in background without setting loading=true
      Promise.all([
        fetch("/api/surveys/sends/stats").then((r) => r.json()),
        fetch("/api/surveys/sends").then((r) => r.json()),
      ]).then(([st, sn]) => {
        setStats(Array.isArray(st) ? st : []);
        setSends(Array.isArray(sn) ? sn : []);
      });
    } catch {
      alert("Failed to send surveys");
    } finally {
      setSendingBulk(false);
    }
  };

  const toggleAll = () => {
    const filtered = filteredRecipients();
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((r) => r.id));
    }
  };

  const filteredRecipients = () => {
    if (!recipientFilter) return recipients;
    const q = recipientFilter.toLowerCase();
    return recipients.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q)
    );
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      opened: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      expired: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[status] || "bg-[#222] text-[#888] border-[#333]"}`}>
        {status}
      </span>
    );
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Templates" },
    { key: "sends", label: "Sent Surveys" },
    { key: "profiles", label: "Collected Data" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Surveys</h1>
          <p className="text-xs text-muted mt-1">
            Collect student & prospect profile data to personalize their experience
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-card border border-border rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${
              tab === t.key ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Overview / Templates */}
          {tab === "overview" && (
            <div className="space-y-4">
              {/* Stats cards */}
              {stats.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {stats.map((s) => (
                    <div key={s.template_id} className="bg-card border border-border rounded-xl p-4">
                      <p className="text-[10px] text-muted uppercase tracking-wider">{s.template_name}</p>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold">{s.total_sent}</span>
                        <span className="text-xs text-muted">sent</span>
                      </div>
                      <div className="flex gap-3 mt-2 text-[10px]">
                        <span className="text-amber-400">{s.opened} opened</span>
                        <span className="text-emerald-400">{s.completed} done</span>
                      </div>
                      {s.total_sent > 0 && (
                        <div className="mt-2 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${(s.completed / s.total_sent) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Template list */}
              <div className="grid gap-3">
                {templates.map((t) => {
                  const questions = JSON.parse(t.questions) as Array<{ key: string; label: string; required?: boolean }>;
                  return (
                    <div key={t.id} className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-sm">{t.name}</h3>
                          <p className="text-xs text-muted mt-0.5">{t.description}</p>
                          <div className="flex gap-3 mt-2">
                            <span className="text-[10px] text-muted">
                              {questions.length} questions
                            </span>
                            <span className="text-[10px] text-muted">
                              Target: {t.target_type}s
                            </span>
                            <span className="text-[10px] text-muted">
                              /{t.slug}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => openSendModal(t)}
                          className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
                        >
                          Send to...
                        </button>
                      </div>

                      {/* Question preview */}
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="grid grid-cols-2 gap-1.5">
                          {questions.slice(0, 6).map((q) => (
                            <p key={q.key} className="text-[10px] text-muted truncate">
                              {q.required ? "•" : "○"} {q.label}
                            </p>
                          ))}
                          {questions.length > 6 && (
                            <p className="text-[10px] text-muted">+{questions.length - 6} more</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sends tab */}
          {tab === "sends" && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="px-4 py-3 font-medium">Recipient</th>
                    <th className="px-4 py-3 font-medium">Survey</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Sent</th>
                    <th className="px-4 py-3 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {sends.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted">
                        No surveys sent yet. Go to Templates and click &quot;Send to...&quot; to get started.
                      </td>
                    </tr>
                  ) : (
                    sends.map((s) => (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                        <td className="px-4 py-3 font-medium">{s.recipient_name}</td>
                        <td className="px-4 py-3 text-muted">{s.template_name}</td>
                        <td className="px-4 py-3">{statusBadge(s.status)}</td>
                        <td className="px-4 py-3 text-muted">
                          {new Date(s.sent_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/s/${s.token}`);
                            }}
                            className="text-accent hover:underline text-[10px]"
                          >
                            Copy link
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Profiles / Collected Data tab */}
          {tab === "profiles" && (
            <div>
              <p className="text-xs text-muted mb-4">
                Profile data collected from completed surveys. This enrichment data joins to Zivvy membership records.
              </p>
              {sends.filter((s) => s.status === "completed").length === 0 ? (
                <div className="bg-card border border-border rounded-xl px-6 py-12 text-center">
                  <p className="text-muted text-sm">No surveys completed yet.</p>
                  <p className="text-muted text-xs mt-1">Send surveys to start collecting profile data.</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Survey</th>
                        <th className="px-4 py-3 font-medium">Completed</th>
                        <th className="px-4 py-3 font-medium">Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sends
                        .filter((s) => s.status === "completed")
                        .map((s) => (
                          <tr key={s.id} className="border-b border-border/50 hover:bg-card-hover">
                            <td className="px-4 py-3 font-medium">{s.recipient_name}</td>
                            <td className="px-4 py-3 text-muted">{s.template_name}</td>
                            <td className="px-4 py-3 text-muted">
                              {s.completed_at ? new Date(s.completed_at).toLocaleDateString() : "-"}
                            </td>
                            <td className="px-4 py-3 text-muted">
                              {s.recipient_phone || s.recipient_email || "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Send modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Send: {sendModal.templateName}</h3>
                <p className="text-[10px] text-muted mt-0.5">
                  Select {sendModal.targetType}s to send this survey to
                </p>
              </div>
              <button
                onClick={() => { setSendModal(null); setSendResult(null); }}
                className="text-muted hover:text-foreground p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sendResult ? (
              <div className="p-5">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-4">
                  <p className="text-emerald-400 font-medium text-sm">
                    {sendResult.sent} survey{sendResult.sent !== 1 ? "s" : ""} created!
                  </p>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sendResult.links.map((l) => (
                    <div key={l.token} className="bg-background rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{l.name}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}${l.url}`);
                            setCopiedToken(l.token);
                            setTimeout(() => setCopiedToken(null), 2000);
                          }}
                          className="text-accent hover:underline text-[10px]"
                        >
                          {copiedToken === l.token ? "Copied!" : "Copy link"}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted mt-1 break-all select-all">{window.location.origin}{l.url}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setSendModal(null); setSendResult(null); }}
                  className="mt-4 w-full py-2 rounded-lg bg-accent text-white text-xs font-medium"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="px-5 pt-3">
                  <input
                    type="text"
                    value={recipientFilter}
                    onChange={(e) => setRecipientFilter(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent/50"
                  />
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={toggleAll} className="text-[10px] text-accent hover:underline">
                      {selectedIds.length === filteredRecipients().length ? "Deselect all" : "Select all"}
                    </button>
                    <span className="text-[10px] text-muted">
                      {selectedIds.length} selected
                    </span>
                  </div>

                  <div className="space-y-1">
                    {filteredRecipients().map((r) => {
                      const checked = selectedIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            checked ? "bg-accent/10" : "hover:bg-card-hover"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedIds((prev) =>
                                checked ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                              )
                            }
                            className="rounded border-border"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium">
                              {r.first_name} {r.last_name}
                            </span>
                            <span className="text-[10px] text-muted ml-2">
                              {r.email || r.phone || ""}
                            </span>
                          </div>
                          {r.membership_status && (
                            <span className="text-[10px] text-muted">{r.membership_status}</span>
                          )}
                          {r.status && (
                            <span className="text-[10px] text-muted">{r.status}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-border">
                  <button
                    onClick={sendSurveys}
                    disabled={selectedIds.length === 0 || sendingBulk}
                    className="w-full py-2.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-30 hover:bg-accent/90 transition-colors"
                  >
                    {sendingBulk
                      ? "Generating links..."
                      : `Generate ${selectedIds.length} survey link${selectedIds.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
