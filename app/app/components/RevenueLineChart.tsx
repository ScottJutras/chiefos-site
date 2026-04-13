"use client";

import { useMemo, useState } from "react";

export type RevenueChartRow = {
  date: string | null;
  created_at: string | null;
  amount_cents: number | null;
  kind: string | null;
};

export type RangeKey = "wtd" | "mtd" | "qtd" | "ytd" | "all";
export type MetricKey = "revenue" | "expenses" | "profit";

const RANGE_LABELS: Record<RangeKey, string> = {
  wtd: "WTD",
  mtd: "MTD",
  qtd: "QTD",
  ytd: "YTD",
  all: "All",
};

const LINE_COLOR: Record<MetricKey, string> = {
  revenue: "#D4A853",
  expenses: "#f87171",
  profit: "#34d399",
};
const AREA_COLOR: Record<MetricKey, string> = {
  revenue: "rgba(212,168,83,0.08)",
  expenses: "rgba(248,113,113,0.08)",
  profit: "rgba(52,211,153,0.08)",
};

type Props = {
  txRows: RevenueChartRow[];
  accountCreatedAt: string | null;
  country: string | null;
  loading?: boolean;
  /** External range — hides internal toggle buttons when provided */
  range?: RangeKey;
  onRangeChange?: (r: RangeKey) => void;
  /** Which metric to chart */
  metric?: MetricKey;
  /** Compact mode: hides the standalone card header (use when embedded) */
  compact?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIsoDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function addDays(s: string, n: number): string {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function shortDate(s: string): string {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtMoney(cents: number, sym: string): string {
  const d = Math.abs(cents) / 100;
  const prefix = cents < 0 ? "-" : "";
  if (d >= 10_000) return `${prefix}${sym}${Math.round(d / 1_000)}k`;
  if (d >= 1_000) return `${prefix}${sym}${(d / 1_000).toFixed(1)}k`;
  return `${prefix}${sym}${Math.round(d)}`;
}

function rangeStartKey(range: RangeKey): string | null {
  if (range === "all") return null;
  const now = new Date();
  let d: Date;
  if (range === "wtd") {
    d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  } else if (range === "mtd") {
    d = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === "qtd") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    d = new Date(now.getFullYear(), q, 1);
  } else {
    d = new Date(now.getFullYear(), 0, 1);
  }
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

const SVG_W = 100;
const SVG_H = 44;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RevenueLineChart({
  txRows,
  accountCreatedAt,
  country,
  loading,
  range: externalRange,
  onRangeChange,
  metric: externalMetric,
  compact = false,
}: Props) {
  const [internalRange, setInternalRange] = useState<RangeKey>("all");

  const activeRange = externalRange !== undefined ? externalRange : internalRange;
  const handleRange = onRangeChange ?? setInternalRange;
  const showToggles = onRangeChange === undefined;

  const activeMetric: MetricKey = externalMetric ?? "revenue";

  const sym = country === "CA" ? "CA$" : "$";
  const code = country === "CA" ? "CAD" : "USD";

  const chart = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const rStart = rangeStartKey(activeRange);
    const rawAccount = toIsoDate(accountCreatedAt);
    const accountStart = rawAccount && rawAccount <= today ? rawAccount : today;
    const startKey = rStart ?? accountStart;
    const endKey = today;
    const span = daysBetween(startKey, endKey);

    // Bucket revenue and expenses separately
    const revMap = new Map<string, number>();
    const expMap = new Map<string, number>();
    for (const row of txRows) {
      const k = toIsoDate(row.date || row.created_at);
      if (!k || k < startKey || k > endKey) continue;
      const kind = String(row.kind || "").toLowerCase();
      const cents = Number(row.amount_cents || 0);
      if (kind === "revenue") revMap.set(k, (revMap.get(k) || 0) + cents);
      else if (kind === "expense") expMap.set(k, (expMap.get(k) || 0) + cents);
    }

    // Select active metric map
    let map: Map<string, number>;
    if (activeMetric === "revenue") {
      map = revMap;
    } else if (activeMetric === "expenses") {
      map = expMap;
    } else {
      // profit = revenue − expenses per day
      const allDays = new Set([...revMap.keys(), ...expMap.keys()]);
      map = new Map();
      for (const k of allDays) map.set(k, (revMap.get(k) || 0) - (expMap.get(k) || 0));
    }

    const values = Array.from(map.values());
    const rawMin = Math.min(0, ...(values.length ? values : [0]));
    const rawMax = Math.max(0, ...(values.length ? values : [0]));
    const pad = (rawMax - rawMin) * 0.15 || 5_000;
    const yMin = rawMin < 0 ? rawMin - pad : 0;
    const yMax = rawMax > 0 ? rawMax + pad : 50_000;
    const yRange = yMax - yMin;

    function xAt(key: string): number {
      return span === 0 ? SVG_W / 2 : (daysBetween(startKey, key) / span) * SVG_W;
    }
    function yAt(cents: number): number {
      return SVG_H * (1 - (cents - yMin) / yRange);
    }

    const pts = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ x: xAt(k), y: yAt(v) }));

    let linePath = "";
    let areaPath = "";
    const baselineY = yAt(0);
    if (pts.length >= 2) {
      linePath =
        `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} ` +
        pts.slice(1).map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
      areaPath =
        `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} ` +
        `L ${pts[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
    } else if (pts.length === 1) {
      const py = pts[0].y.toFixed(2);
      linePath = `M ${Math.max(0, pts[0].x - 3).toFixed(2)} ${py} L ${Math.min(SVG_W, pts[0].x + 3).toFixed(2)} ${py}`;
    }

    // Y-axis labels (5 ticks, top → bottom)
    const yLabels = [1, 0.75, 0.5, 0.25, 0].map((f) =>
      fmtMoney(Math.round(yMin + yRange * f), sym)
    );

    // X-axis labels (5 evenly spaced)
    const xLabels = Array.from({ length: 5 }, (_, i) => {
      const offset = Math.round((i / 4) * span);
      return shortDate(addDays(startKey, offset));
    });

    // Horizontal grid lines (0%, 25%, 50%, 75%, 100%)
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: (SVG_H * f).toFixed(2),
      strong: f === 0 || f === 1,
    }));

    // Zero line (only meaningful when profit has negative values)
    const zeroLineY = yMin < 0 ? baselineY : null;

    return {
      linePath, areaPath, yLabels, xLabels, gridLines,
      zeroLineY, hasData: map.size > 0,
    };
  }, [txRows, accountCreatedAt, activeRange, activeMetric, sym]);

  if (loading) {
    return (
      <div className={compact ? "" : "rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-5"}>
        <div className="flex h-[140px] items-center justify-center">
          <span className="text-xs text-white/30">Loading&#x2026;</span>
        </div>
      </div>
    );
  }

  const lineColor = LINE_COLOR[activeMetric];
  const areaColor = AREA_COLOR[activeMetric];

  return (
    <div className={compact ? "" : "rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-5"}>
      {/* Standalone header — hidden in compact/embedded mode */}
      {!compact && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Revenue</div>
            <h2 className="mt-1 text-lg font-semibold text-white/95">Revenue over time</h2>
            <div className="mt-0.5 text-xs text-white/40">
              {code} &#x2022; {activeRange === "all" ? "from account creation" : "filtered by range"}
            </div>
          </div>
          {showToggles && (
            <div className="flex flex-wrap gap-2">
              {(["wtd", "mtd", "qtd", "ytd", "all"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleRange(k)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    activeRange === k
                      ? "border-[var(--gold)] bg-[var(--gold)] text-black"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  ].join(" ")}
                >
                  {RANGE_LABELS[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chart body */}
      <div className="flex gap-2">
        {/* Y-axis labels */}
        <div className="flex shrink-0 flex-col justify-between" style={{ width: 36 }}>
          {chart.yLabels.map((label, i) => (
            <span key={i} className="text-right text-[9px] leading-none text-white/30">
              {label}
            </span>
          ))}
        </div>

        {/* SVG + X labels */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-[130px] w-full">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              preserveAspectRatio="none"
              className="h-full w-full"
              aria-label="Chart"
            >
              {/* Grid lines */}
              {chart.gridLines.map(({ y, strong }) => (
                <line key={y} x1="0" y1={y} x2={SVG_W} y2={y}
                  stroke={strong ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)"}
                  strokeWidth="0.5" />
              ))}

              {/* Zero baseline for profit metric */}
              {chart.zeroLineY !== null && (
                <line x1="0" y1={chart.zeroLineY.toFixed(2)} x2={SVG_W} y2={chart.zeroLineY.toFixed(2)}
                  stroke="rgba(255,255,255,0.20)" strokeWidth="0.6" />
              )}

              {/* Area fill */}
              {chart.areaPath && (
                <path d={chart.areaPath} fill={areaColor} />
              )}

              {/* Data line */}
              {chart.linePath && (
                <path d={chart.linePath} fill="none" stroke={lineColor}
                  strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
              )}
            </svg>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between">
            {chart.xLabels.map((label, i) => (
              <span key={i} className="text-[9px] leading-none text-white/25">{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!chart.hasData && (
        <p className="mt-3 text-center text-[10px] italic text-white/20">
          No {activeMetric} logged {activeRange === "all" ? "yet" : "in this range"} &#x2014; your line will appear as you log data
        </p>
      )}
    </div>
  );
}
