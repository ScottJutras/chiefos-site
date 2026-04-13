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
  /** Raw transactions — powers the line chart inside the card */
  txRows?: RevenueChartRow[];
  country?: string | null;
  accountCreatedAt?: string | null;
};

function moneyFromCents(cents: number) {
  return (Math.abs(Number(cents || 0)) / 100).toLocaleString(undefined, {
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
  title = "Business performance pulse",
  subtitle = "Revenue, expenses, and profit — bucketed by day across your selected range.",
  loading = false,
  range,
  onRangeChange,
  txRows = [],
  country = null,
  accountCreatedAt = null,
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

  const total = useMemo(() => sumMetric(points, metric), [points, metric]);

  const latest = values.length ? values[values.length - 1] : 0;
  const earliest = values.length ? values[0] : 0;
  const delta = latest - earliest;

  return (
    <section className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-5">
      {/* Header */}
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
                    ? "border-[var(--gold)] bg-[var(--gold)] text-black"
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
                    ? "border-[var(--gold)] bg-[var(--gold)] text-black"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                ].join(" ")}
              >
                {RANGE_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI stat row */}
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
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Change (first &#x2192; last)</div>
          <div className={[
            "mt-2 text-2xl font-semibold",
            delta === 0 ? "text-white/95" : delta > 0 ? "text-emerald-400" : "text-red-400",
          ].join(" ")}>
            {delta > 0 ? "+" : ""}{moneyFromCents(delta)}
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

      {/* Line chart — responds to metric + range toggles */}
      <div className="mt-5">
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
