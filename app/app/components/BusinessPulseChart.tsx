"use client";

import { useMemo, useState } from "react";

export type PulsePoint = {
  label: string;
  revenueCents: number;
  expenseCents: number;
  profitCents: number;
};

type RangeKey = "wtd" | "mtd" | "ytd" | "all";
type MetricKey = "profit" | "revenue" | "expenses";

type Props = {
  points: PulsePoint[];
  activeJobs: number;
  totalJobs: number;
  title?: string;
  subtitle?: string;
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

function svgPath(values: number[], width: number, height: number) {
  if (!values.length) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function BusinessPulseChart({
  points,
  activeJobs,
  totalJobs,
  title = "Business pulse",
  subtitle = "Simple, trust-first trendline from your real data.",
}: Props) {
  const [metric, setMetric] = useState<MetricKey>("profit");

  const values = useMemo(() => {
    return points.map((p) => {
      if (metric === "revenue") return Number(p.revenueCents || 0);
      if (metric === "expenses") return Number(p.expenseCents || 0);
      return Number(p.profitCents || 0);
    });
  }, [points, metric]);

  const path = useMemo(() => svgPath(values, 100, 44), [values]);
  const total = useMemo(() => sumMetric(points, metric), [points, metric]);

  const latest = values.length ? values[values.length - 1] : 0;
  const earliest = values.length ? values[0] : 0;
  const delta = latest - earliest;

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Overview</div>
          <h2 className="mt-2 text-xl font-semibold text-white/95">{title}</h2>
          <div className="mt-2 text-sm text-white/60">{subtitle}</div>
        </div>

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
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">
            Current range
          </div>
          <div className="mt-2 text-2xl font-semibold text-white/95">{moneyFromCents(total)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Last point</div>
          <div className="mt-2 text-2xl font-semibold text-white/95">{moneyFromCents(latest)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Change</div>
          <div className="mt-2 text-2xl font-semibold text-white/95">{moneyFromCents(delta)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Active jobs</div>
          <div className="mt-2 text-2xl font-semibold text-white/95">
            {activeJobs}
            <span className="ml-2 text-sm font-medium text-white/45">/ {totalJobs}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        {points.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-white/50">
            No transaction data yet.
          </div>
        ) : (
          <>
            <div className="h-[240px] w-full">
              <svg
                viewBox="0 0 100 44"
                preserveAspectRatio="none"
                className="h-full w-full"
                aria-label="Business pulse chart"
              >
                {[10, 22, 34].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="100"
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="0.6"
                  />
                ))}

                <path
                  d={path}
                  fill="none"
                  stroke="white"
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