"use client";

import { useEffect, useState } from "react";

interface Lead {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  interest: string;
  status: string;
  assigned_to: string;
  notes: string;
  created_at: string;
  last_contact: string | null;
  follow_up_count: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  contacted: { label: "Contacted", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  trial_booked: { label: "Trial Booked", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  trial_attended: { label: "Trial Attended", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  signed_up: { label: "Signed Up", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  lost: { label: "Lost", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

const sourceLabels: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  walk_in: "Walk-in",
  competitor: "Competitor",
  social_media: "Social Media",
};

const pipelineStages = ["new", "contacted", "trial_booked", "trial_attended", "signed_up"];

interface FunnelMonth {
  month: string;
  total_leads: number;
  contacted: number;
  trial_booked: number;
  trial_attended: number;
  signed_up: number;
  lost: number;
}

const funnelStages: { key: keyof Omit<FunnelMonth, "month" | "lost">; label: string; color: string; barColor: string }[] = [
  { key: "total_leads", label: "Total Leads", color: "text-blue-400", barColor: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "text-yellow-400", barColor: "bg-yellow-500" },
  { key: "trial_booked", label: "Trial Booked", color: "text-orange-400", barColor: "bg-orange-500" },
  { key: "trial_attended", label: "Trial Attended", color: "text-purple-400", barColor: "bg-purple-500" },
  { key: "signed_up", label: "Signed Up", color: "text-green-400", barColor: "bg-green-500" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [funnel, setFunnel] = useState<FunnelMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"pipeline" | "table" | "funnel">("pipeline");

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setLeads(data.leads);
        setFunnel(data.funnel);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted animate-pulse">Loading leads...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-danger font-medium">Failed to load leads</p>
          <p className="text-sm text-muted mt-1">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm text-accent hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const conversionRate = leads.length > 0
    ? Math.round((leads.filter((l) => l.status === "signed_up").length / leads.length) * 100)
    : 0;

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Leads / CRM</h1>
          <p className="text-sm text-muted mt-1">
            {leads.length} total leads — {conversionRate}% conversion rate
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("pipeline")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === "pipeline" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === "table" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setView("funnel")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === "funnel" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            Funnel
          </button>
        </div>
      </div>

      {view === "pipeline" ? (
        /* Kanban Pipeline */
        <div className="grid grid-cols-5 gap-4">
          {pipelineStages.map((stage) => {
            const stageLeads = leads.filter((l) => l.status === stage);
            const cfg = statusConfig[stage];
            return (
              <div key={stage} className="bg-card rounded-xl border border-border">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded border font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-muted">{stageLeads.length}</span>
                  </div>
                </div>
                <div className="p-3 space-y-3 min-h-[200px]">
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="bg-background rounded-lg border border-border p-3 hover:border-accent/30 transition-colors">
                      <p className="text-sm font-medium">{lead.first_name} {lead.last_name}</p>
                      <p className="text-xs text-muted mt-1">{lead.interest?.replace("_", " ")}</p>
                      {lead.source && (
                        <p className="text-xs text-accent mt-1">{sourceLabels[lead.source] || lead.source}</p>
                      )}
                      {lead.notes && (
                        <p className="text-xs text-muted mt-2 border-t border-border pt-2">{lead.notes}</p>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-1">
                        <span className="text-xs text-muted">
                          {new Date(lead.created_at + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        {lead.follow_up_count > 0 && (
                          <span className="text-xs text-muted">{lead.follow_up_count} follow-ups</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "table" ? (
        /* Table View */
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Lead</th>
                <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Status</th>
                <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Source</th>
                <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Interest</th>
                <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Assigned</th>
                <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Created</th>
                <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Last Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => {
                const cfg = statusConfig[lead.status] || statusConfig.new;
                return (
                  <tr key={lead.id} className="hover:bg-card-hover transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium">{lead.first_name} {lead.last_name}</p>
                      {lead.notes && <p className="text-xs text-muted truncate max-w-[200px]">{lead.notes}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded border font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted">{sourceLabels[lead.source] || lead.source}</td>
                    <td className="px-5 py-3 text-sm text-muted capitalize">{lead.interest?.replace("_", " ")}</td>
                    <td className="px-5 py-3 text-sm">{lead.assigned_to}</td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {new Date(lead.created_at + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {lead.last_contact
                        ? new Date(lead.last_contact + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : <span className="text-danger">None</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Funnel View */
        <div className="space-y-8">
          {/* Conversion Funnel Visualization */}
          {(() => {
            const totals = funnel.reduce(
              (acc, m) => ({
                total_leads: acc.total_leads + m.total_leads,
                contacted: acc.contacted + m.contacted,
                trial_booked: acc.trial_booked + m.trial_booked,
                trial_attended: acc.trial_attended + m.trial_attended,
                signed_up: acc.signed_up + m.signed_up,
                lost: acc.lost + m.lost,
              }),
              { total_leads: 0, contacted: 0, trial_booked: 0, trial_attended: 0, signed_up: 0, lost: 0 }
            );
            const maxVal = totals.total_leads || 1;

            return (
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-6">Overall Conversion Funnel</h2>
                <div className="space-y-3">
                  {funnelStages.map((stage, i) => {
                    const val = totals[stage.key];
                    const widthPct = Math.max((val / maxVal) * 100, 2);
                    const prevVal = i > 0 ? totals[funnelStages[i - 1].key] : null;
                    const convPct = prevVal && prevVal > 0 ? Math.round((val / prevVal) * 100) : null;

                    return (
                      <div key={stage.key}>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-medium w-28 text-right ${stage.color}`}>{stage.label}</span>
                          <div className="flex-1 relative">
                            <div
                              className={`${stage.barColor} h-9 rounded-md flex items-center transition-all`}
                              style={{ width: `${widthPct}%` }}
                            >
                              <span className="text-xs font-bold text-white px-3">{val}</span>
                            </div>
                          </div>
                          {convPct !== null && (
                            <span className="text-xs text-muted w-16 text-right">{convPct}%</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted">
                  <span>Lost: <span className="text-zinc-400 font-medium">{totals.lost}</span></span>
                  <span className="mx-2">|</span>
                  <span>Overall conversion: <span className="text-green-400 font-medium">{totals.total_leads > 0 ? Math.round((totals.signed_up / totals.total_leads) * 100) : 0}%</span></span>
                </div>
              </div>
            );
          })()}

          {/* Monthly Breakdown Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Month</th>
                  {funnelStages.map((s) => (
                    <th key={s.key} className={`px-5 py-3 text-xs uppercase tracking-wider font-medium ${s.color}`}>{s.label}</th>
                  ))}
                  <th className="px-5 py-3 text-xs text-zinc-400 uppercase tracking-wider font-medium">Lost</th>
                  <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Conv %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {funnel.map((m) => {
                  const conv = m.total_leads > 0 ? Math.round((m.signed_up / m.total_leads) * 100) : 0;
                  const monthLabel = new Date(m.month + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
                  return (
                    <tr key={m.month} className="hover:bg-card-hover transition-colors">
                      <td className="px-5 py-3 text-sm font-medium">{monthLabel}</td>
                      {funnelStages.map((s) => {
                        const val = m[s.key];
                        const maxInCol = Math.max(...funnel.map((fm) => fm[s.key]), 1);
                        const intensity = Math.round((val / maxInCol) * 40 + 10);
                        return (
                          <td key={s.key} className="px-5 py-3">
                            <span
                              className={`inline-block text-xs font-medium px-2 py-1 rounded ${s.barColor} text-white`}
                              style={{ opacity: intensity / 50 }}
                            >
                              {val}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-5 py-3 text-sm text-zinc-400">{m.lost}</td>
                      <td className="px-5 py-3">
                        <span className={`text-sm font-medium ${conv >= 20 ? "text-green-400" : conv >= 10 ? "text-yellow-400" : "text-zinc-400"}`}>
                          {conv}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {funnel.length > 0 && (
                <tfoot>
                  {(() => {
                    const totals = funnel.reduce(
                      (acc, m) => ({
                        total_leads: acc.total_leads + m.total_leads,
                        contacted: acc.contacted + m.contacted,
                        trial_booked: acc.trial_booked + m.trial_booked,
                        trial_attended: acc.trial_attended + m.trial_attended,
                        signed_up: acc.signed_up + m.signed_up,
                        lost: acc.lost + m.lost,
                      }),
                      { total_leads: 0, contacted: 0, trial_booked: 0, trial_attended: 0, signed_up: 0, lost: 0 }
                    );
                    const overallConv = totals.total_leads > 0 ? Math.round((totals.signed_up / totals.total_leads) * 100) : 0;
                    return (
                      <tr className="border-t-2 border-border bg-background/50">
                        <td className="px-5 py-3 text-sm font-bold">Total</td>
                        {funnelStages.map((s) => (
                          <td key={s.key} className={`px-5 py-3 text-sm font-bold ${s.color}`}>{totals[s.key]}</td>
                        ))}
                        <td className="px-5 py-3 text-sm font-bold text-zinc-400">{totals.lost}</td>
                        <td className="px-5 py-3">
                          <span className={`text-sm font-bold ${overallConv >= 20 ? "text-green-400" : overallConv >= 10 ? "text-yellow-400" : "text-zinc-400"}`}>
                            {overallConv}%
                          </span>
                        </td>
                      </tr>
                    );
                  })()}
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
