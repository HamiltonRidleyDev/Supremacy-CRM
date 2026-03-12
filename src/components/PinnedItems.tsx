"use client";

import { useState, useEffect } from "react";

interface PinnedItem {
  id: number;
  user_message: string;
  assistant_message: string;
  context_summary: string | null;
  pinned_by: string;
  status: string;
  created_at: string;
  chat_source: string | null;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function PinnedItems() {
  const [items, setItems] = useState<PinnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/pins")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id: number, status: "done" | "dismissed") => {
    try {
      await fetch("/api/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {}
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <h3 className="text-sm font-semibold">Pinned from Quick</h3>
        <span className="text-[10px] text-muted bg-background px-1.5 py-0.5 rounded">{items.length}</span>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-background border border-border rounded-lg p-3">
            {/* Context summary (the one-liner) */}
            {item.context_summary && (
              <p className="text-xs font-medium leading-relaxed mb-1.5">{item.context_summary}</p>
            )}

            {/* Original question */}
            <p className="text-[10px] text-muted leading-relaxed">
              <span className="text-muted/60">Asked:</span> {item.user_message.length > 100 ? item.user_message.slice(0, 100) + "..." : item.user_message}
            </p>

            {/* Expandable full response */}
            {expanded === item.id && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
                  {item.assistant_message}
                </p>
              </div>
            )}

            {/* Footer: actions + metadata */}
            <div className="flex items-center justify-between mt-2 pt-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted">{timeAgo(item.created_at)}</span>
                <span className="text-[10px] text-muted/50">{item.pinned_by}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  className="text-[10px] text-muted hover:text-foreground px-1.5 py-0.5 rounded hover:bg-card-hover transition-colors"
                >
                  {expanded === item.id ? "Collapse" : "Details"}
                </button>
                <button
                  onClick={() => updateStatus(item.id, "done")}
                  className="text-[10px] text-success hover:text-success/80 px-1.5 py-0.5 rounded hover:bg-success/10 transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={() => updateStatus(item.id, "dismissed")}
                  className="text-[10px] text-muted hover:text-danger px-1.5 py-0.5 rounded hover:bg-danger/10 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
