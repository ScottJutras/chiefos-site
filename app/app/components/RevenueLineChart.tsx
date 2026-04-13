"use client";

import { useMemo, useState, useRef, useCallback, useId } from "react";

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
const GLOW_COLOR: Record<MetricKey, string> = {
  revenue: "rgba(212,168,83,0.6)",
  expenses: "rgba(248,113,113,0.6)",
  profit: "rgba(52,211,153,0.6)",
};
const GRAD_TOP: Record<MetricKey, string> = {
  revenue: "rgba(212,168,83,0.30)",
  expenses: "rgba(248,113,113,0.30)",
  profit: "rgba(52,211,153,0.30)",
};

type Props = {
  txRows: RevenueChartRow[];
  accountCreatedAt: string | null;
  country: string | null;
  loading?: boolean;
  range?: RangeKey;
  onRangeChange?: (r: RangeKey) => void;
  metric?: MetricKey;
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
  return `${prefix}${sym}${d.toFixed(2)}`;
}

function fmtMoneyFull(cents: number, sym: string): string {
  const d = Math.abs(cents) / 100;
  const prefix = cents < 0 ? "-" : "";
  return `${prefix}${sym}${d.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

/** Catmull-Rom → cubic bezier smooth path */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} L ${pts[1].x.toFixed(2)} ${pts[1].y.toFixed(2)}`;
  }
  const tension = 0.4;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

