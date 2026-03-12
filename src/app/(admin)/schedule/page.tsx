"use client";

import { useEffect, useState } from "react";

interface ScheduleSlot {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  instructor: string;
  class_type_id: number;
  class_type: string;
  description: string;
  min_belt: string;
  is_gi: number;
}

interface PlannedClass {
  date: string;
  start_time: string;
  class_type_id: number;
  lesson_title: string;
  position_area: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const beltMinColors: Record<string, string> = {
  white: "",
  blue: "border-l-2 border-l-blue-500",
  purple: "border-l-2 border-l-purple-500",
  brown: "border-l-2 border-l-amber-700",
};

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateToString(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function SchedulePage() {
  const [recurring, setRecurring] = useState<ScheduleSlot[]>([]);
  const [planned, setPlanned] = useState<PlannedClass[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/schedule?week=${weekOffset}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setRecurring(data.recurring);
        setPlanned(data.planned);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [weekOffset]);

  const weekDates = getWeekDates(weekOffset);
  const today = dateToString(new Date());

  // Map planned classes by date+time for quick lookup
  const plannedMap = new Map<string, PlannedClass>();
  for (const p of planned) {
    plannedMap.set(`${p.date}|${p.start_time}`, p);
  }

  // Group schedule by day
  const byDay: Record<number, ScheduleSlot[]> = {};
  for (const slot of recurring) {
    if (!byDay[slot.day_of_week]) byDay[slot.day_of_week] = [];
    byDay[slot.day_of_week].push(slot);
  }

  const weekLabel = `${weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Class Schedule</h1>
          <p className="text-sm text-muted mt-1">Members only — internal view</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          >
            &larr; Prev
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            This Week
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      <p className="text-sm text-muted mb-4">{weekLabel}</p>

      {error ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="text-center">
            <p className="text-danger font-medium">Failed to load schedule</p>
            <p className="text-sm text-muted mt-1">{error}</p>
            <button onClick={() => setWeekOffset(weekOffset)} className="mt-3 text-sm text-accent hover:underline">Retry</button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="text-muted animate-pulse">Loading schedule...</div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {/* Day-of-week mapped: Mon=1...Sat=6, Sun=0 */}
          {[1, 2, 3, 4, 5, 6, 0].map((dow, idx) => {
            const dateObj = weekDates[idx];
            const dateStr = dateToString(dateObj);
            const isToday = dateStr === today;
            const daySlots = byDay[dow] || [];

            return (
              <div
                key={dow}
                className={`bg-card rounded-xl border ${isToday ? "border-accent/50 ring-1 ring-accent/20" : "border-border"} min-h-[280px]`}
              >
                {/* Day header */}
                <div className={`px-3 py-2.5 border-b ${isToday ? "border-accent/30 bg-accent/5" : "border-border"} rounded-t-xl`}>
                  <p className={`text-xs font-semibold ${isToday ? "text-accent" : "text-muted"}`}>
                    {SHORT_DAYS[dow]}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? "text-accent" : "text-foreground"}`}>
                    {dateObj.getDate()}
                  </p>
                </div>

                {/* Classes */}
                <div className="p-2 space-y-2">
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-muted text-center py-4">No classes</p>
                  ) : (
                    daySlots.map((slot) => {
                      const plannedInfo = plannedMap.get(`${dateStr}|${slot.start_time}`);
                      return (
                        <div
                          key={slot.id}
                          className={`bg-background rounded-lg p-2.5 border border-border hover:border-accent/30 transition-colors ${beltMinColors[slot.min_belt] || ""}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted uppercase tracking-wider">
                              {formatTime(slot.start_time)}
                            </span>
                            {slot.is_gi ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">GI</span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">NO-GI</span>
                            )}
                          </div>
                          <p className="text-xs font-semibold leading-tight">{slot.class_type}</p>
                          <p className="text-[10px] text-muted mt-0.5">{slot.instructor}</p>
                          {slot.min_belt !== "white" && (
                            <p className="text-[10px] text-muted mt-0.5 capitalize">{slot.min_belt}+ only</p>
                          )}
                          {plannedInfo && (
                            <div className="mt-1.5 pt-1.5 border-t border-border">
                              <p className="text-[10px] text-accent font-medium leading-tight">
                                {plannedInfo.lesson_title}
                              </p>
                              {plannedInfo.position_area && (
                                <p className="text-[10px] text-muted">{plannedInfo.position_area}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-accent/10 border border-accent/30" />
          Today
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-blue-500" />
          Blue belt+ required
        </div>
        <div className="flex items-center gap-2">
          <span className="text-accent">Lesson title</span>
          = planned via Mat Planner
        </div>
      </div>
    </div>
  );
}
