"use client";

import { useEffect, useState, useCallback } from "react";

interface AccessRequest {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: string;
  resolved_by: string | null;
  resolved_note: string | null;
  linked_contact_id: number | null;
  created_at: string;
  resolved_at: string | null;
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

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/access-requests");
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolve(id: number, status: string) {
    await fetch("/api/access-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, resolved_note: noteText }),
    });
    setExpandedId(null);
    setNoteText("");
    load();
  }

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Access Requests</h1>
        <p className="text-sm text-muted mt-1">
          Members who tried to log in but their email or phone didn&apos;t match a contact on file.
          Update their contact info in Zivvy/Market Muscles, then re-sync and mark resolved.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted py-12 text-center">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted">No access requests yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                Pending
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
                  {pending.length}
                </span>
              </h2>
              <div className="space-y-2">
                {pending.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    expanded={expandedId === r.id}
                    onToggle={() => {
                      setExpandedId(expandedId === r.id ? null : r.id);
                      setNoteText(r.resolved_note || "");
                    }}
                    noteText={noteText}
                    onNoteChange={setNoteText}
                    onResolve={(status) => resolve(r.id, status)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Resolved */}
          {resolved.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 text-muted">Previously Resolved ({resolved.length})</h2>
              <div className="space-y-2 opacity-60">
                {resolved.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    expanded={expandedId === r.id}
                    onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    noteText={noteText}
                    onNoteChange={setNoteText}
                    onResolve={(status) => resolve(r.id, status)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request: r,
  expanded,
  onToggle,
  noteText,
  onNoteChange,
  onResolve,
}: {
  request: AccessRequest;
  expanded: boolean;
  onToggle: () => void;
  noteText: string;
  onNoteChange: (v: string) => void;
  onResolve: (status: string) => void;
}) {
  const isPending = r.status === "pending";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-card-hover transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">{r.name}</p>
            <div className="flex items-center gap-3 mt-1">
              {r.email && (
                <span className="text-xs text-muted">{r.email}</span>
              )}
              {r.phone && (
                <span className="text-xs text-muted">{r.phone}</span>
              )}
            </div>
            {r.message && (
              <p className="text-xs text-muted mt-2 italic">&ldquo;{r.message}&rdquo;</p>
            )}
          </div>
          <div className="text-right shrink-0 ml-4">
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                isPending
                  ? "bg-amber-500/15 text-amber-400"
                  : r.status === "resolved"
                  ? "bg-success/15 text-success"
                  : "bg-muted/15 text-muted"
              }`}
            >
              {r.status}
            </span>
            <p className="text-[10px] text-muted mt-1">{timeAgo(r.created_at)}</p>
          </div>
        </div>
      </div>

      {expanded && isPending && (
        <div className="border-t border-border p-4 bg-background/50 space-y-3">
          <p className="text-xs text-muted">
            Look up this person in Zivvy or Market Muscles. If you find them, update their email/phone
            so they can log in next time. Then mark this resolved.
          </p>
          <div>
            <label className="text-xs text-muted block mb-1">Resolution note (optional)</label>
            <textarea
              value={noteText}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="e.g., Updated email in Zivvy, re-synced"
              rows={2}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onResolve("resolved")}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-success/15 text-success hover:bg-success/25 transition-colors"
            >
              Mark Resolved
            </button>
            <button
              onClick={() => onResolve("denied")}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {expanded && !isPending && r.resolved_note && (
        <div className="border-t border-border p-4 bg-background/50">
          <p className="text-xs text-muted">
            <span className="font-medium text-foreground">{r.resolved_by}</span>: {r.resolved_note}
          </p>
        </div>
      )}
    </div>
  );
}
