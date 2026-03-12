"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface Note {
  id: number;
  content: string;
  tags: string | null;
  is_used: number;
  created_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: number;
  started_at: string;
  message_count: number;
  first_message: string | null;
  summary: string | null;
}

interface Insight {
  id: number;
  category: string;
  content: string;
  confidence: string;
  source_quote: string | null;
  session_date: string | null;
  created_at: string;
}

interface InsightSummary {
  category: string;
  count: number;
}

type ViewMode = "chat" | "profile" | "history";

const CATEGORY_LABELS: Record<string, string> = {
  voice: "Communication Style",
  values: "Core Values",
  stories: "Stories & Anecdotes",
  teaching_philosophy: "Teaching Philosophy",
  business_mindset: "Business Mindset",
  personality: "Personality",
  marketing_angles: "Marketing Angles",
};

const CATEGORY_ICONS: Record<string, string> = {
  voice: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
  values: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  stories: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
  teaching_philosophy: "M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342",
  business_mindset: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
  personality: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z",
  marketing_angles: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
};

export default function PlannerPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [unusedNotes, setUnusedNotes] = useState<Note[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [error, setError] = useState<string | null>(null);

  // Profile state
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightSummary, setInsightSummary] = useState<InsightSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // History state
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceInput(
    useCallback((text: string) => setInput(text), [])
  );

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((notes: Note[]) => setUnusedNotes(notes.filter((n: Note) => !n.is_used)));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadProfile = useCallback(() => {
    fetch("/api/planner/profile")
      .then((r) => r.json())
      .then((data) => {
        setInsights(data.insights || []);
        setInsightSummary(data.summary || []);
      });
  }, []);

  const loadHistory = useCallback(() => {
    fetch("/api/planner/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []));
  }, []);

  useEffect(() => {
    if (viewMode === "profile") loadProfile();
    if (viewMode === "history") loadHistory();
  }, [viewMode, loadProfile, loadHistory]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    setError(null);

    const userMsg: Message = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/planner/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setSending(false);
        return;
      }

      if (!sessionId) setSessionId(data.sessionId);
      setMessages([...updated, { role: "assistant", content: data.response }]);
    } catch {
      setError("Failed to connect to the server. Check your connection.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startFromNote = (note: Note) => {
    setShowNotes(false);
    sendMessage(`I want to plan a class based on this note: "${note.content}"`);
  };

  const newSession = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
    setError(null);
  };

  const loadSession = async (sid: number) => {
    const res = await fetch(`/api/planner/sessions?sessionId=${sid}`);
    const data = await res.json();
    if (data.messages) {
      setMessages(
        data.messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
      setSessionId(sid);
      setViewMode("chat");
    }
  };

  const removeInsight = async (id: number) => {
    await fetch(`/api/planner/profile?id=${id}`, { method: "DELETE" });
    loadProfile();
  };

  const totalInsights = insightSummary.reduce((sum, s) => sum + s.count, 0);
  const filteredInsights = selectedCategory
    ? insights.filter((i) => i.category === selectedCategory)
    : insights;

  function renderContent(text: string) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const content = part.replace(/```\w*\n?/, "").replace(/```$/, "");
        return (
          <div key={i} className="my-3 bg-background border border-accent/20 rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-accent/5 border-b border-accent/20 flex items-center justify-between">
              <span className="text-[10px] text-accent font-medium uppercase tracking-wider">Lesson Plan</span>
              <button
                onClick={() => navigator.clipboard.writeText(content.trim())}
                className="text-[10px] text-muted hover:text-accent transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap font-mono">{content.trim()}</pre>
          </div>
        );
      }
      const lines = part.split("\n");
      return (
        <div key={i}>
          {lines.map((line, j) => {
            if (!line.trim()) return <div key={j} className="h-2" />;
            // Escape HTML first, then apply safe formatting
            let rendered = line
              .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.+?)\*/g, '<em>$1</em>');
            if (line.trim().startsWith("- ")) {
              return (
                <div key={j} className="flex gap-2 ml-2 my-0.5">
                  <span className="text-accent mt-0.5 shrink-0">-</span>
                  <span dangerouslySetInnerHTML={{ __html: rendered.replace(/^-\s*/, "") }} />
                </div>
              );
            }
            const numMatch = line.match(/^(\d+)\.\s/);
            if (numMatch) {
              return (
                <div key={j} className="flex gap-2 ml-2 my-0.5">
                  <span className="text-accent mt-0.5 shrink-0 font-mono text-xs">{numMatch[1]}.</span>
                  <span dangerouslySetInnerHTML={{ __html: rendered.replace(/^\d+\.\s*/, "") }} />
                </div>
              );
            }
            return <p key={j} className="my-0.5" dangerouslySetInnerHTML={{ __html: rendered }} />;
          })}
        </div>
      );
    });
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col" style={{ height: "calc(100vh - 80px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Mat Planner</h1>
          <p className="text-sm text-muted mt-0.5">
            {viewMode === "chat" && "AI-powered planning — just talk through what you want"}
            {viewMode === "profile" && `${totalInsights} insights learned about Rodrigo's style`}
            {viewMode === "history" && `${sessions.length} past conversations`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* View mode tabs */}
          {(["chat", "profile", "history"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === mode
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              {mode === "chat" && "Chat"}
              {mode === "profile" && "Profile"}
              {mode === "history" && "History"}
            </button>
          ))}

          {viewMode === "chat" && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <button
                onClick={() => setShowNotes(!showNotes)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showNotes ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground hover:bg-card-hover"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
                Notes ({unusedNotes.length})
              </button>
              {messages.length > 0 && (
                <button
                  onClick={newSession}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors"
                >
                  New Session
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ==================== PROFILE VIEW ==================== */}
      {viewMode === "profile" && (
        <div className="flex-1 overflow-y-auto">
          {totalInsights === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold mb-2">No insights yet</h2>
              <p className="text-sm text-muted max-w-sm">
                As you chat with the AI, it will naturally learn about Rodrigo's communication style,
                values, stories, and personality. Start a conversation to begin building the profile.
              </p>
              <button
                onClick={() => setViewMode("chat")}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-dim transition-colors"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Category filter chips */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    !selectedCategory ? "bg-accent text-white" : "bg-card border border-border text-muted hover:text-foreground"
                  }`}
                >
                  All ({totalInsights})
                </button>
                {insightSummary.map((s) => (
                  <button
                    key={s.category}
                    onClick={() => setSelectedCategory(selectedCategory === s.category ? null : s.category)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedCategory === s.category
                        ? "bg-accent text-white"
                        : "bg-card border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {CATEGORY_LABELS[s.category] || s.category} ({s.count})
                  </button>
                ))}
              </div>

              {/* Insight cards */}
              <div className="space-y-3">
                {filteredInsights.map((insight) => (
                  <div key={insight.id} className="bg-card border border-border rounded-xl p-4 group">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={CATEGORY_ICONS[insight.category] || CATEGORY_ICONS.personality} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-medium text-accent uppercase tracking-wider">
                            {CATEGORY_LABELS[insight.category] || insight.category}
                          </span>
                          <span className="text-[10px] text-muted">
                            {insight.confidence === "confirmed" && " (confirmed)"}
                            {insight.confidence === "strong" && " (strong)"}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{insight.content}</p>
                        {insight.source_quote && (
                          <p className="text-xs text-muted mt-2 italic border-l-2 border-accent/20 pl-3">
                            &ldquo;{insight.source_quote}&rdquo;
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {insight.session_date && (
                            <span className="text-[10px] text-muted">
                              {new Date(insight.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                          <button
                            onClick={() => removeInsight(insight.id)}
                            className="text-[10px] text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== HISTORY VIEW ==================== */}
      {viewMode === "history" && (
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <h2 className="text-lg font-semibold mb-2">No conversations yet</h2>
              <p className="text-sm text-muted">Start chatting to see your conversation history here.</p>
              <button
                onClick={() => setViewMode("chat")}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-dim transition-colors"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted">
                      {new Date(session.started_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                      })}
                    </span>
                    <span className="text-[10px] text-muted">{session.message_count} messages</span>
                  </div>
                  <p className="text-sm truncate">
                    {session.first_message || session.summary || "Conversation"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== CHAT VIEW ==================== */}
      {viewMode === "chat" && (
        <>
          {/* Notes panel */}
          {showNotes && unusedNotes.length > 0 && (
            <div className="bg-card border border-accent/20 rounded-xl p-4 mb-4 shrink-0">
              <p className="text-xs text-accent font-medium mb-2">Your saved notes — click one to start planning from it</p>
              <div className="space-y-2">
                {unusedNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => startFromNote(note)}
                    className="w-full text-left bg-background border border-border rounded-lg px-3 py-2 hover:border-accent/30 transition-colors"
                  >
                    <p className="text-sm">{note.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted">
                        {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      {note.tags && (
                        <div className="flex gap-1">
                          {note.tags.split(",").slice(0, 3).map((t) => (
                            <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent">{t.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto bg-card rounded-xl border border-border mb-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold mb-2">What&apos;s on your mind, Professor?</h2>
                <p className="text-sm text-muted mb-6 max-w-sm">Plan lessons, think through ideas, talk business — I&apos;m here to help and learn your style.</p>

                <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                  {[
                    { label: "Plan a class", prompt: "I need to plan tonight's class — adult gi, all levels" },
                    { label: "I'm stuck, give me ideas", prompt: "I'm stuck on what to teach this week, give me some ideas" },
                    { label: "Plan next 4 weeks", prompt: "Help me plan the next 4 weeks of curriculum" },
                    { label: "Talk marketing", prompt: "I want to think through our marketing — what makes Supremacy different from other gyms around here" },
                    { label: "Build a curriculum", prompt: "I want to build a structured curriculum program that I can own and eventually sell" },
                  ].map(({ label, prompt }, idx) => (
                    <button
                      key={label}
                      onClick={() => sendMessage(prompt)}
                      className={`bg-background border border-border rounded-lg px-4 py-3 text-sm text-left hover:border-accent/30 hover:bg-card-hover transition-colors ${idx === 4 ? "col-span-2" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {unusedNotes.length > 0 && (
                  <p className="text-xs text-accent mt-6">
                    You have {unusedNotes.length} saved note{unusedNotes.length > 1 ? "s" : ""} — click &quot;Notes&quot; above to plan from them
                  </p>
                )}
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                        AI
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent/10 text-foreground"
                        : "bg-background border border-border"
                    }`}>
                      {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                      AI
                    </div>
                    <div className="bg-background border border-border rounded-xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                        <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-2 mb-3 text-sm shrink-0">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="shrink-0 mb-2">
            {/* Voice recording indicator */}
            {voice.isListening && (
              <div className="flex items-center gap-2 px-4 py-2 mb-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-400 font-medium">Listening... tap mic or Send when done</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              {/* Mic button */}
              {voice.isSupported && (
                <button
                  onClick={voice.toggle}
                  className={`p-3 rounded-xl transition-all shrink-0 ${
                    voice.isListening
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/25 scale-105"
                      : "bg-card border border-border text-muted hover:text-foreground hover:border-accent/30"
                  }`}
                  title={voice.isListening ? "Stop recording" : "Start voice input"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {voice.isListening ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    )}
                  </svg>
                </button>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={voice.isListening ? "Speaking..." : "Tell me what you want to teach, or just talk..."}
                rows={1}
                className={`flex-1 bg-card border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-accent/50 placeholder:text-muted/50 max-h-[120px] ${
                  voice.isListening ? "border-red-500/30" : "border-border"
                }`}
                style={{ minHeight: "48px" }}
              />
              <button
                onClick={() => {
                  if (voice.isListening) voice.stop();
                  handleSend();
                }}
                disabled={!input.trim() || sending}
                className="px-5 py-3 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
