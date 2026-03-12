"use client";

interface MonthlyTrend {
  month: string;
  paid: number;
  classes: number;
  cost_per_class: number | null;
}

interface CostTrendData {
  months: MonthlyTrend[];
  recent_cpc: number | null;
  prior_cpc: number | null;
  trend_pct: number | null;
}

interface CostSparklineProps {
  trend: CostTrendData;
  threshold: number;
  width?: number;
  height?: number;
}

export default function CostSparkline({
  trend,
  threshold,
  width = 80,
  height = 24,
}: CostSparklineProps) {
  // Reverse to chronological order (API returns newest first)
  const data = [...trend.months].reverse();
  const values = data
    .map((m) => m.cost_per_class)
    .filter((v): v is number => v != null);

  if (values.length < 2) return null;

  const max = Math.max(...values, threshold);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * innerW;
    const y = padding + innerH - ((v - min) / range) * innerH;
    return `${x},${y}`;
  });

  // Threshold line
  const threshY = padding + innerH - ((threshold - min) / range) * innerH;

  // Color based on trend direction
  const trendUp = trend.trend_pct != null && trend.trend_pct > 0;
  const strokeColor = trendUp ? "var(--color-danger, #ef4444)" : "var(--color-success, #22c55e)";

  return (
    <div className="inline-flex items-center gap-1.5">
      <svg
        width={width}
        height={height}
        className="flex-shrink-0"
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Threshold line */}
        <line
          x1={padding}
          y1={threshY}
          x2={width - padding}
          y2={threshY}
          stroke="var(--color-danger, #ef4444)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
          opacity="0.4"
        />
        {/* Sparkline */}
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].split(",")[0]}
            cy={points[points.length - 1].split(",")[1]}
            r="2"
            fill={strokeColor}
          />
        )}
      </svg>
      {/* Trend arrow + percentage */}
      {trend.trend_pct != null && (
        <span
          className={`text-[9px] font-semibold ${
            trendUp ? "text-danger" : "text-success"
          }`}
          title={`${trend.trend_pct > 0 ? "+" : ""}${trend.trend_pct}% vs prior 3 months`}
        >
          {trendUp ? "\u2191" : "\u2193"}
          {Math.abs(trend.trend_pct)}%
        </span>
      )}
    </div>
  );
}
