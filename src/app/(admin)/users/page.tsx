"use client";

import { useEffect, useState } from "react";

interface User {
  id: number;
  email: string;
  phone: string;
  role: string;
  student_id: number | null;
  display_name: string;
  is_active: number;
  last_login: string | null;
  created_at: string;
  belt_rank: string | null;
  stripes: number | null;
  membership_type: string | null;
  membership_status: string | null;
  monthly_rate: number | null;
}

const ROLES = ["admin", "manager", "member", "guest"] as const;

const roleConfig: Record<string, { label: string; color: string; description: string }> = {
  admin: {
    label: "Admin",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    description: "Full access. Manage roles, billing, CRM, Mat Planner, schedule, everything.",
  },
  manager: {
    label: "Manager",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    description: "Operational access. CRM, attendance, schedule, community moderation. No billing or role management.",
  },
  member: {
    label: "Member",
    color: "bg-green-500/10 text-green-400 border-green-500/20",
    description: "Paying student or parent. View schedule, community, own profile and knowledge map.",
  },
  guest: {
    label: "Guest",
    color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    description: "Non-paying attendee (trial, walk-in, step-up). View schedule, limited community access.",
  },
};

const beltColors: Record<string, string> = {
  white: "bg-white text-black",
  blue: "bg-blue-600 text-white",
  purple: "bg-purple-700 text-white",
  brown: "bg-amber-800 text-white",
  black: "bg-black text-white border border-zinc-600",
};

/*
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  RBAC PERMISSION MATRIX (reference — not enforced yet)                     │
  ├─────────────────────────┬───────┬─────────┬────────┬───────┐               │
  │  Feature                │ Admin │ Manager │ Member │ Guest │               │
  ├─────────────────────────┼───────┼─────────┼────────┼───────┤               │
  │  Dashboard              │  ✓    │  ✓      │  -     │  -    │               │
  │  Mat Planner            │  ✓    │  ✓      │  -     │  -    │               │
  │  Quick Notes            │  ✓    │  ✓      │  -     │  -    │               │
  │  Schedule (manage)      │  ✓    │  ✓      │  -     │  -    │               │
  │  Schedule (view)        │  ✓    │  ✓      │  ✓     │  ✓    │               │
  │  Students (all)         │  ✓    │  ✓      │  -     │  -    │               │
  │  Students (own profile) │  ✓    │  ✓      │  ✓     │  ✓    │               │
  │  Knowledge Map (all)    │  ✓    │  ✓      │  -     │  -    │               │
  │  Knowledge Map (own)    │  ✓    │  ✓      │  ✓     │  ✓    │               │
  │  Curriculum             │  ✓    │  ✓      │  -     │  -    │               │
  │  Leads / CRM            │  ✓    │  ✓      │  -     │  -    │               │
  │  Community (post)       │  ✓    │  ✓      │  ✓     │  -    │               │
  │  Community (view)       │  ✓    │  ✓      │  ✓     │  ✓    │               │
  │  Community (moderate)   │  ✓    │  ✓      │  -     │  -    │               │
  │  Announcements (post)   │  ✓    │  ✓      │  -     │  -    │               │
  │  User Management        │  ✓    │  -      │  -     │  -    │               │
  │  Billing / Rates        │  ✓    │  -      │  -     │  -    │               │
  └─────────────────────────┴───────┴─────────┴────────┴───────┘               │
  └─────────────────────────────────────────────────────────────────────────────┘
*/

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [saving, setSaving] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchUsers = () => {
    fetch("/api/users")
      .then((r) => {
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    setSaving(userId);
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    fetchUsers();
    setSaving(null);
  };

  const filtered = users.filter((u) => {
    if (filterRole === "all") return true;
    if (filterRole === "inactive") return !u.is_active;
    return u.role === filterRole;
  });

  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r] = users.filter((u) => u.role === r && u.is_active).length;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-muted animate-pulse">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-danger font-medium">Failed to load users</p>
          <p className="text-sm text-muted mt-1">{error}</p>
          <button onClick={() => { setError(null); fetchUsers(); }} className="mt-3 text-sm text-accent hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-sm text-muted mt-1">Assign roles and manage access levels</p>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {ROLES.map((role) => {
          const cfg = roleConfig[role];
          return (
            <div key={role} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs px-2 py-1 rounded border font-medium ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="text-xl font-bold">{roleCounts[role]}</span>
              </div>
              <p className="text-[11px] text-muted leading-snug">{cfg.description}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {["all", ...ROLES, "inactive"].map((f) => (
          <button
            key={f}
            onClick={() => setFilterRole(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterRole === f ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            {f === "all" ? "All" : f === "inactive" ? "Inactive" : roleConfig[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">User</th>
              <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Belt</th>
              <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Type</th>
              <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Role</th>
              <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Status</th>
              <th className="px-5 py-3 text-xs text-muted uppercase tracking-wider font-medium">Last Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((user) => {
              const cfg = roleConfig[user.role] || roleConfig.guest;
              return (
                <tr key={user.id} className={`hover:bg-card-hover transition-colors ${!user.is_active ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium">{user.display_name}</p>
                    <p className="text-xs text-muted">{user.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    {user.belt_rank ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${beltColors[user.belt_rank] || "bg-zinc-700 text-white"}`}>
                        {user.belt_rank.charAt(0).toUpperCase() + user.belt_rank.slice(1)}
                        {user.stripes ? <span className="opacity-70">{"I".repeat(user.stripes)}</span> : null}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Staff</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted capitalize">
                    {user.membership_type || "—"}
                    {user.monthly_rate ? ` ($${user.monthly_rate}/mo)` : ""}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={saving === user.id}
                      className={`text-xs px-2 py-1.5 rounded border font-medium cursor-pointer bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/50 ${cfg.color} ${saving === user.id ? "opacity-50" : ""}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r} className="bg-card text-foreground">
                          {roleConfig[r].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    {user.is_active ? (
                      <span className="text-xs text-success">Active</span>
                    ) : (
                      <span className="text-xs text-danger">Inactive</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                      : "Never"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Permission matrix reference */}
      <div className="mt-8 bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold">Permission Matrix</h2>
          <p className="text-xs text-muted mt-1">Reference — enforcement coming soon</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-muted font-medium">Feature</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-4 py-2 text-center font-medium">
                    <span className={`px-1.5 py-0.5 rounded border ${roleConfig[r].color}`}>{roleConfig[r].label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Dashboard", true, true, false, false],
                ["Mat Planner", true, true, false, false],
                ["Quick Notes", true, true, false, false],
                ["Schedule (manage)", true, true, false, false],
                ["Schedule (view)", true, true, true, true],
                ["Students (all)", true, true, false, false],
                ["Own Profile & Knowledge Map", true, true, true, true],
                ["Curriculum Coverage", true, true, false, false],
                ["Leads / CRM", true, true, false, false],
                ["Community (post)", true, true, true, false],
                ["Community (view)", true, true, true, true],
                ["Community (moderate)", true, true, false, false],
                ["Announcements (post)", true, true, false, false],
                ["User Management", true, false, false, false],
                ["Billing / Rates", true, false, false, false],
              ].map(([feature, ...perms]) => (
                <tr key={feature as string} className="hover:bg-card-hover">
                  <td className="px-4 py-2 text-muted">{feature as string}</td>
                  {(perms as boolean[]).map((has, i) => (
                    <td key={i} className="px-4 py-2 text-center">
                      {has ? (
                        <span className="text-success">&#10003;</span>
                      ) : (
                        <span className="text-muted opacity-30">&#8212;</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
