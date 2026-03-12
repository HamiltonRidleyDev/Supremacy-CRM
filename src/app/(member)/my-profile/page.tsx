"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ProfileData {
  user: {
    id: number;
    email: string;
    phone: string;
    role: string;
    displayName: string;
    hasPassword: boolean;
    createdAt: string;
    lastLogin: string;
  };
  student?: {
    first_name: string;
    last_name: string;
    belt_rank: string;
    stripes: number;
    membership_type: string;
    membership_status: string;
    start_date: string;
  };
  profile?: {
    motivation: string;
    goals: string;
    priorTraining: string;
    schedulePreference: string;
    trainingFrequencyTarget: string;
    injuriesConcerns: string;
    giOrNogi: string;
    instagramHandle: string;
    occupation: string;
  };
}

const BELT_COLORS: Record<string, string> = {
  white: "bg-white text-black",
  blue: "bg-blue-600 text-white",
  purple: "bg-purple-700 text-white",
  brown: "bg-amber-800 text-white",
  black: "bg-black text-white border border-zinc-600",
};

export default function MyProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  // Editable profile fields
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    phone: "",
    motivation: "",
    goals: "",
    schedulePreference: "",
    trainingFrequencyTarget: "",
    injuriesConcerns: "",
    giOrNogi: "",
    instagramHandle: "",
    occupation: "",
  });

  useEffect(() => {
    fetch("/api/me/profile")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setFormData({
          displayName: d.user?.displayName || "",
          phone: d.user?.phone || "",
          motivation: d.profile?.motivation || "",
          goals: d.profile?.goals || "",
          schedulePreference: d.profile?.schedulePreference || "",
          trainingFrequencyTarget: d.profile?.trainingFrequencyTarget || "",
          injuriesConcerns: d.profile?.injuriesConcerns || "",
          giOrNogi: d.profile?.giOrNogi || "",
          instagramHandle: d.profile?.instagramHandle || "",
          occupation: d.profile?.occupation || "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setEditing(false);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPassword() {
    if (password.length < 6) {
      setPasswordMsg("Password must be at least 6 characters");
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordMsg("Passwords do not match");
      return;
    }

    setSaving(true);
    setPasswordMsg("");
    try {
      const res = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await res.json();
      if (res.ok) {
        setPasswordMsg("Password set successfully!");
        setShowPasswordForm(false);
        setPassword("");
        setPasswordConfirm("");
        if (data) {
          setData({
            ...data,
            user: { ...data.user, hasPassword: true },
          });
        }
      } else {
        setPasswordMsg(d.error || "Failed to set password");
      }
    } catch {
      setPasswordMsg("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading profile...</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">My Profile</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-accent hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {/* Account Info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted mb-3">Account</h3>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted mb-1">
                Display Name
              </label>
              <input
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Phone</label>
              <input
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Name</span>
              <span>{data.user.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Email</span>
              <span>{data.user.email || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Phone</span>
              <span>{data.user.phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Role</span>
              <span className="capitalize">{data.user.role}</span>
            </div>
          </div>
        )}
      </div>

      {/* Student Info */}
      {data.student && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted mb-3">Membership</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted">Belt</span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-medium ${
                  BELT_COLORS[data.student.belt_rank] || BELT_COLORS.white
                }`}
              >
                {data.student.belt_rank}
                {data.student.stripes > 0 &&
                  ` ${"I".repeat(data.student.stripes)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Status</span>
              <span className="capitalize">
                {data.student.membership_status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Type</span>
              <span className="capitalize">
                {data.student.membership_type}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Member Since</span>
              <span>
                {new Date(data.student.start_date).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Training Preferences (editable) */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted mb-3">
          Training Preferences
        </h3>
        {editing ? (
          <div className="space-y-3">
            {[
              { key: "goals", label: "Goals" },
              { key: "motivation", label: "What motivates you?" },
              { key: "schedulePreference", label: "Preferred schedule" },
              {
                key: "trainingFrequencyTarget",
                label: "Target training days/week",
              },
              { key: "injuriesConcerns", label: "Injuries / Concerns" },
              { key: "giOrNogi", label: "Gi or No-Gi preference" },
              { key: "instagramHandle", label: "Instagram" },
              { key: "occupation", label: "Occupation" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs text-muted mb-1">
                  {f.label}
                </label>
                <input
                  value={(formData as any)[f.key] || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, [f.key]: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {[
              { key: "goals", label: "Goals" },
              { key: "motivation", label: "Motivation" },
              { key: "schedulePreference", label: "Schedule" },
              { key: "trainingFrequencyTarget", label: "Target freq." },
              { key: "injuriesConcerns", label: "Injuries" },
              { key: "giOrNogi", label: "Gi/No-Gi" },
              { key: "instagramHandle", label: "Instagram" },
              { key: "occupation", label: "Occupation" },
            ]
              .filter((f) => (data.profile as any)?.[f.key])
              .map((f) => (
                <div key={f.key} className="flex justify-between">
                  <span className="text-muted">{f.label}</span>
                  <span className="text-right max-w-[60%]">
                    {(data.profile as any)[f.key]}
                  </span>
                </div>
              ))}
            {!data.profile && (
              <p className="text-muted text-center py-2">
                No preferences set yet. Tap Edit to add yours.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Save / Cancel buttons when editing */}
      {editing && (
        <div className="flex gap-3">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-card-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-accent hover:bg-accent-dim text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Password Section */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted mb-3">Security</h3>
        {data.user.hasPassword ? (
          <p className="text-sm text-muted">
            Password is set. You can log in with email + password.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted mb-3">
              Set a password for faster login (optional — you can always use a
              login code).
            </p>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="text-sm text-accent hover:underline"
              >
                Set Password
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                />
                {passwordMsg && (
                  <p
                    className={`text-xs ${
                      passwordMsg.includes("success")
                        ? "text-success"
                        : "text-danger"
                    }`}
                  >
                    {passwordMsg}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPasswordForm(false)}
                    className="flex-1 py-2 border border-border rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSetPassword}
                    disabled={saving}
                    className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? "Setting..." : "Set Password"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 border border-danger/30 text-danger rounded-xl text-sm hover:bg-danger/10 transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}