const SVG_W = 600;
const SVG_H = 160;

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
  const uid = useId().replace(/:/g, "");
  const [internalRange, setInternalRange] = useState<RangeKey>("all");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; svgX: number; cents: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

    let map: Map<string, number>;
    if (activeMetric === "revenue") {
      map = revMap;
    } else if (activeMetric === "expenses") {
      map = expMap;
    } else {
      const allDays = new Set([...revMap.keys(), ...expMap.keys()]);
      map = new Map();
      for (const k of allDays) map.set(k, (revMap.get(k) || 0) - (expMap.get(k) || 0));
    }

    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    const values = sorted.map(([, v]) => v);
    const rawMin = Math.min(0, ...(values.length ? values : [0]));
    const rawMax = Math.max(0, ...(values.length ? values : [0]));
    const pad = (rawMax - rawMin) * 0.18 || 5_000;
    const yMin = rawMin < 0 ? rawMin - pad : 0;
    const yMax = rawMax > 0 ? rawMax + pad : 50_000;
    const yRange = yMax - yMin;

    function xAt(key: string): number {
      return span === 0 ? SVG_W / 2 : (daysBetween(startKey, key) / span) * SVG_W;
    }
    function yAt(cents: number): number {
      return SVG_H * (1 - (cents - yMin) / yRange);
    }

    const pts = sorted.map(([k, v]) => ({ x: xAt(k), y: yAt(v), key: k, cents: v }));

    const linePath = pts.length >= 2 ? smoothPath(pts) : "";
    const baselineY = yAt(0);

    let areaPath = "";
    if (pts.length >= 2) {
      areaPath =
        `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} ` +
        `L ${pts[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
    }

    const yLabels = [1, 0.75, 0.5, 0.25, 0].map((f) =>
      fmtMoney(Math.round(yMin + yRange * f), sym)
    );

    const xLabels = Array.from({ length: 5 }, (_, i) => {
      const offset = Math.round((i / 4) * span);
      return shortDate(addDays(startKey, offset));
    });

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: (SVG_H * f).toFixed(2),
      strong: f === 0 || f === 1,
    }));

    const zeroLineY = yMin < 0 ? baselineY : null;

    const latestCents = pts.length ? pts[pts.length - 1].cents : 0;
    const firstCents = pts.length ? pts[0].cents : 0;
    const pctChange = firstCents !== 0 ? ((latestCents - firstCents) / Math.abs(firstCents)) * 100 : null;
    const latestPt = pts.length ? pts[pts.length - 1] : null;

    return {
      linePath, areaPath, yLabels, xLabels, gridLines,
      zeroLineY, hasData: map.size > 0,
      latestCents, pctChange, latestPt, pts,
      yAt, xAt, startKey, span, yMin, yRange,
    };
  }, [txRows, accountCreatedAt, activeRange, activeMetric, sym]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !chart.pts.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_W;

    // Find nearest data point by x distance
    let nearest = chart.pts[0];
    let minDist = Math.abs(nearest.x - svgX);
    for (const pt of chart.pts) {
      const d = Math.abs(pt.x - svgX);
      if (d < minDist) { minDist = d; nearest = pt; }
    }

    const screenX = (nearest.x / SVG_W) * rect.width + rect.left;
    const screenY = (nearest.y / SVG_H) * rect.height + rect.top;
    setTooltip({
      x: screenX - rect.left,
      y: screenY - rect.top,
      svgX: nearest.x,
      cents: nearest.cents,
      label: shortDate(nearest.key),
    });
  }, [chart.pts]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (loading) {
    return (
      <div className={compact ? "" : "relative overflow-hidden rounded-[28px] border border-[var(--gold-border)] bg-[#0a0a0a] p-5"}>
        <div className="flex h-[180px] items-center justify-center">
          <span className="text-xs text-white/30">Loading&#x2026;</span>
        </div>
      </div>
    );
  }

  const lineColor = LINE_COLOR[activeMetric];
  const glowColor = GLOW_COLOR[activeMetric];
  const gradTop = GRAD_TOP[activeMetric];
  const pct = chart.pctChange;
  const pctUp = pct !== null && pct > 0;
  const pctDown = pct !== null && pct < 0;

  return (
    <div className={compact ? "" : "relative overflow-hidden rounded-[28px] border border-[var(--gold-border)] bg-[#0a0a0a] p-5"}>
      {/* Gold top accent line — standalone only */}
      {!compact && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(212,168,83,0.5) 50%, transparent)" }}
        />
      )}

      {/* Standalone header */}
      {!compact && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
              {activeMetric === "revenue" ? "Revenue" : activeMetric === "expenses" ? "Expenses" : "Profit"} &bull; {code}
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl font-bold tracking-tight text-white/95">
                {fmtMoneyFull(chart.latestCents, sym)}
              </span>
              {pct !== null && (
                <span className={[
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  pctUp ? "bg-emerald-500/15 text-emerald-400" : pctDown ? "bg-red-500/15 text-red-400" : "bg-white/10 text-white/50",
                ].join(" ")}>
                  {pctUp ? "+" : ""}{pct.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-white/30">
              {activeRange === "all" ? "from account creation" : `filtered by range`} &bull; most recent value
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
        <div className="flex shrink-0 flex-col justify-between" style={{ width: 38 }}>
          {chart.yLabels.map((label, i) => (
            <span key={i} className="text-right text-[9px] leading-none text-white/25">
              {label}
            </span>
          ))}
        </div>

        {/* SVG + X labels */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Dark chart panel */}
          <div className="relative rounded-xl bg-black/50 ring-1 ring-white/5" style={{ height: 160 }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              preserveAspectRatio="none"
              className="h-full w-full cursor-crosshair"
              aria-label="Chart"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {/* Area gradient */}
                <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={gradTop} />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </linearGradient>
                {/* Glow filter for line */}
                <filter id={`glow-${uid}`} x="-20%" y="-60%" width="140%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid lines */}
              {chart.gridLines.map(({ y, strong }) => (
                <line key={y} x1="0" y1={y} x2={SVG_W} y2={y}
                  stroke={strong ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}
                  strokeWidth="1" />
              ))}

              {/* Zero baseline for profit metric */}
              {chart.zeroLineY !== null && (
                <line x1="0" y1={chart.zeroLineY.toFixed(2)} x2={SVG_W} y2={chart.zeroLineY.toFixed(2)}
                  stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4 4" />
              )}

              {/* Tooltip crosshair vertical line */}
              {tooltip && (
                <line
                  x1={tooltip.svgX.toFixed(2)} y1="0"
                  x2={tooltip.svgX.toFixed(2)} y2={SVG_H}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}

              {/* Area fill */}
              {chart.areaPath && (
                <path d={chart.areaPath} fill={`url(#grad-${uid})`} />
              )}

              {/* Glow copy of line (blurred) */}
              {chart.linePath && (
                <path d={chart.linePath} fill="none"
                  stroke={glowColor}
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{ filter: `blur(4px)` }}
                />
              )}

              {/* Main crisp line */}
              {chart.linePath && (
                <path d={chart.linePath} fill="none" stroke={lineColor}
                  strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              )}

              {/* Pulsing dot at latest data point */}
              {chart.latestPt && chart.hasData && (
                <>
                  {/* Outer pulse ring */}
                  <circle
                    cx={chart.latestPt.x.toFixed(2)}
                    cy={chart.latestPt.y.toFixed(2)}
                    r="6"
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="1.5"
                    opacity="0.5"
                  >
                    <animate attributeName="r" values="4;10;4" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  {/* Inner solid dot */}
                  <circle
                    cx={chart.latestPt.x.toFixed(2)}
                    cy={chart.latestPt.y.toFixed(2)}
                    r="3.5"
                    fill={lineColor}
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth="1.5"
                  />
                </>
              )}

              {/* Tooltip dot highlight */}
              {tooltip && (
                <circle
                  cx={tooltip.svgX.toFixed(2)}
                  cy={(() => {
                    const pt = chart.pts.find(p => Math.abs(p.x - tooltip.svgX) < 0.1);
                    return pt ? pt.y.toFixed(2) : "0";
                  })()}
                  r="4"
                  fill={lineColor}
                  stroke="white"
                  strokeWidth="1.5"
                />
              )}
            </svg>

            {/* HTML tooltip overlay */}
            {tooltip && (
              <div
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 shadow-xl"
                style={{ left: tooltip.x, top: tooltip.y - 12 }}
              >
                <div className="text-[11px] font-semibold" style={{ color: lineColor }}>
                  {fmtMoneyFull(tooltip.cents, sym)}
                </div>
                <div className="mt-0.5 text-[9px] text-white/40">{tooltip.label}</div>
              </div>
            )}
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between">
            {chart.xLabels.map((label, i) => (
              <span key={i} className="text-[9px] leading-none text-white/20">{label}</span>
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
