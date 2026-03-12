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
  const [showUsed, setShowUsed] = useState(true);
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
    fetchNotes();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
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

    let finalTranscript = newNote;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setNewNote(finalTranscript + (interim ? " " + interim : ""));
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setNewNote(finalTranscript);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
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
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Quick Notes</h1>
        <p className="text-sm text-muted mt-1">
          Capture ideas anytime — voice or text. These feed into Mat Planner sessions.
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-card rounded-xl border border-accent/30 p-5 mb-8">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={toggleVoice}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isRecording
                ? "bg-danger text-white animate-pulse"
                : "bg-accent/10 text-accent hover:bg-accent/20"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {isRecording ? "Recording... tap to stop" : "Voice Note"}
          </button>
          <span className="text-xs text-muted">or type below</span>
        </div>

        <textarea
          ref={textareaRef}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind, Professor? Lesson ideas, student observations, technique notes..."
          className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
          rows={3}
        />

        <div className="flex items-center justify-between mt-3">
          <input
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="Tags (optional): guard, Marcus, competition..."
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent/50 placeholder:text-muted/50 mr-3"
          />
          <button
            onClick={handleSave}
            disabled={!newNote.trim() || saving}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Note"}
          </button>
        </div>
        <p className="text-[10px] text-muted mt-2">Ctrl+Enter to save</p>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm">
            <span className="font-bold text-accent">{unused.length}</span>
            <span className="text-muted ml-1">unused notes</span>
          </span>
          <span className="text-sm">
            <span className="font-bold text-muted">{used.length}</span>
            <span className="text-muted ml-1">used in plans</span>
          </span>
        </div>
        <button
          onClick={() => setShowUsed(!showUsed)}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {showUsed ? "Hide used" : "Show all"}
        </button>
      </div>

      {/* Notes List */}
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
        <div className="space-y-3">
          {displayed.map((note) => (
            <div
              key={note.id}
              className={`bg-card rounded-xl border p-4 transition-colors ${
                note.is_used ? "border-border opacity-60" : "border-border hover:border-accent/30"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{note.content}</p>
                  <div className="flex items-center gap-3 mt-2">
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
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-muted hover:text-danger transition-colors shrink-0 p-1"
                  title="Delete note"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
