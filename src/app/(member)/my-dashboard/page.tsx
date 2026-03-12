"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  user: { displayName: string; role: string };
  student?: {
    belt_rank: string;
    stripes: number;
    membership_status: string;
    start_date: string;
    last_attendance: string;
  };
  daysSinceLastTraining?: number;
  classesThisMonth: number;
  recentAttendance: Array<{
    date: string;
    start_time: string;
    class_type: string;
    lesson_title: string | null;
    position_area: string | null;
  }>;
  engagement?: {
    score: number;
    riskLevel: string;
    attendance: number;
    progression: number;
  };
  upcomingSchedule: Array<{
    date: string;
    dayOfWeek: number;
    classes: Array<{
      start_time: string;
      end_time: string;
      class_type: string;
      instructor: string;
      is_gi: number;
    }>;
  }>;
  announcements: Array<{
    content: string;
    created_at: string;
    channel_name: string;
  }>;
}

const BELT_COLORS: Record<string, string> = {
  white: "bg-white text-black",
  blue: "bg-blue-600 text-white",
  purple: "bg-purple-700 text-white",
  brown: "bg-amber-800 text-white",
  black: "bg-black text-white border border-zinc-600",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MyDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Welcome */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-xl font-bold">
          Welcome back, {data.user.displayName.split(" ")[0]}
        </h2>
        {data.student && (
          <div className="flex items-center gap-3 mt-3">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                BELT_COLORS[data.student.belt_rank] || BELT_COLORS.white
              }`}
            >
              {data.student.belt_rank}
              {data.student.stripes > 0 &&
                ` ${"I".repeat(data.student.stripes)}`}
            </span>
            {data.student.start_date && (
              <span className="text-sm text-muted">
                Training since{" "}
                {new Date(data.student.start_date).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{data.classesThisMonth}</div>
          <div className="text-xs text-muted mt-1">Classes This Month</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">
            {data.daysSinceLastTraining != null
              ? data.daysSinceLastTraining === 0
                ? "Today"
                : `${data.daysSinceLastTraining}d`
              : "—"}
          </div>
          <div className="text-xs text-muted mt-1">Since Last Class</div>
        </div>
      </div>

      {/* Engagement Score */}
      {data.engagement && data.engagement.score != null && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Engagement Score</span>
            <span className="text-lg font-bold">{data.engagement.score}</span>
          </div>
          <div className="w-full bg-background rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${data.engagement.score}%`,
                backgroundColor:
                  data.engagement.score >= 70
                    ? "var(--success)"
                    : data.engagement.score >= 40
                    ? "var(--warning)"
                    : "var(--danger)",
              }}
            />
          </div>
        </div>
      )}

      {/* Announcements */}
      {data.announcements.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Announcements</h3>
          <div className="space-y-3">
            {data.announcements.map((a, i) => (
              <div key={i} className="text-sm">
                <p>{a.content}</p>
                <p className="text-xs text-muted mt-1">
                  {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Schedule */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">This Week&apos;s Schedule</h3>
        <div className="space-y-3">
          {data.upcomingSchedule.map((day) => (
            <div key={day.date}>
              <div className="text-xs font-medium text-muted mb-1">
                {DAY_NAMES[day.dayOfWeek]}{" "}
                {new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="space-y-1.5">
                {day.classes.map((cls, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between text-sm bg-background/50 rounded-lg px-3 py-2"
                  >
                    <div>
                      <span className="font-medium">{cls.class_type}</span>
                      {cls.is_gi === 0 && (
                        <span className="text-xs text-accent ml-1.5">
                          No-Gi
                        </span>
                      )}
                    </div>
                    <div className="text-muted text-xs">
                      {cls.start_time} - {cls.end_time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {data.upcomingSchedule.length === 0 && (
            <p className="text-sm text-muted">No classes scheduled this week</p>
          )}
        </div>
      </div>

      {/* Recent Training */}
      {data.recentAttendance.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Recent Training</h3>
          <div className="space-y-2">
            {data.recentAttendance.slice(0, 5).map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-medium">{a.class_type}</span>
                  {a.lesson_title && (
                    <span className="text-muted ml-2 text-xs">
                      {a.lesson_title}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted">
                  {new Date(a.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
