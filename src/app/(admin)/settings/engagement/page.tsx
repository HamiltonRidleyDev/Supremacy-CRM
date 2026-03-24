"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// Types matching engagement-config.ts
interface TierEntry { max: number; score: number }
interface MinTierEntry { min: number; score: number }

interface EngagementConfig {
  weights: { attendance: number; communication: number; progression: number; community: number; financial: number };
  riskLevels: { healthy: number; cooling: number; atRisk: number; ghost: number };
  attendance: {
    recencyWeight: number; volumeWeight: number;
    recency: TierEntry[]; volume: MinTierEntry[];
    frequencyWeight: number; trendWeight: number; consistencyWeight: number;
    defaultTargetPerMonth: number; trendTiers: MinTierEntry[]; consistencyMultiplier: number;
  };
  communication: {
    replyWeight: number; initiatedWeight: number;
    replyTime: TierEntry[]; inboundCount: MinTierEntry[];
    neutralDefault: number;
  };
  progression: {
    advancementWeight: number; breadthWeight: number;
    beltExpectedMonths: Record<string, number>; totalCategories: number;
  };
  community: {
    membershipWeight: number; activityWeight: number;
    channelTiers: MinTierEntry[]; messageTiers: MinTierEntry[];
    neutralDefault: number;
  };
  financial: {
    paymentWeight: number; rateWeight: number;
    vacationScore: number; activeScore: number; noRateScore: number; rateMultiplier: number;
  };
  riskFactors: {
    ghostDays: number; warningDays: number; noticeDays: number;
    lowAttendanceThreshold: number; decliningAttendanceThreshold: number; lowProgressionThreshold: number;
  };
}

interface DistEntry { risk_level: string; count: number; avg_score: number }

const RISK_COLORS: Record<string, string> = {
  healthy: "bg-green-600", cooling: "bg-yellow-500", at_risk: "bg-orange-500", ghost: "bg-red-600", churned: "bg-zinc-600",
};
const RISK_LABELS: Record<string, string> = {
  healthy: "Healthy", cooling: "Cooling", at_risk: "At Risk", ghost: "Ghost", churned: "Churned",
};

