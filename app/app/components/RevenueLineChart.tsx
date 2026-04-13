"use client";

import { useMemo } from "react";

export type RevenueChartRow = {
  date: string | null;
  created_at: string | null;
  amount_cents: number | null;
  kind: string | null;
};

type Props = {
  txRows: RevenueChartRow[];
  accountCreatedAt: string | null;
  country: string | null;
  loading?: boolean;
};

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
  const d = cents / 100;
  if (d >= 10_000) return `${sym}${Math.round(d / 1_000)}k`;
  if (d >= 1_000) return `${sym}${(d / 1_000).toFixed(1)}k`;
  return `${sym}${Math.round(d)}`;
}

const SVG_W = 100;
const SVG_H = 44;

export default function RevenueLineChart({ txRows, accountCreatedAt, country, loading }: Props) {
  const sym = country === "CA" ? "CA$" : "$";
  const code = country === "CA" ? "CAD" : "USD";

  const chart = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rawStart = toIsoDate(accountCreatedAt);
    const startKey = rawStart && rawStart <= today ? rawStart : today;
    const endKey = today;
    const span = daysBetween(startKey, endKey);

    const map = new Map<string, number>();
    for (const row of txRows) {
      if (String(row.kind || "").toLowerCase() !== "revenue") continue;
      const k = toIsoDate(row.date || row.created_at);
      if (!k || k < startKey || k > endKey) continue;
      map.set(k, (map.get(k) || 0) + Number(row.amount_cents || 0));
    }

    const maxCents = Math.max(0, ...Array.from(map.values()));
    const yMax = maxCents > 0 ? maxCents * 1.2 : 50_000;

    function xAt(key: string): number {
      return span === 0 ? SVG_W / 2 : (daysBetween(startKey, key) / span) * SVG_W;
    }
    function yAt(cents: number): number {
      return SVG_H * (1 - cents / yMax);
    }

    const pts = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ x: xAt(k), y: yAt(v) }));

    let linePath = "";
    let areaPath = "";
    if (pts.length >= 2) {
      linePath =
        `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} ` +
        pts.slice(1).map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
      areaPath =
        `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${SVG_H} ` +
        `L ${pts[0].x.toFixed(2)} ${SVG_H} Z`;
    } else if (pts.length === 1) {
      const py = pts[0].y.toFixed(2);
      linePath = `M ${Math.max(0, pts[0].x - 3).toFixed(2)} ${py} L ${Math.min(SVG_W, pts[0].x + 3).toFixed(2)} ${py}`;
    }

    // Y-axis labels: top (maxVal) to bottom (0)
    const yLabels = [1, 0.75, 0.5, 0.25, 0].map((f) =>
      fmtMoney(Math.round(yMax * f), sym)
    );

    // X-axis labels: 5 evenly spaced dates
    const xLabels = Array.from({ length: 5 }, (_, i) => {
      const offset = Math.round((i / 4) * span);
      return shortDate(addDays(startKey, offset));
    });

    // Horizontal grid lines at 0%, 25%, 50%, 75%, 100% of SVG_H
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: (SVG_H * f).toFixed(2),
      strong: f === 0 || f === 1,
    }));

    return { linePath, areaPath, yLabels, xLabels, gridLines, hasData: map.size > 0 };
  }, [txRows, accountCreatedAt, sym]);

  if (loading) {
    return (
      <div className="rounded-[20px] border border-white/8 bg-white/[0.02] px-4 py-5">
        <div className="flex h-[140px] items-center justify-center">
          <span className="text-xs text-white/30">Loading&#x2026;</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-[var(--gold-border)] bg-white/[0.03] p-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Revenue over time</div>
          <div className="mt-0.5 text-[10px] text-white/30">{code} &#x2022; account creation to today</div>
        </div>
        {!chart.hasData && (
          <span className="text-[10px] italic text-white/20">No data yet</span>
        )}
      </div>

      {/* Y labels + chart */}
      <div className="flex gap-2">
        {/* Y-axis labels — justify-between aligns with SVG grid (preserveAspectRatio=none fills full height) */}
        <div className="flex shrink-0 flex-col justify-between" style={{ width: 36 }}>
          {chart.yLabels.map((label, i) => (
            <span key={i} className="text-right text-[9px] leading-none text-white/30">
              {label}
            </span>
          ))}
        </div>

        {/* Chart + X-axis labels */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-[130px] w-full">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              preserveAspectRatio="none"
              className="h-full w-full"
              aria-label="Revenue line chart"
            >
              {/* Horizontal grid lines */}
              {chart.gridLines.map(({ y, strong }) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2={SVG_W}
                  y2={y}
                  stroke={strong ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)"}
                  strokeWidth="0.5"
                />
              ))}

              {/* Area fill under line */}
              {chart.areaPath && (
                <path d={chart.areaPath} fill="rgba(212,168,83,0.08)" />
              )}

              {/* Revenue line */}
              {chart.linePath && (
                <path
                  d={chart.linePath}
                  fill="none"
                  stroke="#D4A853"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between">
            {chart.xLabels.map((label, i) => (
              <span key={i} className="text-[9px] leading-none text-white/25">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!chart.hasData && (
        <p className="mt-2 text-center text-[10px] italic text-white/20">
          Your revenue line will appear here as you log data
        </p>
      )}
    </div>
  );
}
