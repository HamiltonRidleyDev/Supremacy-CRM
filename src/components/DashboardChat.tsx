"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const starters = [
  "How's the gym doing overall?",
  "Who should I call this week?",
  "What's my biggest problem right now?",
  "Help me plan to hit 300 members",
];

// Sanitize HTML to prevent XSS — strip all tags except safe formatting
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/<(?!\/?(?:strong|em|b|i|br|p|ul|ol|li|span)\b)[^>]*>/gi, "");
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    // Bold — apply sanitization after formatting
    let formatted = line
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
    formatted = sanitizeHtml(formatted);
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

export default function DashboardChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, isSupported, toggle: toggleVoice } = useVoiceInput(
    useCallback((text: string) => setInput(text), [])
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Request geolocation once on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silently ignore denial
      );
    }
  }, []);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setSending(true);

    try {
      const res = await fetch("/api/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId, ...(!sessionId && location ? { location } : {}) }),
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

  const newChat = () => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          isOpen
            ? "bg-card border border-border hover:bg-card-hover"
            : "bg-accent hover:bg-accent/90 text-white"
        }`}
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{ width: "min(420px, calc(100vw - 2rem))", height: "min(560px, calc(100vh - 8rem))" }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-sm font-semibold">Ask about your data</h3>
              <p className="text-[10px] text-muted">AI advisor with full access to your gym metrics</p>
            </div>
            <button
              onClick={newChat}
              className="text-[10px] text-muted hover:text-foreground px-2 py-1 rounded border border-border hover:border-accent/40 transition-colors"
            >
              New chat
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !sending && (
              <div className="space-y-3">
                <p className="text-xs text-muted text-center mt-4 mb-2">Try asking:</p>
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border hover:border-accent/40 hover:bg-card-hover transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-accent text-white"
                      : "bg-background border border-border"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="space-y-1">{renderMarkdown(m.content)}</div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-background border border-border rounded-lg px-3 py-2">
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

          {/* Input */}
          <div className="p-3 border-t border-border flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your gym..."
                rows={1}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-accent/50 max-h-20"
                style={{ minHeight: "36px" }}
              />
              {isSupported && (
                <div className="relative flex-shrink-0">
                  {/* Tooltip hint */}
                  {!isListening && messages.length === 0 && !input && (
                    <div className="absolute bottom-full mb-2 right-0 bg-[#1e293b] border border-[#334155] rounded-lg px-2.5 py-1.5 text-[10px] text-white whitespace-nowrap shadow-lg pointer-events-none">
                      Tap to speak instead of typing
                      <div className="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#334155]" />
                    </div>
                  )}
                  <button
                    onClick={toggleVoice}
                    className={`p-2 rounded-lg border transition-colors ${
                      isListening
                        ? "border-success bg-success/10 text-success"
                        : "border-border hover:border-accent/40 text-muted hover:text-foreground"
                    }`}
                  >
                    {isListening ? (
                      <div className="flex items-center gap-0.5 h-3.5">
                        <div className="w-0.5 bg-success rounded-full animate-pulse" style={{ height: "40%", animationDelay: "0ms" }} />
                        <div className="w-0.5 bg-success rounded-full animate-pulse" style={{ height: "80%", animationDelay: "150ms" }} />
                        <div className="w-0.5 bg-success rounded-full animate-pulse" style={{ height: "55%", animationDelay: "75ms" }} />
                        <div className="w-0.5 bg-success rounded-full animate-pulse" style={{ height: "100%", animationDelay: "200ms" }} />
                        <div className="w-0.5 bg-success rounded-full animate-pulse" style={{ height: "65%", animationDelay: "100ms" }} />
                      </div>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
              <button
                onClick={() => send()}
                disabled={!input.trim() || sending}
                className="px-2.5 py-2 rounded-lg bg-accent text-white disabled:opacity-30 hover:bg-accent/90 transition-colors flex-shrink-0 flex items-center gap-1.5 text-[10px] font-medium"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
