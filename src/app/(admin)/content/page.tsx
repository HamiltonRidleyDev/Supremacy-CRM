"use client";

import { useEffect, useState, useCallback } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface ContentPiece {
  id: number;
  content_type: string;
  status: string;
  body: string;
  image_prompt: string | null;
  source_type: string | null;
  revision_notes: string | null;
  revision_count: number;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  version_count: number;
}

interface QueueStat {
  status: string;
  count: number;
}

interface InsightSummary {
  category: string;
  count: number;
}

type ContentType =
  | "social_post"
  | "google_business"
  | "blog_snippet"
  | "lead_email"
  | "website_copy"
  | "competitor_capture";

type ViewMode = "create" | "queue";

const CONTENT_TYPES: { key: ContentType; label: string; description: string; icon: string }[] = [
  { key: "social_post", label: "Social Post", description: "Instagram / Facebook", icon: "M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" },
  { key: "google_business", label: "Google Business", description: "Local SEO post", icon: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" },
  { key: "blog_snippet", label: "Blog / Article", description: "Website SEO content", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  { key: "lead_email", label: "Lead Follow-up", description: "Email or text to prospects", icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" },
  { key: "website_copy", label: "Website Copy", description: "About, landing page, classes", icon: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" },
  { key: "competitor_capture", label: "Competitor Capture", description: "Win displaced students", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
];

const SOURCE_OPTIONS = [
  { key: "topic", label: "From a topic", placeholder: "e.g., Why we don't do contracts, What makes our kids program different..." },
  { key: "profile", label: "From Rodrigo's profile", placeholder: "Use what the AI has learned about Rodrigo" },
  { key: "custom", label: "Custom brief", placeholder: "Tell the AI exactly what you want..." },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  revision: { label: "Needs Revision", color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  approved: { label: "Approved", color: "text-green-400 bg-green-400/10 border-green-400/20" },
  published: { label: "Published", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  archived: { label: "Archived", color: "text-muted bg-muted/10 border-muted/20" },
};

export default function ContentPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("create");
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [sourceMode, setSourceMode] = useState("topic");
  const [sourceText, setSourceText] = useState("");
  const [insightSummary, setInsightSummary] = useState<InsightSummary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Queue state
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStat[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedPiece, setExpandedPiece] = useState<number | null>(null);
  const [editingPiece, setEditingPiece] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [revisionInput, setRevisionInput] = useState("");
  const [revising, setRevising] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const voice = useVoiceInput(
    useCallback((text: string) => {
      if (revising) {
        setRevisionInput(text);
      } else {
        setSourceText(text);
      }
    }, [revising])
  );

  useEffect(() => {
    fetch("/api/planner/profile")
      .then((r) => r.json())
      .then((data) => setInsightSummary(data.summary || []));
  }, []);

  const loadQueue = useCallback(() => {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/content/pieces${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPieces(data.pieces || []);
        setQueueStats(data.stats || []);
      });
  }, [statusFilter]);

  useEffect(() => {
    if (viewMode === "queue") loadQueue();
  }, [viewMode, loadQueue]);

  const totalInsights = insightSummary.reduce((s, i) => s + i.count, 0);

  const generate = async () => {
    if (!selectedType) return;
    setGenerating(true);
    setError(null);

    let source = "";
    if (sourceMode === "topic" || sourceMode === "custom") {
      source = sourceText;
    } else if (sourceMode === "profile") {
      source = "Use the instructor profile insights to generate content that captures Rodrigo's authentic voice, values, and story.";
    }

    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: selectedType,
          source: source || undefined,
          customPrompt: sourceMode === "custom" ? sourceText : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      // Switch to queue view, expand the new piece
      setViewMode("queue");
      setExpandedPiece(data.id);
      setStatusFilter(null);
    } catch {
      setError("Failed to connect. Check your connection and API key.");
    } finally {
      setGenerating(false);
    }
  };

  const requestRevision = async (piece: ContentPiece) => {
    if (!revisionInput.trim()) return;
    setRevising(piece.id);
    setError(null);

    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceId: piece.id,
          revisionNotes: revisionInput.trim(),
          contentType: piece.content_type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Revision failed");
        return;
      }

      setRevisionInput("");
      loadQueue();
    } catch {
      setError("Revision failed. Check connection.");
    } finally {
      setRevising(null);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch("/api/content/pieces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadQueue();
  };

  const saveEdit = async (id: number) => {
    await fetch("/api/content/pieces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, newBody: editBody }),
    });
    setEditingPiece(null);
    loadQueue();
  };

  const copyContent = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const typeLabel = (key: string) =>
    CONTENT_TYPES.find((t) => t.key === key)?.label || key;

  const totalPieces = queueStats.reduce((s, q) => s + q.count, 0);
  const approvedCount = queueStats.find((q) => q.status === "approved")?.count || 0;
  const draftCount = queueStats.find((q) => q.status === "draft")?.count || 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Content Studio</h1>
          <p className="text-sm text-muted mt-1">
            {viewMode === "create" && (
              <>Generate marketing content in Rodrigo&apos;s voice
              {totalInsights > 0 && <span className="text-accent ml-1">— {totalInsights} profile insights</span>}</>
            )}
            {viewMode === "queue" && (
              <>{totalPieces} pieces — {approvedCount} ready to post, {draftCount} need review</>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {(["create", "queue"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === mode
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              {mode === "create" && "Create"}
              {mode === "queue" && `Queue${totalPieces > 0 ? ` (${totalPieces})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* ==================== CREATE VIEW ==================== */}
      {viewMode === "create" && (
        <div className="bg-card border border-border rounded-xl p-5">
          {/* Content Type */}
          <div className="mb-5">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">What do you want to create?</p>
            <div className="grid grid-cols-3 gap-2">
              {CONTENT_TYPES.map(({ key, label, description, icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    selectedType === key
                      ? "bg-accent/15 border-accent/40 border ring-1 ring-accent/20"
                      : "bg-background border border-border hover:border-accent/30"
                  }`}
                >
                  <svg className={`w-5 h-5 shrink-0 ${selectedType === key ? "text-accent" : "text-muted"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${selectedType === key ? "text-accent" : ""}`}>{label}</p>
                    <p className="text-[10px] text-muted">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Source */}
          {selectedType && (
            <div className="mb-5">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Based on?</p>
              <div className="flex gap-2 mb-3">
                {SOURCE_OPTIONS.map(({ key, label }) => (
                  <button key={key} onClick={() => { setSourceMode(key); setSourceText(""); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      sourceMode === key ? "bg-accent text-white" : "bg-background border border-border text-muted hover:text-foreground"
                    }`}
                  >{label}</button>
                ))}
              </div>

              {(sourceMode === "topic" || sourceMode === "custom") && (
                <div className="relative">
                  <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)}
                    placeholder={voice.isListening ? "Speaking..." : SOURCE_OPTIONS.find((s) => s.key === sourceMode)?.placeholder}
                    rows={3}
                    className={`w-full bg-background border rounded-xl px-4 py-3 pr-12 text-sm resize-none focus:outline-none focus:border-accent/50 placeholder:text-muted/50 ${voice.isListening ? "border-red-500/30" : "border-border"}`}
                  />
                  {voice.isSupported && (
                    <button onClick={voice.toggle}
                      className={`absolute right-3 top-3 p-1.5 rounded-lg transition-all ${voice.isListening ? "bg-red-500 text-white" : "text-muted hover:text-accent hover:bg-accent/10"}`}
                      title={voice.isListening ? "Stop" : "Dictate"}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {sourceMode === "profile" && (
                <div className="bg-background border border-border rounded-xl px-4 py-3">
                  {totalInsights > 0 ? (
                    <div>
                      <p className="text-sm mb-2">AI will draw from Rodrigo&apos;s profile:</p>
                      <div className="flex flex-wrap gap-2">
                        {insightSummary.map((s) => (
                          <span key={s.category} className="text-[10px] px-2 py-1 rounded-full bg-accent/10 text-accent">
                            {s.count} {s.category.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted italic">No profile insights yet. Chat in Mat Planner first.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Generate */}
          {selectedType && (
            <button onClick={generate}
              disabled={generating || ((sourceMode === "topic" || sourceMode === "custom") && !sourceText.trim())}
              className="w-full py-3 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating...</>
              ) : (
                <>Generate {typeLabel(selectedType)} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
              )}
            </button>
          )}

          {error && <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-2 text-sm">{error}</div>}
        </div>
      )}

      {/* ==================== QUEUE VIEW ==================== */}
      {viewMode === "queue" && (
        <div>
          {/* Status filter tabs */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => { setStatusFilter(null); loadQueue(); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!statusFilter ? "bg-accent text-white" : "bg-card border border-border text-muted hover:text-foreground"}`}
            >All ({totalPieces})</button>
            {queueStats.map((s) => (
              <button key={s.status} onClick={() => { setStatusFilter(s.status); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s.status ? "bg-accent text-white" : "bg-card border border-border text-muted hover:text-foreground"}`}
              >{STATUS_LABELS[s.status]?.label || s.status} ({s.count})</button>
            ))}
          </div>

          {pieces.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <p className="text-sm">No content {statusFilter ? `with status "${statusFilter}"` : "yet"}</p>
              <button onClick={() => setViewMode("create")} className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-dim transition-colors">
                Create your first piece
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pieces.map((piece) => {
                const isExpanded = expandedPiece === piece.id;
                const isEditing = editingPiece === piece.id;
                const isRevising = revising === piece.id;
                const statusInfo = STATUS_LABELS[piece.status] || STATUS_LABELS.draft;

                return (
                  <div key={piece.id} className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Piece header — always visible */}
                    <button
                      onClick={() => setExpandedPiece(isExpanded ? null : piece.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-card-hover transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <span className="text-xs font-medium text-accent shrink-0">{typeLabel(piece.content_type)}</span>
                        <span className="text-sm truncate text-muted">{piece.body.slice(0, 80)}...</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {piece.revision_count > 0 && (
                          <span className="text-[10px] text-muted">v{piece.revision_count + 1}</span>
                        )}
                        <span className="text-[10px] text-muted">
                          {new Date(piece.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <svg className={`w-4 h-4 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        {/* Content body */}
                        <div className="px-5 py-4">
                          {isEditing ? (
                            <div>
                              <textarea
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                rows={8}
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-accent/50"
                              />
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => saveEdit(piece.id)}
                                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-dim transition-colors">Save</button>
                                <button onClick={() => setEditingPiece(null)}
                                  className="px-4 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{piece.body}</div>
                          )}
                        </div>

                        {/* Photo Direction */}
                        {piece.image_prompt && (
                          <div className="px-5 pb-4">
                            <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                                </svg>
                                <span className="text-[10px] text-accent font-medium uppercase tracking-wider">Photo Direction for Kyle</span>
                              </div>
                              <p className="text-xs leading-relaxed">{piece.image_prompt}</p>
                              <button
                                onClick={() => copyContent(-piece.id, piece.image_prompt!)}
                                className={`mt-2 text-[10px] font-medium transition-colors ${copied === -piece.id ? "text-green-400" : "text-accent hover:text-accent-dim"}`}
                              >
                                {copied === -piece.id ? "Copied!" : "Copy shot list"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Revision notes from last change */}
                        {piece.revision_notes && (
                          <div className="px-5 pb-3">
                            <p className="text-[10px] text-muted">Last revision request: &ldquo;{piece.revision_notes}&rdquo;</p>
                          </div>
                        )}

                        {/* AI Revision input — conversational */}
                        <div className="px-5 pb-4">
                          <div className="relative">
                            <input
                              value={expandedPiece === piece.id ? revisionInput : ""}
                              onChange={(e) => setRevisionInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); requestRevision(piece); } }}
                              placeholder="Tell the AI what to change... (e.g., 'make it shorter', 'more casual', 'mention the kids program')"
                              className={`w-full bg-background border rounded-xl px-4 py-2.5 pr-20 text-sm focus:outline-none focus:border-accent/50 placeholder:text-muted/40 ${voice.isListening && revising === null && expandedPiece === piece.id ? "border-red-500/30" : "border-border"}`}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              {voice.isSupported && (
                                <button onClick={() => { setRevising(null); voice.toggle(); }}
                                  className={`p-1.5 rounded-lg transition-all ${voice.isListening ? "bg-red-500 text-white" : "text-muted hover:text-accent"}`}
                                  title="Dictate revision"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => requestRevision(piece)}
                                disabled={!revisionInput.trim() || isRevising}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-accent text-white hover:bg-accent-dim transition-colors disabled:opacity-30"
                              >
                                {isRevising ? "..." : "Revise"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Action bar */}
                        <div className="px-5 py-3 bg-background/50 border-t border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {/* Status transitions */}
                            {piece.status === "draft" && (
                              <>
                                <button onClick={() => updateStatus(piece.id, "approved")}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors">
                                  Approve
                                </button>
                                <button onClick={() => updateStatus(piece.id, "archived")}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors">
                                  Archive
                                </button>
                              </>
                            )}
                            {piece.status === "revision" && (
                              <button onClick={() => updateStatus(piece.id, "draft")}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors">
                                Back to Draft
                              </button>
                            )}
                            {piece.status === "approved" && (
                              <>
                                <button onClick={() => updateStatus(piece.id, "published")}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors">
                                  Mark Published
                                </button>
                                <button onClick={() => updateStatus(piece.id, "draft")}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors">
                                  Back to Draft
                                </button>
                              </>
                            )}
                            {piece.status === "archived" && (
                              <button onClick={() => updateStatus(piece.id, "draft")}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors">
                                Restore
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingPiece(piece.id); setEditBody(piece.body); }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors">
                              Edit
                            </button>
                            <button onClick={() => copyContent(piece.id, piece.body)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${copied === piece.id ? "bg-green-500/15 text-green-400" : "text-muted hover:text-foreground hover:bg-card-hover"}`}>
                              {copied === piece.id ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-2 text-sm">{error}</div>}
        </div>
      )}
    </div>
  );
}
