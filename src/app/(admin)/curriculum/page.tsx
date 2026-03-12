"use client";

import { useEffect, useState } from "react";

interface TechniqueCoverage {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  belt_level: string;
  times_taught: number;
  last_taught: string | null;
  freshness: "never" | "stale" | "aging" | "recent";
}

const categoryLabels: Record<string, string> = {
  guard: "Guard",
  passing: "Passing",
  takedowns: "Takedowns",
  submissions: "Submissions",
  escapes: "Escapes",
  sweeps: "Sweeps",
  back: "Back Attacks",
  top_control: "Top Control",
};

const freshnessConfig = {
  recent: { label: "Recent", color: "bg-success/10 text-success border-success/20" },
  aging: { label: "30+ days", color: "bg-warning/10 text-warning border-warning/20" },
  stale: { label: "90+ days", color: "bg-danger/10 text-danger border-danger/20" },
  never: { label: "Never taught", color: "bg-zinc-800 text-muted border-border" },
};

export default function CurriculumPage() {
  const [techniques, setTechniques] = useState<TechniqueCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterFreshness, setFilterFreshness] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    fetch("/api/curriculum")
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then(setTechniques)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted animate-pulse">Loading curriculum...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-danger font-medium">Failed to load curriculum</p>
          <p className="text-sm text-muted mt-1">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm text-accent hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const categories = [...new Set(techniques.map((t) => t.category))];
  const filtered = techniques.filter((t) => {
    if (filterFreshness !== "all" && t.freshness !== filterFreshness) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  const gapCount = techniques.filter((t) => t.freshness === "never" || t.freshness === "stale").length;
  const recentCount = techniques.filter((t) => t.freshness === "recent").length;

  // Group filtered techniques by category
  const grouped: Record<string, TechniqueCoverage[]> = {};
  for (const t of filtered) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Curriculum Coverage</h1>
        <p className="text-sm text-muted mt-1">Track what&apos;s been taught and identify gaps</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted uppercase tracking-wider">Total Techniques</p>
          <p className="text-2xl font-bold mt-1">{techniques.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-success/20 p-4">
          <p className="text-xs text-success uppercase tracking-wider">Recently Taught</p>
          <p className="text-2xl font-bold text-success mt-1">{recentCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-danger/20 p-4">
          <p className="text-xs text-danger uppercase tracking-wider">Gaps (Stale/Never)</p>
          <p className="text-2xl font-bold text-danger mt-1">{gapCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-accent/20 p-4">
          <p className="text-xs text-accent uppercase tracking-wider">Coverage</p>
          <p className="text-2xl font-bold text-accent mt-1">{Math.round(((techniques.length - gapCount) / techniques.length) * 100)}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          <span className="text-xs text-muted self-center mr-1">Freshness:</span>
          {["all", "never", "stale", "aging", "recent"].map((f) => (
            <button
              key={f}
              onClick={() => setFilterFreshness(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterFreshness === f ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              {f === "all" ? "All" : freshnessConfig[f as keyof typeof freshnessConfig]?.label || f}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex gap-2">
          <span className="text-xs text-muted self-center mr-1">Category:</span>
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterCategory === "all" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterCategory === cat ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Technique Grid by Category */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, techs]) => (
          <div key={cat} className="bg-card rounded-xl border border-border">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">{categoryLabels[cat] || cat}</h2>
              <span className="text-xs text-muted">{techs.length} techniques</span>
            </div>
            <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {techs.map((t) => {
                const cfg = freshnessConfig[t.freshness];
                return (
                  <div
                    key={t.id}
                    className={`rounded-lg border p-3 ${cfg.color}`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium">{t.name}</p>
                      <span className="text-xs opacity-70 ml-2 shrink-0">{t.belt_level}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs opacity-70">
                        {t.freshness === "never"
                          ? "Never taught"
                          : `Taught ${t.times_taught}x`}
                      </span>
                      {t.last_taught && (
                        <span className="text-xs opacity-70">
                          Last: {new Date(t.last_taught + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
