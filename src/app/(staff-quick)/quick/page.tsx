"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useVoiceInput } from "@/hooks/useVoiceInput";

// ── Types ──────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  pinned?: boolean;
}

interface Note {
  id: number;
  content: string;
  tags: string | null;
  created_at: string;
}

type Mode = "ask" | "notes";

// ── Voice trigger phrases for pinning ──────────────────

const PIN_TRIGGERS = /^(save that|pin that|keep that)\.?$/i;

// ── Markdown renderer (safe) ───────────────────────────

const PURIFY_CONFIG = { ALLOWED_TAGS: ["strong", "em", "b", "i"] };

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    let formatted = line
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
    formatted = DOMPurify.sanitize(formatted, PURIFY_CONFIG);
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: formatted.slice(2) }} />;
    }
    if (/^\d+\.\s/.test(line)) {
      return <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: formatted.replace(/^\d+\.\s/, "") }} />;
    }
    if (line.trim() === "") return <br key={i} />;
    return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
  });
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

// ── Main Component ─────────────────────────────────────

export default function QuickPage() {
  const [mode, setMode] = useState<Mode>("ask");
  const [input, setInput] = useState("");

  // ── Chat state ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinningIndex, setPinningIndex] = useState<number | null>(null);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Notes state ──
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Pin an assistant message ──
  const pinMessage = async (messageIndex: number) => {
    if (!sessionId || pinningIndex !== null) return;

    const assistantMsg = messages[messageIndex];
    if (assistantMsg.role !== "assistant" || assistantMsg.pinned) return;

    // Find the user message that preceded this response
    let userMsg = "";
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMsg = messages[i].content;
        break;
      }
    }

    setPinningIndex(messageIndex);
    try {
      const res = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage: userMsg,
          assistantMessage: assistantMsg.content,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setMessages((prev) =>
          prev.map((m, i) => (i === messageIndex ? { ...m, pinned: true } : m))
        );
        setPinFeedback("Pinned!");
        setTimeout(() => setPinFeedback(null), 2000);
      }
    } catch {
      setPinFeedback("Failed to pin");
      setTimeout(() => setPinFeedback(null), 2000);
    } finally {
      setPinningIndex(null);
    }
  };

  // Find the last assistant message index
  const getLastAssistantIndex = (): number => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && !messages[i].pinned) return i;
    }
    return -1;
  };

  // Voice input with pin trigger detection
  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(text);
  }, []);

  const { isListening, isSupported, toggle: toggleVoice } = useVoiceInput(handleVoiceTranscript);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Focus input on mode change
  useEffect(() => {
    if (inputRef.current && !isListening) {
      inputRef.current.focus();
    }
  }, [mode, isListening]);

  // Load notes when switching to notes tab
  useEffect(() => {
    if (mode === "notes" && !notesLoaded) {
      fetch("/api/notes")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setNotes(data);
          setNotesLoaded(true);
        })
        .catch(() => {});
    }
  }, [mode, notesLoaded]);

  // ── Chat: send message (with pin trigger interception) ──
  const sendChat = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    // Check for voice pin trigger
    if (PIN_TRIGGERS.test(msg) && mode === "ask") {
      setInput("");
      const idx = getLastAssistantIndex();
      if (idx >= 0) {
        pinMessage(idx);
      } else {
        setPinFeedback("Nothing to pin yet");
        setTimeout(() => setPinFeedback(null), 2000);
      }
      return;
    }

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setSending(true);

    try {
      const res = await fetch("/api/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
        if (data.sessionId) setSessionId(data.sessionId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setSending(false);
    }
  };

  // ── Notes: save ──
  const saveNote = async () => {
    const content = input.trim();
    if (!content || saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, tags: "" }),
      });
      const data = await res.json();
      if (data.id) {
        setNotes((prev) => [
          { id: Number(data.id), content, tags: null, created_at: new Date().toISOString() },
          ...prev,
        ]);
        setInput("");
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
      }
    } catch {
      setError("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  // ── Notes: delete ──
  const deleteNote = async (id: number) => {
    try {
      await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  // ── Keyboard: Enter to send/save ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (mode === "ask") sendChat();
      else saveNote();
    }
  };

  // ── Action button handler ──
  const handleAction = () => {
    if (mode === "ask") sendChat();
    else saveNote();
  };

  const newChat = () => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setInput("");
  };

  const chatStarters = [
    "How's the gym doing?",
    "Who should I follow up with?",
    "What's my biggest problem?",
    "Summarize this week",
  ];

  return (
    <div className="fixed inset-0 bg-background flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">Supremacy Quick</span>
          </div>
          <div className="flex items-center gap-2">
            {pinFeedback && (
              <span className="text-[10px] text-success font-medium animate-pulse">{pinFeedback}</span>
            )}
            {mode === "ask" && messages.length > 0 && (
              <button
                onClick={newChat}
                className="text-[10px] text-muted hover:text-foreground px-2 py-1 rounded border border-border hover:border-accent/40 transition-colors"
              >
                New chat
              </button>
            )}
          </div>
        </div>

        {/* ── Mode tabs ── */}
        <div className="flex gap-1 bg-card rounded-lg p-0.5">
          <button
            onClick={() => setMode("ask")}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
              mode === "ask"
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Ask
            </span>
          </button>
          <button
            onClick={() => setMode("notes")}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
              mode === "notes"
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Notes
            </span>
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto px-4">
        {mode === "ask" ? (
          /* ── Chat messages ── */
          <div className="space-y-3 py-2">
            {messages.length === 0 && !sending && (
              <div className="space-y-2 pt-6">
                <p className="text-xs text-muted text-center mb-3">Ask anything about your gym</p>
                {chatStarters.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendChat(s)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border hover:border-accent/40 hover:bg-card-hover transition-colors"
                  >
                    {s}
                  </button>
                ))}
                <p className="text-[10px] text-muted/60 text-center pt-3">
                  Say &quot;save that&quot; to pin any response for later
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent text-white"
                        : m.pinned
                        ? "bg-card border-2 border-warning/40"
                        : "bg-card border border-border"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="space-y-1">{renderMarkdown(m.content)}</div>
                    ) : (
                      m.content
                    )}
                  </div>
                  {/* Pin button for assistant messages */}
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mt-1 ml-1">
                      {m.pinned ? (
                        <span className="text-[10px] text-warning/70 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 4h2a1 1 0 011 1v1h-6V5a1 1 0 011-1h2zM5 8h14l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 8zm4.5 3a.5.5 0 00-1 0v7a.5.5 0 001 0v-7zm3 0a.5.5 0 00-1 0v7a.5.5 0 001 0v-7zm3 0a.5.5 0 00-1 0v7a.5.5 0 001 0v-7z" />
                          </svg>
                          Pinned
                        </span>
                      ) : (
                        <button
                          onClick={() => pinMessage(i)}
                          disabled={pinningIndex !== null}
                          className="text-[10px] text-muted/50 hover:text-warning transition-colors flex items-center gap-1 p-0.5"
                        >
                          {pinningIndex === i ? (
                            <div className="w-3 h-3 border border-warning/50 border-t-warning rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          )}
                          Save
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</div>
            )}

            <div ref={messagesEndRef} />
          </div>
        ) : (
          /* ── Notes list ── */
          <div className="space-y-2 py-2">
            {savedFeedback && (
              <div className="text-xs text-success bg-success/10 rounded-lg px-3 py-2 text-center animate-pulse">
                Note saved
              </div>
            )}

            {notes.length === 0 && notesLoaded && (
              <p className="text-xs text-muted text-center pt-8">
                No notes yet. Tap the mic and start talking.
              </p>
            )}

            {notes.map((note) => (
              <div key={note.id} className="bg-card border border-border rounded-lg px-3 py-2.5 group">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xs leading-relaxed flex-1 whitespace-pre-wrap">{note.content}</p>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-muted">{timeAgo(note.created_at)}</span>
                  {note.tags && (
                    <span className="text-[10px] text-accent/70">{note.tags}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="flex-shrink-0 p-3 border-t border-border bg-background">
        <div className="flex items-end gap-2">
          {/* Voice button — large and prominent */}
          {isSupported && (
            <button
              onClick={toggleVoice}
              className={`flex-shrink-0 rounded-full transition-all ${
                isListening
                  ? "w-12 h-12 bg-success/15 border-2 border-success text-success shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                  : "w-12 h-12 bg-card border border-border text-muted hover:text-foreground hover:border-accent/40"
              } flex items-center justify-center`}
            >
              {isListening ? (
                <div className="flex items-center gap-[3px] h-5">
                  <div className="w-[3px] bg-success rounded-full animate-pulse" style={{ height: "35%", animationDelay: "0ms" }} />
                  <div className="w-[3px] bg-success rounded-full animate-pulse" style={{ height: "75%", animationDelay: "150ms" }} />
                  <div className="w-[3px] bg-success rounded-full animate-pulse" style={{ height: "50%", animationDelay: "75ms" }} />
                  <div className="w-[3px] bg-success rounded-full animate-pulse" style={{ height: "100%", animationDelay: "200ms" }} />
                  <div className="w-[3px] bg-success rounded-full animate-pulse" style={{ height: "60%", animationDelay: "100ms" }} />
                </div>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          )}

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? "Listening..."
                : mode === "ask"
                ? "Ask anything..."
                : "Capture a thought..."
            }
            rows={1}
            className="flex-1 bg-card border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-accent/50 max-h-24"
            style={{ minHeight: "44px" }}
          />

          {/* Send / Save button */}
          <button
            onClick={handleAction}
            disabled={!input.trim() || sending || saving}
            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-30 ${
              mode === "ask"
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-success text-white hover:bg-success/90"
            }`}
          >
            {sending || saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === "ask" ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Listening indicator */}
        {isListening && (
          <div className="mt-2 text-center">
            <span className="text-[10px] text-success font-medium tracking-wide uppercase animate-pulse">
              Listening... tap mic to stop
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
