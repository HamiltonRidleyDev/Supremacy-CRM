"use client";

import { useEffect, useState } from "react";

interface TrainingData {
  student: { beltRank: string; stripes: number; startDate: string };
  totalClasses: number;
  uniqueTechniques: number;
  attendance: Array<{
    date: string;
    class_type: string;
    instructor: string;
    lesson_title: string | null;
    position_area: string | null;
    is_gi: number;
  }>;
  categorySummary: Array<{
    category: string;
    techniques_seen: number;
    total_in_category: number;
  }>;
  techniqueExposure: Array<{
    id: number;
    name: string;
    category: string;
    times_exposed: number;
    last_exposed: string;
  }>;
  monthlyTrend: Array<{ month: string; classes: number }>;
}

const BELT_COLORS: Record<string, string> = {
  white: "bg-white text-black",
  blue: "bg-blue-600 text-white",
  purple: "bg-purple-700 text-white",
  brown: "bg-amber-800 text-white",
  black: "bg-black text-white border border-zinc-600",
};

const CATEGORY_LABELS: Record<string, string> = {
  guard: "Guard",
  passing: "Passing",
  takedowns: "Takedowns",
  submissions: "Submissions",
  escapes: "Escapes",
  sweeps: "Sweeps",
  back: "Back",
  turtle: "Turtle",
  top_control: "Top Control",
};

export default function MyTrainingPage() {
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "knowledge" | "history">(
    "overview"
  );
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/training")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading training data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="text-muted">
          No training data available yet. Keep training!
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-bold">My Training</h2>

      {/* Belt & Stats */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-4">
          <span
            className={`px-4 py-2 rounded-full text-sm font-bold ${
              BELT_COLORS[data.student.beltRank] || BELT_COLORS.white
            }`}
          >
            {data.student.beltRank}
            {data.student.stripes > 0 &&
              ` ${"I".repeat(data.student.stripes)}`}
          </span>
          <div className="flex-1 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xl font-bold">{data.totalClasses}</div>
              <div className="text-xs text-muted">Total Classes</div>
            </div>
            <div>
              <div className="text-xl font-bold">{data.uniqueTechniques}</div>
              <div className="text-xs text-muted">Techniques</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-card border border-border rounded-xl p-1">
        {(["overview", "knowledge", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-background text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t === "overview"
              ? "Overview"
              : t === "knowledge"
              ? "Knowledge Map"
              : "History"}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Monthly Trend */}
          {data.monthlyTrend.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Monthly Training</h3>
              <div className="flex items-end gap-1 h-32">
                {data.monthlyTrend.map((m) => {
                  const max = Math.max(...data.monthlyTrend.map((t) => t.classes));
                  const height = max > 0 ? (m.classes / max) * 100 : 0;
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <span className="text-xs text-muted">{m.classes}</span>
                      <div
                        className="w-full bg-accent/80 rounded-t"
                        style={{ height: `${height}%`, minHeight: m.classes > 0 ? "4px" : "0" }}
                      />
                      <span className="text-[10px] text-muted">
                        {m.month.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {data.categorySummary.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">
                Technique Coverage
              </h3>
              <div className="space-y-2">
                {data.categorySummary.map((cat) => {
                  const pct =
                    cat.total_in_category > 0
                      ? Math.round(
                          (cat.techniques_seen / cat.total_in_category) * 100
                        )
                      : 0;
                  return (
                    <div key={cat.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>
                          {CATEGORY_LABELS[cat.category] || cat.category}
                        </span>
                        <span className="text-muted">
                          {cat.techniques_seen}/{cat.total_in_category}
                        </span>
                      </div>
                      <div className="w-full bg-background rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Knowledge Map Tab */}
      {tab === "knowledge" && (
        <div className="space-y-3">
          {Object.entries(
            data.techniqueExposure.reduce((acc, t) => {
              if (!acc[t.category]) acc[t.category] = [];
              acc[t.category].push(t);
              return acc;
            }, {} as Record<string, typeof data.techniqueExposure>)
          ).map(([category, techniques]) => (
            <div
              key={category}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedCategory(
                    expandedCategory === category ? null : category
                  )
                }
                className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
              >
                <span className="font-medium">
                  {CATEGORY_LABELS[category] || category}
                </span>
                <span className="text-sm text-muted">
                  {techniques.length} techniques
                </span>
              </button>
              {expandedCategory === category && (
                <div className="border-t border-border px-4 pb-3">
                  {techniques.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between py-2 text-sm border-b border-border/50 last:border-0"
                    >
                      <span>{t.name}</span>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>{t.times_exposed}x</span>
                        <span>
                          {new Date(t.last_exposed).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {data.techniqueExposure.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted">
                No technique data yet. As you attend classes with lesson plans,
                your knowledge map will grow.
              </p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="space-y-2">
          {data.attendance.map((a, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-medium text-sm">{a.class_type}</div>
                {a.lesson_title && (
                  <div className="text-xs text-muted mt-0.5">
                    {a.lesson_title}
                    {a.position_area && ` - ${a.position_area}`}
                  </div>
                )}
                <div className="text-xs text-muted mt-0.5">
                  {a.instructor}
                  {a.is_gi === 0 && " (No-Gi)"}
                </div>
              </div>
              <span className="text-xs text-muted whitespace-nowrap">
                {new Date(a.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          ))}
          {data.attendance.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted">No attendance records yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
