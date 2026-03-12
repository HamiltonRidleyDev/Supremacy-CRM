"use client";

import { useEffect, useState, useCallback } from "react";

interface FeedbackItem {
  id: number;
  page: string;
  tab: string | null;
  user_name: string;
  user_role: string;
  feedback_type: string;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const TYPE_STYLES: Record<string, { label: string; color: string; icon: string }> = {
  bug: { label: "Bug", color: "text-danger bg-danger/10", icon: "🐛" },
  feature: { label: "Idea", color: "text-accent bg-accent/10", icon: "💡" },
  question: { label: "Question", color: "text-warning bg-warning/10", icon: "❓" },
  general: { label: "General", color: "text-muted bg-foreground/5", icon: "💬" },
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "text-accent bg-accent/15" },
  reviewed: { label: "Reviewed", color: "text-warning bg-warning/15" },
  resolved: { label: "Resolved", color: "text-success bg-success/15" },
};

function pageLabel(page: string): string {
  if (page === "/") return "Dashboard";
  return page.replace(/^\//, "").replace(/-/g, " ").replace(/\//g, " > ");
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr + "Z");
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/feedback?status=${filter}`);
    if (res.ok) {
      setItems(await res.json());
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: number, status: string, adminNotes?: string) {
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, admin_notes: adminNotes }),
    });
    load();
    setExpandedId(null);
    setNoteText("");
  }

  const counts = {
    all: items.length,
    new: items.filter((i) => i.status === "new").length,
    reviewed: items.filter((i) => i.status === "reviewed").length,
    resolved: items.filter((i) => i.status === "resolved").length,
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Feedback</h1>
        <p className="text-sm text-muted mt-1">Review feedback from Rodrigo, Kyle, and other users.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-card rounded-lg p-1 w-fit border border-border">
        {(["all", "new", "reviewed", "resolved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              filter === s
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {s} {counts[s] > 0 && <span className="ml-1 opacity-60">({counts[s]})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-muted py-12 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted">
            {filter === "all" ? "No feedback yet. Share the app and feedback will appear here." : `No ${filter} feedback.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const typeInfo = TYPE_STYLES[item.feedback_type] || TYPE_STYLES.general;
            const statusInfo = STATUS_STYLES[item.status] || STATUS_STYLES.new;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-card-hover transition-colors"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : item.id);
                    setNoteText(item.admin_notes || "");
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{typeInfo.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium">{item.user_name}</span>
                        <span className="text-[10px] text-muted capitalize">{item.user_role}</span>
                        <span className="text-[10px] text-muted">&middot;</span>
                        <span className="text-[10px] text-muted">{timeAgo(item.created_at)}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{item.message}</p>
                      <p className="text-[10px] text-muted mt-1.5 capitalize">
                        {pageLabel(item.page)}
                        {item.tab && ` > ${item.tab}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="border-t border-border p-4 bg-background/50 space-y-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Admin Notes</label>
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note (optional)..."
                        rows={2}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      {item.status !== "reviewed" && (
                        <button
                          onClick={() => updateStatus(item.id, "reviewed", noteText)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
                        >
                          Mark Reviewed
                        </button>
                      )}
                      {item.status !== "resolved" && (
                        <button
                          onClick={() => updateStatus(item.id, "resolved", noteText)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-success/15 text-success hover:bg-success/25 transition-colors"
                        >
                          Mark Resolved
                        </button>
                      )}
                      {item.status !== "new" && (
                        <button
                          onClick={() => updateStatus(item.id, "new", noteText)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                    {item.admin_notes && item.admin_notes !== noteText && (
                      <p className="text-xs text-muted italic">
                        Previous note: {item.admin_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
