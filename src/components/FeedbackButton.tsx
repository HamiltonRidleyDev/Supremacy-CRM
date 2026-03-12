"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug", icon: "🐛" },
  { value: "feature", label: "Idea", icon: "💡" },
  { value: "question", label: "Question", icon: "❓" },
  { value: "general", label: "General", icon: "💬" },
];

export function FeedbackButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Derive a human-readable page name
  const pageName = pathname === "/" ? "Dashboard" : pathname.replace(/^\//, "").replace(/-/g, " ").replace(/\//g, " > ");
  const activeTab = searchParams.get("tab");

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      // Small delay so the close animation plays before resetting
      const t = setTimeout(() => {
        setType("general");
        setMessage("");
        setSent(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: pathname,
          tab: activeTab,
          feedback_type: type,
          message: message.trim(),
        }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => setOpen(false), 1500);
      }
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-4 right-4 md:left-64 md:right-auto z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-accent text-white text-xs font-medium shadow-lg hover:bg-accent/90 transition-all hover:scale-105"
        title="Send feedback"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        Feedback
      </button>

      {/* Modal */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 pointer-events-auto">
              {sent ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="font-semibold">Thanks for the feedback!</p>
                  <p className="text-xs text-muted mt-1">Dan will review it shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="p-5 border-b border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">Send Feedback</h3>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="text-muted hover:text-foreground transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Page: <span className="text-foreground capitalize">{pageName}</span>
                      {activeTab && (
                        <> &middot; Tab: <span className="text-foreground capitalize">{activeTab}</span></>
                      )}
                    </p>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Type selector */}
                    <div>
                      <label className="text-xs text-muted block mb-2">What kind of feedback?</label>
                      <div className="flex gap-2">
                        {FEEDBACK_TYPES.map((ft) => (
                          <button
                            key={ft.value}
                            type="button"
                            onClick={() => setType(ft.value)}
                            className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                              type === ft.value
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-border text-muted hover:text-foreground hover:border-foreground/20"
                            }`}
                          >
                            <span className="text-base">{ft.icon}</span>
                            {ft.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="text-xs text-muted block mb-2">Your feedback</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={
                          type === "bug" ? "What happened? What did you expect?" :
                          type === "feature" ? "What would make this better?" :
                          type === "question" ? "What are you trying to figure out?" :
                          "Tell us what you think..."
                        }
                        rows={4}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 resize-none"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="p-5 pt-0 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="px-4 py-2 text-xs font-medium rounded-lg text-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!message.trim() || sending}
                      className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? "Sending..." : "Send Feedback"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