export default function EngagementSettingsPage() {
  const [config, setConfig] = useState<EngagementConfig | null>(null);
  const [defaults, setDefaults] = useState<EngagementConfig | null>(null);
  const [descriptions, setDescriptions] = useState<any>(null);
  const [distribution, setDistribution] = useState<DistEntry[]>([]);
  const [totalScored, setTotalScored] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    weights: true, riskLevels: true,
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/engagement");
      const data = await res.json();
      setConfig(data.config);
      setDefaults(data.defaults);
      setDescriptions(data.descriptions);
      setDistribution(data.distribution || []);
      setTotalScored(data.totalScored || 0);
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const save = async (rescore: boolean) => {
    if (!config) return;
    rescore ? setRescoring(true) : setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/engagement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, rescore }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setConfig(data.config);
        setDistribution(data.distribution || []);
        setFeedback(rescore
          ? `Saved & re-scored ${data.scoreResult?.contacts_scored || 0} members in ${data.scoreResult?.duration_ms || 0}ms`
          : "Settings saved"
        );
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
      setRescoring(false);
    }
  };

  const resetToDefaults = () => {
    if (defaults) setConfig(JSON.parse(JSON.stringify(defaults)));
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Helpers to update nested config
  const updateWeight = (key: string, value: number) => {
    if (!config) return;
    setConfig({ ...config, weights: { ...config.weights, [key]: value / 100 } });
  };

  const updateRiskLevel = (key: string, value: number) => {
    if (!config) return;
    setConfig({ ...config, riskLevels: { ...config.riskLevels, [key]: value } });
  };

  const updateNested = (section: string, key: string, value: any) => {
    if (!config) return;
    setConfig({ ...config, [section]: { ...(config as any)[section], [key]: value } });
  };

  const updateTier = (section: string, field: string, index: number, prop: string, value: number) => {
    if (!config) return;
    const sectionData = { ...(config as any)[section] };
    const tiers = [...sectionData[field]];
    tiers[index] = { ...tiers[index], [prop]: value };
    sectionData[field] = tiers;
    setConfig({ ...config, [section]: sectionData });
  };

  if (loading || !config) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted mt-3">Loading engagement settings...</p>
      </div>
    );
  }

  const totalWeight = Math.round(
    (config.weights.attendance + config.weights.communication + config.weights.progression +
     config.weights.community + config.weights.financial) * 100
  );

  const distTotal = distribution.reduce((s, d) => s + d.count, 0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Engagement Scoring</h1>
          <p className="text-xs text-muted mt-1">
            Configure how member health is calculated. Changes apply on next re-score.
          </p>
        </div>
        <Link href="/students" className="text-xs text-accent hover:underline">
          View Students
        </Link>
      </div>

      {/* Current Distribution */}
      {distTotal > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Current Distribution ({totalScored} scored)
          </h3>
          <div className="flex gap-1 h-6 rounded-lg overflow-hidden mb-2">
            {["healthy", "cooling", "at_risk", "ghost", "churned"].map((level) => {
              const entry = distribution.find((d) => d.risk_level === level);
              const pct = entry ? (entry.count / distTotal) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={level}
                  className={`${RISK_COLORS[level]} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${RISK_LABELS[level]}: ${entry?.count} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {["healthy", "cooling", "at_risk", "ghost", "churned"].map((level) => {
              const entry = distribution.find((d) => d.risk_level === level);
              return (
                <span key={level} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${RISK_COLORS[level]}`} />
                  {RISK_LABELS[level]}: {entry?.count || 0}
                  {entry?.avg_score ? ` (avg ${entry.avg_score})` : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Error / Feedback */}
      {error && <div className="bg-danger/10 text-danger text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
      {feedback && <div className="bg-success/10 text-success text-sm rounded-lg px-4 py-2 mb-4">{feedback}</div>}

      {/* ── Section: Component Weights ── */}
      <CollapsibleSection
        title={descriptions?.weights?.title || "Component Weights"}
        description={descriptions?.weights?.description}
        isOpen={openSections.weights}
        onToggle={() => toggleSection("weights")}
        badge={totalWeight !== 100 ? `${totalWeight}% — must be 100%` : undefined}
        badgeColor={totalWeight !== 100 ? "text-danger" : undefined}
      >
        {(["attendance", "communication", "progression", "community", "financial"] as const).map((key) => (
          <div key={key} className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium capitalize">{key}</label>
              <span className="text-sm font-mono text-accent">{Math.round(config.weights[key] * 100)}%</span>
            </div>
            <input
              type="range"
              min={0} max={100} step={5}
              value={Math.round(config.weights[key] * 100)}
              onChange={(e) => updateWeight(key, parseInt(e.target.value))}
              className="w-full accent-accent"
            />
            <p className="text-[11px] text-muted mt-0.5">{descriptions?.weights?.fields?.[key]}</p>
          </div>
        ))}
      </CollapsibleSection>

      {/* ── Section: Risk Level Thresholds ── */}
      <CollapsibleSection
        title={descriptions?.riskLevels?.title || "Risk Level Thresholds"}
        description={descriptions?.riskLevels?.description}
        isOpen={openSections.riskLevels}
        onToggle={() => toggleSection("riskLevels")}
      >
        {(["healthy", "cooling", "atRisk", "ghost"] as const).map((key) => {
          const label = key === "atRisk" ? "At Risk" : key.charAt(0).toUpperCase() + key.slice(1);
          const color = key === "healthy" ? "text-green-400" : key === "cooling" ? "text-yellow-400" : key === "atRisk" ? "text-orange-400" : "text-red-400";
          return (
            <div key={key} className="flex items-center gap-3 mb-3">
              <span className={`text-sm font-medium w-20 ${color}`}>{label}</span>
              <span className="text-xs text-muted">Score &ge;</span>
              <input
                type="number" min={0} max={100}
                value={config.riskLevels[key]}
                onChange={(e) => updateRiskLevel(key, parseInt(e.target.value) || 0)}
                className="w-16 bg-background border border-border rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-accent/50"
              />
              <p className="text-[11px] text-muted flex-1">{descriptions?.riskLevels?.fields?.[key]}</p>
            </div>
          );
        })}
        <p className="text-[11px] text-muted mt-1">Below the Ghost threshold = Churned</p>
      </CollapsibleSection>

      {/* ── Section: Attendance ── */}
      <CollapsibleSection
        title={descriptions?.attendance?.title || "Attendance"}
        description={descriptions?.attendance?.description}
        dataSource={descriptions?.attendance?.dataSource}
        isOpen={openSections.attendance}
        onToggle={() => toggleSection("attendance")}
      >
        <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Recency — Days Since Last Class (weight: {Math.round(config.attendance.recencyWeight * 100)}%)
        </h4>
        <p className="text-[11px] text-muted mb-2">{descriptions?.attendance?.sections?.recency}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {config.attendance.recency.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted w-8">&le;</span>
              <input type="number" min={0} value={tier.max}
                onChange={(e) => updateTier("attendance", "recency", i, "max", parseInt(e.target.value) || 0)}
                className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">days →</span>
              <input type="number" min={0} max={100} value={tier.score}
                onChange={(e) => updateTier("attendance", "recency", i, "score", parseInt(e.target.value) || 0)}
                className="w-14 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">pts</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted mb-3">Beyond the last tier = 0 points</p>

        <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Volume — Classes per Month (weight: {Math.round(config.attendance.volumeWeight * 100)}%)
        </h4>
        <p className="text-[11px] text-muted mb-2">{descriptions?.attendance?.sections?.volume}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {config.attendance.volume.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted w-8">&ge;</span>
              <input type="number" min={0} value={tier.min}
                onChange={(e) => updateTier("attendance", "volume", i, "min", parseInt(e.target.value) || 0)}
                className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">/mo →</span>
              <input type="number" min={0} max={100} value={tier.score}
                onChange={(e) => updateTier("attendance", "volume", i, "score", parseInt(e.target.value) || 0)}
                className="w-14 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">pts</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-muted">Default target classes/month:</label>
          <input type="number" min={1} value={config.attendance.defaultTargetPerMonth}
            onChange={(e) => updateNested("attendance", "defaultTargetPerMonth", parseInt(e.target.value) || 12)}
            className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
          />
        </div>
      </CollapsibleSection>

      {/* ── Section: Communication ── */}
      <CollapsibleSection
        title={descriptions?.communication?.title || "Communication"}
        description={descriptions?.communication?.description}
        dataSource={descriptions?.communication?.dataSource}
        warning={descriptions?.communication?.warning}
        isOpen={openSections.communication}
        onToggle={() => toggleSection("communication")}
      >
        <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Reply Speed (weight: {Math.round(config.communication.replyWeight * 100)}%)
        </h4>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {config.communication.replyTime.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted w-8">&le;</span>
              <input type="number" min={0} value={tier.max}
                onChange={(e) => updateTier("communication", "replyTime", i, "max", parseInt(e.target.value) || 0)}
                className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">hrs →</span>
              <input type="number" min={0} max={100} value={tier.score}
                onChange={(e) => updateTier("communication", "replyTime", i, "score", parseInt(e.target.value) || 0)}
                className="w-14 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">pts</span>
            </div>
          ))}
        </div>

        <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Inbound Messages (weight: {Math.round(config.communication.initiatedWeight * 100)}%)
        </h4>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {config.communication.inboundCount.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted w-8">&ge;</span>
              <input type="number" min={0} value={tier.min}
                onChange={(e) => updateTier("communication", "inboundCount", i, "min", parseInt(e.target.value) || 0)}
                className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">msgs →</span>
              <input type="number" min={0} max={100} value={tier.score}
                onChange={(e) => updateTier("communication", "inboundCount", i, "score", parseInt(e.target.value) || 0)}
                className="w-14 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">pts</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-muted">Neutral default score (no MM link):</label>
          <input type="number" min={0} max={100} value={config.communication.neutralDefault}
            onChange={(e) => updateNested("communication", "neutralDefault", parseInt(e.target.value) || 50)}
            className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
          />
        </div>
      </CollapsibleSection>

      {/* ── Section: Progression ── */}
      <CollapsibleSection
        title={descriptions?.progression?.title || "Progression"}
        description={descriptions?.progression?.description}
        dataSource={descriptions?.progression?.dataSource}
        isOpen={openSections.progression}
        onToggle={() => toggleSection("progression")}
      >
        <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Expected Months per Belt</h4>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(config.progression.beltExpectedMonths).map(([belt, months]) => (
            <div key={belt} className="flex items-center gap-2">
              <span className="text-xs font-medium capitalize w-14">{belt}</span>
              <input type="number" min={0} value={months}
                onChange={(e) => updateNested("progression", "beltExpectedMonths", {
                  ...config.progression.beltExpectedMonths, [belt]: parseInt(e.target.value) || 0,
                })}
                className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">months</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted">Technique categories total:</label>
          <input type="number" min={1} value={config.progression.totalCategories}
            onChange={(e) => updateNested("progression", "totalCategories", parseInt(e.target.value) || 9)}
            className="w-16 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
          />
        </div>
      </CollapsibleSection>

      {/* ── Section: Community ── */}
      <CollapsibleSection
        title={descriptions?.community?.title || "Community"}
        description={descriptions?.community?.description}
        dataSource={descriptions?.community?.dataSource}
        warning={descriptions?.community?.warning}
        isOpen={openSections.community}
        onToggle={() => toggleSection("community")}
      >
        <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Channel Memberships (weight: {Math.round(config.community.membershipWeight * 100)}%)
        </h4>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {config.community.channelTiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted w-8">&ge;</span>
              <input type="number" min={0} value={tier.min}
                onChange={(e) => updateTier("community", "channelTiers", i, "min", parseInt(e.target.value) || 0)}
                className="w-14 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">→</span>
              <input type="number" min={0} max={100} value={tier.score}
                onChange={(e) => updateTier("community", "channelTiers", i, "score", parseInt(e.target.value) || 0)}
                className="w-14 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">pts</span>
            </div>
          ))}
        </div>

        <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Messages/30d (weight: {Math.round(config.community.activityWeight * 100)}%)
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {config.community.messageTiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted w-8">&ge;</span>
              <input type="number" min={0} value={tier.min}
                onChange={(e) => updateTier("community", "messageTiers", i, "min", parseInt(e.target.value) || 0)}
                className="w-14 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">→</span>
              <input type="number" min={0} max={100} value={tier.score}
                onChange={(e) => updateTier("community", "messageTiers", i, "score", parseInt(e.target.value) || 0)}
                className="w-14 bg-background border border-border rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-accent/50"
              />
              <span className="text-xs text-muted">pts</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Section: Risk Factor Triggers ── */}
      <CollapsibleSection
        title={descriptions?.riskFactors?.title || "Risk Factor Triggers"}
        description={descriptions?.riskFactors?.description}
        isOpen={openSections.riskFactors}
        onToggle={() => toggleSection("riskFactors")}
      >
        {([
          ["ghostDays", "Ghost label after"],
          ["warningDays", "Warning after"],
          ["noticeDays", "Notice after"],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3 mb-3">
            <span className="text-sm w-36">{label}</span>
            <input type="number" min={1} value={config.riskFactors[key]}
              onChange={(e) => updateNested("riskFactors", key, parseInt(e.target.value) || 1)}
              className="w-16 bg-background border border-border rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-accent/50"
            />
            <span className="text-xs text-muted">days absent</span>
          </div>
        ))}
        {([
          ["lowAttendanceThreshold", "\"Very low attendance\" below"],
          ["decliningAttendanceThreshold", "\"Declining trend\" below"],
          ["lowProgressionThreshold", "\"Limited technique\" below"],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3 mb-3">
            <span className="text-sm w-36">{label}</span>
            <input type="number" min={0} max={100} value={config.riskFactors[key]}
              onChange={(e) => updateNested("riskFactors", key, parseInt(e.target.value) || 0)}
              className="w-16 bg-background border border-border rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-accent/50"
            />
            <span className="text-xs text-muted">component score</span>
          </div>
        ))}
      </CollapsibleSection>

      {/* ── Action Bar ── */}
      <div className="sticky bottom-0 bg-background border-t border-border py-4 mt-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between z-10">
        <button
          onClick={resetToDefaults}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          Reset to defaults
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => save(false)}
            disabled={saving || rescoring || totalWeight !== 100}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:border-accent/40 transition-colors disabled:opacity-30"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || rescoring || totalWeight !== 100}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-30"
          >
            {rescoring ? "Re-scoring..." : "Save & Re-score All"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Collapsible Section Component ----

function CollapsibleSection({
  title, description, dataSource, warning, badge, badgeColor, isOpen, onToggle, children,
}: {
  title: string;
  description?: string;
  dataSource?: string;
  warning?: string;
  badge?: string;
  badgeColor?: string;
  isOpen?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border border-border mb-3 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-card-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {badge && <span className={`text-[10px] font-medium ${badgeColor || "text-muted"}`}>{badge}</span>}
        </div>
        <svg className={`w-4 h-4 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3">
          {description && <p className="text-xs text-muted mb-3">{description}</p>}
          {dataSource && (
            <p className="text-[10px] text-accent/70 mb-2">Data source: {dataSource}</p>
          )}
          {warning && (
            <div className="bg-warning/10 text-warning text-[11px] rounded-lg px-3 py-2 mb-3">
              {warning}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
