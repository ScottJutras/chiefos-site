"use client";

import { useMemo, useState } from "react";

export type PulsePoint = {
  label: string;
  revenueCents: number;
  expenseCents: number;
  profitCents: number;
};

export type RangeKey = "wtd" | "mtd" | "qtd" | "ytd" | "all";
type MetricKey = "profit" | "revenue" | "expenses";

type Props = {
  points: PulsePoint[];
  activeJobs: number;
  totalJobs: number;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
};

function moneyFromCents(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function sumMetric(points: PulsePoint[], metric: MetricKey) {
  return points.reduce((acc, p) => {
    if (metric === "revenue") return acc + Number(p.revenueCents || 0);
    if (metric === "expenses") return acc + Number(p.expenseCents || 0);
    return acc + Number(p.profitCents || 0);
  }, 0);
}

const SVG_W = 100;
const SVG_H = 44;
const PAD = 2; // vertical padding so the line doesn't clip at SVG edges

/**
 * Builds all SVG geometry from raw values.
 * Always anchors 0 in the visible range so the zero baseline is meaningful.
 */
function buildChartGeometry(values: number[]) {
  const dataMin = Math.min(0, ...values);
  const dataMax = Math.max(0, ...values);
  const range = dataMax - dataMin || 1;

  function toY(v: number) {
    return PAD + (SVG_H - 2 * PAD) * (1 - (v - dataMin) / range);
  }

  const zeroY = toY(0);

  // Grid y-positions at top, mid, zero, and bottom — deduplicated
  const seen = new Set<string>();
  const gridYs: Array<{ y: number; isZero: boolean }> = [];
  for (const v of [dataMax, (dataMax + dataMin) / 2, 0, dataMin]) {
    const y = toY(v);
    const key = y.toFixed(1);
    if (!seen.has(key)) {
      seen.add(key);
      gridYs.push({ y, isZero: Math.abs(v) < range * 0.01 });
    }
  }

  let path = "";
  if (values.length === 1) {
    // Single point: draw a short horizontal line at that value's y-position
    const y = toY(values[0]).toFixed(2);
    path = `M 10 ${y} L 90 ${y}`;
  } else if (values.length > 1) {
    path = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * SVG_W;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${toY(v).toFixed(2)}`;
      })
      .join(" ");
  }

  return { path, zeroY, gridYs };
}

// Per-metric line colors
const METRIC_COLOR: Record<MetricKey, string> = {
  revenue: "#34d399",  // emerald-400
  expenses: "#f87171", // red-400
  profit: "#ffffff",
};

const RANGE_LABEL: Record<RangeKey, string> = {
  wtd: "WTD",
  mtd: "MTD",
  qtd: "QTD",
  ytd: "YTD",
  all: "All",
};

const RANGE_TOTAL_LABEL: Record<RangeKey, string> = {
  wtd: "This week",
  mtd: "This month",
  qtd: "This quarter",
  ytd: "This year",
  all: "All time",
};

export default function BusinessPulseChart({
  points,
  activeJobs,
  totalJobs,
  title = "Business pulse",
  subtitle = "Simple, trust-first trendline from your real data.",
  loading = false,
  range,
  onRangeChange,
}: Props) {
  const [metric, setMetric] = useState<MetricKey>("profit");

  const values = useMemo(
    () =>
      points.map((p) => {
        if (metric === "revenue") return Number(p.revenueCents || 0);
        if (metric === "expenses") return Number(p.expenseCents || 0);
        return Number(p.profitCents || 0);
      }),
    [points, metric]
  );

  const { path, gridYs } = useMemo(() => buildChartGeometry(values), [values]);
  const total = useMemo(() => sumMetric(points, metric), [points, metric]);

  const latest = values.length ? values[values.length - 1] : 0;
  const earliest = values.length ? values[0] : 0;
  const delta = latest - earliest;

  const lineColor = METRIC_COLOR[metric];

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
      {/* Header: title + metric + range selectors together */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Overview</div>
          <h2 className="mt-2 text-xl font-semibold text-white/95">{title}</h2>
          <div className="mt-2 text-sm text-white/60">{subtitle}</div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Metric selector */}
          <div className="flex flex-wrap gap-2">
            {(["profit", "revenue", "expenses"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  metric === m
                    ? "border-white/20 bg-white text-black"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                ].join(" ")}
              >
                {m === "profit" ? "Profit" : m === "revenue" ? "Revenue" : "Expenses"}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10" aria-hidden />

          {/* Range selector */}
          <div className="flex flex-wrap gap-2">
            {(["wtd", "mtd", "qtd", "ytd", "all"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onRangeChange(k)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  range === k
                    ? "border-white/20 bg-white text-black"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                ].join(" ")}
              >
                {RANGE_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">
            {RANGE_TOTAL_LABEL[range]}
          </div>
          <div className="mt-2 text-2xl font-semibold text-white/95">{moneyFromCents(total)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Most recent day</div>
          <div className="mt-2 text-2xl font-semibold text-white/95">{moneyFromCents(latest)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Change (first → last)</div>
          <div
            className={[
              "mt-2 text-2xl font-semibold",
              delta === 0 ? "text-white/95" : delta > 0 ? "text-emerald-400" : "text-red-400",
            ].join(" ")}
          >
            {delta > 0 ? "+" : ""}
            {moneyFromCents(delta)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Active jobs</div>
          <div className="mt-2 text-2xl font-semibold text-white/95">
            {activeJobs}
            <span className="ml-2 text-sm font-medium text-white/45">/ {totalJobs}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        {loading ? (
          <div className="flex h-[240px] items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-white/50">
            No transaction data yet.
          </div>
        ) : (
          <>
            <div className="h-[240px] w-full">
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                preserveAspectRatio="none"
                className="h-full w-full"
                aria-label="Business pulse chart"
              >
                {/* Data-anchored grid lines — zero is solid/brighter, others are dashed */}
                {gridYs.map(({ y, isZero }, i) => (
                  <line
                    key={i}
                    x1="0"
                    x2={SVG_W}
                    y1={y.toFixed(2)}
                    y2={y.toFixed(2)}
                    stroke={isZero ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.07)"}
                    strokeWidth={isZero ? "0.6" : "0.5"}
                    strokeDasharray={isZero ? undefined : "2 2"}
                  />
                ))}

                {/* Data line — color reflects the active metric */}
                <path
                  d={path}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 overflow-hidden text-[11px] text-white/40">
              <span>{points[0]?.label || ""}</span>
              <span>{points[Math.floor(points.length / 2)]?.label || ""}</span>
              <span>{points[points.length - 1]?.label || ""}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
