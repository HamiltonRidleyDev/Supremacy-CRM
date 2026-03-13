"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import DOMPurify from "isomorphic-dompurify";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  savedAsNote?: boolean;
}

const PURIFY_CONFIG = { ALLOWED_TAGS: ["strong", "em", "b", "i"] };

function renderMarkdown(text: string): string {
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
  return DOMPurify.sanitize(formatted, PURIFY_CONFIG);
}

export function QuickStartOverlay({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, isSupported, transcript, toggle, stop } = useVoiceInput((text) => {
    setInput(text);
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          sessionId,
          source: "quick-start",
        }),
      });
      const data = await res.json();
      if (data.sessionId) setSessionId(data.sessionId);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || data.error || "No response",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Network error. Try again." },
      ]);
    } finally {
      setSending(false);
    }
  }, [sending, sessionId]);

  const handleVoiceDone = useCallback(() => {
    stop();
    if (transcript.trim()) {
      sendMessage(transcript.trim());
    }
  }, [stop, transcript, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const saveAsNote = async (content: string, msgId: string) => {
    setSavingNote(msgId);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, tags: "quick-start" }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, savedAsNote: true } : m))
      );
    } catch {
      // silent fail
    } finally {
      setSavingNote(null);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0c0c0f] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" width={32} height={32} className="rounded-full" />
          <div>
            <h1 className="text-sm font-bold">
              <span className="text-[#c73030]">SUPREMACY</span>
              <span className="text-muted ml-1.5 font-normal text-xs">Quick Start</span>
            </h1>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasMessages && !isListening && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">What&apos;s on your mind?</p>
              <p className="text-sm text-muted max-w-[280px]">
                Tap the mic to talk, or type below. I have full context on your gym data.
              </p>
            </div>

            {/* Big mic button */}
            {isSupported && (
              <button
                onClick={toggle}
                className="w-24 h-24 rounded-full bg-accent/15 hover:bg-accent/25 border-2 border-accent/30 flex items-center justify-center transition-all active:scale-95"
              >
                <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {[
                "How are we doing this month?",
                "Who's at risk of churning?",
                "What should I focus on today?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-muted hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listening state */}
        {isListening && !hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <button
              onClick={handleVoiceDone}
              className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center animate-pulse transition-all active:scale-95"
            >
              <svg className="w-10 h-10 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
            <div className="space-y-2">
              <p className="text-sm text-red-400 font-medium">Listening...</p>
              {transcript && (
                <p className="text-sm text-foreground max-w-sm">{transcript}</p>
              )}
              <p className="text-xs text-muted">Tap to send</p>
            </div>
          </div>
        )}

        {/* Message thread */}
        {hasMessages && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent text-white rounded-br-md"
                      : "bg-white/5 text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  ) : (
                    msg.content
                  )}
                  {msg.role === "assistant" && (
                    <div className="mt-2 flex items-center gap-2">
                      {msg.savedAsNote ? (
                        <span className="text-[10px] text-green-400">Saved to notes</span>
                      ) : (
                        <button
                          onClick={() => saveAsNote(msg.content, msg.id)}
                          disabled={savingNote === msg.id}
                          className="text-[10px] text-muted hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          {savingNote === msg.id ? "Saving..." : "Save note"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 px-4 py-3 safe-area-bottom">
        {/* Listening indicator when in conversation */}
        {isListening && hasMessages && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400">Listening...</span>
            {transcript && <span className="text-xs text-muted truncate">{transcript}</span>}
            <button
              onClick={handleVoiceDone}
              className="ml-auto text-xs text-accent hover:text-accent/80"
            >
              Send
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          {isSupported && (
            <button
              onClick={isListening ? handleVoiceDone : toggle}
              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isListening
                  ? "bg-red-500/20 text-red-400"
                  : "bg-white/5 text-muted hover:text-foreground hover:bg-white/10"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your gym..."
            rows={1}
            className="flex-1 bg-white/5 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/50 resize-none"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="shrink-0 w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-30 transition-opacity"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
