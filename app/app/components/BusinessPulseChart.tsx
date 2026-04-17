"use client";

import { useMemo, useState } from "react";
import RevenueLineChart, { type RevenueChartRow } from "@/app/app/components/RevenueLineChart";

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
  txRows?: RevenueChartRow[];
  country?: string | null;
  accountCreatedAt?: string | null;
};

function moneyFromCents(cents: number) {
  const abs = Math.abs(Number(cents || 0)) / 100;
  if (abs >= 1000) return "$" + (abs / 1000).toFixed(abs >= 10000 ? 0 : 1) + "k";
  return "$" + abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function moneyHero(cents: number) {
  const sign = cents < 0 ? "-" : cents > 0 ? "+" : "";
  return sign + "$" + (Math.abs(cents) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function sumMetric(points: PulsePoint[], metric: MetricKey) {
  return points.reduce((acc, p) => {
    if (metric === "revenue") return acc + Number(p.revenueCents || 0);
    if (metric === "expenses") return acc + Number(p.expenseCents || 0);
    return acc + Number(p.profitCents || 0);
  }, 0);
}

const RANGE_LABEL: Record<RangeKey, string> = {
  wtd: "Week",
  mtd: "Month",
  qtd: "Quarter",
  ytd: "Year",
  all: "All",
};

const METRIC_COLOR: Record<MetricKey, string> = {
  profit: "text-emerald-400",
  revenue: "text-[#D4A853]",
  expenses: "text-red-400",
};

export default function BusinessPulseChart({
  points,
  activeJobs,
  totalJobs,
  loading = false,
  range,
  onRangeChange,
  txRows = [],
  country = null,
  accountCreatedAt = null,
}: Props) {
  const [metric, setMetric] = useState<MetricKey>("profit");

  const total = useMemo(() => sumMetric(points, metric), [points, metric]);

  const values = useMemo(
    () => points.map((p) => {
      if (metric === "revenue") return Number(p.revenueCents || 0);
      if (metric === "expenses") return Number(p.expenseCents || 0);
      return Number(p.profitCents || 0);
    }),
    [points, metric]
  );

  const latest = values.length ? values[values.length - 1] : 0;
  const earliest = values.length ? values[0] : 0;
  const delta = values.length >= 2 ? latest - earliest : 0;
  const deltaPct = earliest !== 0 ? ((delta / Math.abs(earliest)) * 100) : 0;

  return (
    <section className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] overflow-hidden">
      {/* Hero header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {/* Metric selector — segmented control */}
              {(["profit", "revenue", "expenses"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  className={[
                    "text-xs font-semibold uppercase tracking-wider transition",
                    metric === m ? METRIC_COLOR[m] : "text-white/30 hover:text-white/50",
                  ].join(" ")}
                >
                  {m === "profit" ? "Profit" : m === "revenue" ? "Revenue" : "Expenses"}
                </button>
              ))}
            </div>

            {/* Hero number */}
            <div className={["text-4xl md:text-5xl font-bold tabular-nums tracking-tight", METRIC_COLOR[metric]].join(" ")}>
              {moneyHero(total)}
            </div>

            {/* Delta badge */}
            {values.length >= 2 && delta !== 0 && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className={[
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                  delta > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400",
                ].join(" ")}>
                  {delta > 0 ? "▲" : "▼"} {moneyFromCents(Math.abs(delta))}
                  {Math.abs(deltaPct) > 0.5 && ` (${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(0)}%)`}
                </span>
                <span className="text-xs text-white/30">vs start of period</span>
              </div>
            )}
          </div>

          {/* Range selector */}
          <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-0.5">
            {(["wtd", "mtd", "qtd", "ytd", "all"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onRangeChange(k)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  range === k ? "bg-white text-black" : "text-white/50 hover:text-white/80",
                ].join(" ")}
              >
                {RANGE_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart — taller, edge-to-edge */}
      <div className="px-2 pb-2">
        <RevenueLineChart
          txRows={txRows}
          accountCreatedAt={accountCreatedAt}
          country={country}
          loading={loading}
          range={range}
          onRangeChange={onRangeChange}
          metric={metric}
          compact
        />
      </div>
    </section>
  );
}
