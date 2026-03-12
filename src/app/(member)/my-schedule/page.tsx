"use client";

import { useEffect, useState } from "react";

interface ScheduleDay {
  date: string;
  dayOfWeek: number;
  classes: Array<{
    id: number;
    start_time: string;
    end_time: string;
    class_type: string;
    instructor: string;
    is_gi: number;
    min_belt: string;
  }>;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MySchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    fetch("/api/me/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setSchedule(data.upcomingSchedule || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading schedule...</div>
      </div>
    );
  }

  const today = new Date();
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      dayOfWeek: d.getDay(),
      dayNum: d.getDate(),
      isToday: i === 0,
    };
  });

  const selectedDate = weekDates[selectedDay];
  const daySchedule = schedule.find((s) => s.date === selectedDate.date);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-bold">Schedule</h2>

      {/* Day selector */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-2">
        {weekDates.map((d, i) => (
          <button
            key={d.date}
            onClick={() => setSelectedDay(i)}
            className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-colors ${
              i === selectedDay
                ? "bg-accent text-white"
                : d.isToday
                ? "bg-accent/10 text-accent"
                : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            <span className="text-xs font-medium">
              {SHORT_DAYS[d.dayOfWeek]}
            </span>
            <span className="text-lg font-bold">{d.dayNum}</span>
          </button>
        ))}
      </div>

      {/* Selected day's classes */}
      <div>
        <h3 className="text-sm font-medium text-muted mb-3">
          {DAY_NAMES[selectedDate.dayOfWeek]},{" "}
          {new Date(selectedDate.date + "T12:00:00").toLocaleDateString(
            "en-US",
            { month: "long", day: "numeric" }
          )}
        </h3>

        {daySchedule && daySchedule.classes.length > 0 ? (
          <div className="space-y-3">
            {daySchedule.classes.map((cls, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{cls.class_type}</h4>
                    <p className="text-sm text-muted mt-0.5">
                      {cls.instructor}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {cls.start_time} - {cls.end_time}
                    </p>
                    <div className="flex items-center gap-2 mt-1 justify-end">
                      {cls.is_gi === 0 && (
                        <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">
                          No-Gi
                        </span>
                      )}
                      {cls.min_belt && cls.min_belt !== "white" && (
                        <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded">
                          {cls.min_belt}+
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted">No classes scheduled for this day</p>
          </div>
        )}
      </div>
    </div>
  );
}
