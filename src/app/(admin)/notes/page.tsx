"use client";

import { useEffect, useState, useRef } from "react";

interface Note {
  id: number;
  author: string;
  content: string;
  tags: string | null;
  is_used: number;
  used_in_plan_title: string | null;
  created_at: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [newTags, setNewTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showUsed, setShowUsed] = useState(true);
  const [justSaved, setJustSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchNotes = () => {
    fetch("/api/notes")
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then(setNotes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotes(); }, []);

  const handleSave = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newNote.trim(), tags: newTags.trim() || undefined }),
    });
    setNewNote("");
    setNewTags("");
    setSaving(false);
    setShowComposer(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
    fetchNotes();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    fetchNotes();
  };

  const toggleVoice = () => {
    const SpeechRecognitionAPI = (window as unknown as Record<string, unknown>).SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert("Voice input not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognitionAPI as any)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    const existingText = newNote;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      // Rebuild from ALL results each time to avoid duplication.
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const voiceText = (final + interim).trim();
      const combined = existingText ? existingText + " " + voiceText : voiceText;
      setNewNote(combined);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setShowComposer(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  const handleDiscard = () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
    setNewNote("");
    setNewTags("");
    setShowComposer(false);
  };

  const unused = notes.filter((n) => !n.is_used);
  const used = notes.filter((n) => n.is_used);
  const displayed = showUsed ? notes : unused;

  function formatDate(dt: string) {
    const d = new Date(dt);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 text-center md:text-left">
        <h1 className="text-xl md:text-2xl font-bold">Quick Notes</h1>
        <p className="text-xs md:text-sm text-muted mt-1">
          Tap the mic, speak your idea, then save. Notes feed into Mat Planner.
        </p>
      </div>

      {/* ===== MAIN ACTION: Big Voice Button (when composer is closed) ===== */}
      {!showComposer && (
        <div className="flex flex-col items-center gap-4 mb-8">
          <button
            onClick={toggleVoice}
            className="w-24 h-24 md:w-20 md:h-20 rounded-full bg-accent text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <svg className="w-10 h-10 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <span className="text-sm text-muted">Tap to record a voice note</span>

          <button
            onClick={() => setShowComposer(true)}
            className="text-xs text-accent hover:underline mt-1"
          >
            or type a note
          </button>

          {/* Just saved confirmation */}
          {justSaved && (
            <div className="flex items-center gap-2 text-sm text-success animate-in fade-in">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Note saved
            </div>
          )}
        </div>
      )}

      {/* ===== COMPOSER (expanded state) ===== */}
      {showComposer && (
        <div className="bg-card rounded-2xl border border-accent/30 p-4 md:p-5 mb-6 mx-auto">
          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-danger animate-pulse" />
              <span className="text-sm font-medium text-danger">Listening...</span>
            </div>
          )}

          {/* Voice toggle (inside composer) */}
          <div className="flex justify-center mb-3">
            <button
              onClick={toggleVoice}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                isRecording
                  ? "bg-danger text-white animate-pulse shadow-lg shadow-danger/30"
                  : "bg-accent/10 text-accent hover:bg-accent/20"
              }`}
            >
              {isRecording ? (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-center text-xs text-muted mb-3">
            {isRecording ? "Tap stop when done" : "Tap mic to add more, or edit below"}
          </p>

          {/* Text area */}
          <textarea
            ref={textareaRef}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind, Professor?"
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm md:text-base resize-none focus:outline-none focus:border-accent/50 placeholder:text-muted/50 min-h-[100px]"
            rows={4}
            autoFocus={!isRecording}
          />

          {/* Tags */}
          <input
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="Tags (optional): guard, Marcus, competition..."
            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs md:text-sm mt-2 focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
          />

          {/* Action buttons — stacked on mobile */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
            <button
              onClick={handleDiscard}
              className="flex-1 sm:flex-none px-4 py-3 sm:py-2 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-background border border-border transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={!newNote.trim() || saving}
              className="flex-1 px-6 py-3 sm:py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Note"}
            </button>
          </div>

          {/* Hint */}
          <p className="text-center text-[11px] text-muted/60 mt-3">
            Tip: In the Quick Assistant, say &quot;pin that&quot; to save an AI response as a note
          </p>
        </div>
      )}

      {/* ===== NOTES LIST ===== */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3">
          <span className="text-sm">
            <span className="font-bold text-accent">{unused.length}</span>
            <span className="text-muted ml-1">unused</span>
          </span>
          <span className="text-sm">
            <span className="font-bold text-muted">{used.length}</span>
            <span className="text-muted ml-1">used</span>
          </span>
        </div>
        <button
          onClick={() => setShowUsed(!showUsed)}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {showUsed ? "Hide used" : "Show all"}
        </button>
      </div>

      {error ? (
        <div className="text-center py-12">
          <p className="text-danger font-medium">Failed to load notes</p>
          <p className="text-sm text-muted mt-1">{error}</p>
          <button onClick={() => { setError(null); fetchNotes(); }} className="mt-3 text-sm text-accent hover:underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="text-muted animate-pulse text-center py-12">Loading notes...</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted">No notes yet. Record your first idea above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((note) => (
            <div
              key={note.id}
              className={`bg-card rounded-xl border p-4 transition-colors ${
                note.is_used ? "border-border opacity-60" : "border-border hover:border-accent/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{note.content}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-muted">{formatDate(note.created_at)}</span>
                    {note.tags && (
                      <div className="flex gap-1.5 flex-wrap">
                        {note.tags.split(",").map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    {note.is_used === 1 && note.used_in_plan_title && (
                      <span className="text-[10px] text-success">
                        Used in: {note.used_in_plan_title}
                      </span>
                    )}
                  </div>
                </div>
                {/* Delete: tap once to reveal confirm, tap again to delete */}
                {deleteConfirm === note.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-xs px-2 py-1.5 rounded-lg bg-danger/10 text-danger font-medium active:bg-danger/20"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="text-xs px-2 py-1.5 rounded-lg text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(note.id)}
                    className="text-muted hover:text-danger transition-colors shrink-0 p-2 -m-1"
                    title="Delete note"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
