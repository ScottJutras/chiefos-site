"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobRow = {
  id: number;
  job_no: number | null;
  job_name: string | null;
  name: string | null;
  status: string | null;
  active: boolean | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  material_budget_cents: number | null;
  labour_hours_budget: number | null;
  contract_value_cents: number | null;
};

type StatusKey = "active" | "paused" | "closed" | "other";

type TimeEntry = {
  job_no: number | null;
  type: string | null;
  timestamp: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeStatus(raw?: string | null, active?: boolean | null): StatusKey {
  const s = String(raw || "").trim().toLowerCase();
  if (active || s === "active" || s === "open" || s.includes("active")) return "active";
  if (s.includes("pause") || s.includes("hold")) return "paused";
  if (s.includes("closed") || s.includes("done") || s.includes("complete")) return "closed";
  return "other";
}

function statusDot(status: StatusKey) {
  switch (status) {
    case "active": return "bg-emerald-400";
    case "paused": return "bg-amber-400";
    case "closed": return "bg-white/30";
    default: return "bg-white/20";
  }
}

function statusLabel(status: StatusKey) {
  switch (status) {
    case "active": return "Active";
    case "paused": return "Paused";
    case "closed": return "Closed";
    default: return "Other";
  }
}

function formatDate(ts?: string | null) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(cents: number) {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  if (abs >= 100_000_00) return `${sign}$${Math.round(abs / 100_00) / 10}M`;
  if (abs >= 10_000_00) return `${sign}$${Math.round(abs / 100_0) / 10}k`;
  return `${sign}$${(abs / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtHours(h: number) {
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
}

/** Calculate gross work hours from raw time entry events */
function calcWorkHours(entries: TimeEntry[]): number {
  // Sort ascending
  const sorted = [...entries]
    .filter((e) => e.timestamp && e.type)
    .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());

  let totalMs = 0;
  let clockInAt: number | null = null;
  let breakStartAt: number | null = null;
  let lunchStartAt: number | null = null;
  let breakDeductMs = 0;
  let lunchDeductMs = 0;

  for (const e of sorted) {
    const ts = new Date(e.timestamp!).getTime();
    switch (e.type) {
      case "clock_in":
        clockInAt = ts;
        breakDeductMs = 0;
        lunchDeductMs = 0;
        breakStartAt = null;
        lunchStartAt = null;
        break;
      case "break_start":
        breakStartAt = ts;
        break;
      case "break_stop":
        if (breakStartAt !== null) {
          breakDeductMs += ts - breakStartAt;
          breakStartAt = null;
        }
        break;
      case "lunch_start":
        lunchStartAt = ts;
        break;
      case "lunch_end":
        if (lunchStartAt !== null) {
          lunchDeductMs += ts - lunchStartAt;
          lunchStartAt = null;
        }
        break;
      case "clock_out":
        if (clockInAt !== null) {
          const gross = ts - clockInAt;
          const net = Math.max(0, gross - breakDeductMs - lunchDeductMs);
          totalMs += net;
          clockInAt = null;
          breakDeductMs = 0;
          lunchDeductMs = 0;
        }
        break;
      default:
        break;
    }
  }

  return totalMs / (1000 * 60 * 60);
}

// ─── Life Bar ─────────────────────────────────────────────────────────────────

function LifeBar({
  label,
  actual,
  budget,
  unit,
  inverse = false,
}: {
  label: string;
  actual: number;
  budget: number | null;
  unit: "money" | "hours";
  inverse?: boolean;
}) {
  const actualStr = unit === "money" ? fmtMoney(actual) : fmtHours(actual);

  if (!budget) {
    if (actual === 0) return null;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</span>
          <span className="text-[10px] text-white/35">{actualStr} &mdash; no budget set</span>
        </div>
      </div>
    );
  }

  const ratio = budget > 0 ? actual / budget : 0;
  const pct = Math.round(ratio * 100);
  const barWidth = Math.min(ratio, 1); // cap visual at 100%
  const over = pct > 100;

  let barColor: string;
  if (inverse) {
    // Revenue: more collected = better
    if (pct >= 100) barColor = "bg-emerald-400";
    else if (pct >= 75) barColor = "bg-emerald-500";
    else if (pct >= 50) barColor = "bg-amber-400";
    else barColor = "bg-red-500";
  } else {
    // Cost/hours: lower = healthier
    if (pct >= 100) barColor = "bg-red-500";
    else if (pct >= 90) barColor = "bg-red-400";
    else if (pct >= 75) barColor = "bg-amber-400";
    else barColor = "bg-emerald-500";
  }

  const budgetStr = unit === "money" ? fmtMoney(budget) : fmtHours(budget);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</span>
        <span className="text-[10px] text-white/55">
          {actualStr} / {budgetStr}{" "}
          <span className={over ? "font-semibold text-red-400" : pct >= 75 ? "text-amber-300" : "text-white/40"}>
            {pct}%
          </span>
        </span>
      </div>
      {/* Track */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
        {/* Fill */}
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor} ${over ? "opacity-80" : ""}`}
          style={{ width: `${barWidth * 100}%` }}
        />
        {/* Over-budget spike beyond the bar */}
        {over && (
          <div className="absolute right-0 top-0 h-full w-0.5 bg-red-400 opacity-70" />
        )}
      </div>
    </div>
  );
}

// ─── Business Pulse ───────────────────────────────────────────────────────────

function BusinessPulse({
  jobs,
  expenses,
  revenue,
  labour,
}: {
  jobs: JobRow[];
  expenses: Record<number, number>;
  revenue: Record<number, number>;
  labour: Record<number, number>;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const activeJobs = jobs.filter((j) => normalizeStatus(j.status, j.active) === "active");

  const totalRevenue = Object.values(revenue).reduce((a, b) => a + b, 0);
  const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Aggregate budget totals (only jobs that have a budget set)
  const totalContractCents = jobs.reduce((a, j) => a + (j.contract_value_cents ?? 0), 0);
  const totalMaterialBudgetCents = jobs.reduce((a, j) => a + (j.material_budget_cents ?? 0), 0);
  const totalLabourBudgetHours = jobs.reduce((a, j) => a + (j.labour_hours_budget ?? 0), 0);
  const totalLabourHours = Object.values(labour).reduce((a, b) => a + b, 0);

  const hasRevenueBudget = totalContractCents > 0;
  const hasMaterialBudget = totalMaterialBudgetCents > 0;
  const hasLabourBudget = totalLabourBudgetHours > 0;

  // Jobs on track: active jobs where all bars with a budget are < 75%
  const onTrackCount = activeJobs.filter((j) => {
    const expPct = j.material_budget_cents ? (expenses[j.id] || 0) / j.material_budget_cents : 0;
    const revPct = j.contract_value_cents ? (revenue[j.id] || 0) / j.contract_value_cents : 1;
    const hrsPct = j.labour_hours_budget ? (labour[j.id] || 0) / j.labour_hours_budget : 0;
    return expPct < 0.75 && (j.contract_value_cents ? revPct >= 0 : true) && hrsPct < 0.75;
  }).length;

  const hasSomeData = totalRevenue > 0 || totalExpenses > 0 || totalLabourHours > 0;
  if (!hasSomeData && activeJobs.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03]">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
          Business Pulse
        </div>
        <span className="text-white/30 text-xs">{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-5">
          {/* KPI chips */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Active Jobs", value: String(activeJobs.length), color: "text-white/90" },
              { label: "Total Revenue", value: fmtMoney(totalRevenue), color: "text-emerald-400" },
              { label: "Total Expenses", value: fmtMoney(totalExpenses), color: "text-white/70" },
              {
                label: "Net Profit",
                value: (netProfit >= 0 ? "+" : "") + fmtMoney(netProfit),
                color: netProfit > 0 ? "text-emerald-400" : netProfit < 0 ? "text-red-400" : "text-white/50",
              },
            ].map((chip) => (
              <div
                key={chip.label}
                className="rounded-xl border border-white/8 bg-black/30 px-3 py-3"
              >
                <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">{chip.label}</div>
                <div className={`mt-1 text-base font-semibold ${chip.color}`}>{chip.value}</div>
              </div>
            ))}
          </div>

          {/* Aggregate power bars */}
          {(hasRevenueBudget || hasMaterialBudget || hasLabourBudget) && (
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-white/30">Portfolio health</div>
              {hasRevenueBudget && (
                <LifeBar
                  label="Revenue collected"
                  actual={totalRevenue}
                  budget={totalContractCents}
                  unit="money"
                  inverse
                />
              )}
              {hasMaterialBudget && (
                <LifeBar
                  label="Materials spend"
                  actual={totalExpenses}
                  budget={totalMaterialBudgetCents}
                  unit="money"
                />
              )}
              {hasLabourBudget && (
                <LifeBar
                  label="Labour hours"
                  actual={totalLabourHours}
                  budget={totalLabourBudgetHours}
                  unit="hours"
                />
              )}
            </div>
          )}

          {/* Jobs on track */}
          {activeJobs.length > 0 && (
            <p className="text-xs text-white/40">
              <span className="font-semibold text-white/65">{onTrackCount} of {activeJobs.length}</span> active jobs on track
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  expenseCents,
  revenueCents,
  hours,
}: {
  job: JobRow;
  expenseCents: number;
  revenueCents: number;
  hours: number;
}) {
  const status = normalizeStatus(job.status, job.active);
  const title = String(job.job_name || job.name || "Untitled job");
  const profitCents = revenueCents - expenseCents;
  const hasBudgets =
    job.material_budget_cents != null ||
    job.contract_value_cents != null ||
    job.labour_hours_budget != null;
  const hasActivity = expenseCents > 0 || revenueCents > 0 || hours > 0;

  return (
    <Link
      href={`/app/jobs/${job.id}`}
      className="flex flex-col rounded-[24px] border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.06] cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(status)}`} />
            <div className="truncate text-base font-semibold text-white/92">{title}</div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
            {job.job_no ? <span>#{job.job_no}</span> : null}
            <span>{statusLabel(status)}</span>
            {job.start_date ? <span>Started {formatDate(job.start_date)}</span> : null}
            {job.end_date ? <span>Ends {formatDate(job.end_date)}</span> : null}
          </div>
        </div>
        <span className="shrink-0 text-[11px] text-white/20">→</span>
      </div>

      {/* Life bars */}
      {(hasActivity || hasBudgets) ? (
        <div className="mt-4 space-y-3">
          <LifeBar
            label="Materials"
            actual={expenseCents}
            budget={job.material_budget_cents ?? null}
            unit="money"
          />
          <LifeBar
            label="Revenue"
            actual={revenueCents}
            budget={job.contract_value_cents ?? null}
            unit="money"
            inverse
          />
          <LifeBar
            label="Labour"
            actual={hours}
            budget={job.labour_hours_budget ?? null}
            unit="hours"
          />
        </div>
      ) : null}

      {/* Net profit indicator */}
      {(expenseCents > 0 || revenueCents > 0) ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">Net</span>
          <span
            className={`text-sm font-semibold ${
              profitCents > 0
                ? "text-emerald-400"
                : profitCents < 0
                ? "text-red-400"
                : "text-white/50"
            }`}
          >
            {profitCents > 0 ? "+" : ""}
            {fmtMoney(profitCents)}
          </span>
          {profitCents !== 0 ? (
            <span className="text-[10px] text-white/30">
              {profitCents > 0 ? "profit" : "loss"} so far
            </span>
          ) : null}
        </div>
      ) : null}

      {/* No activity yet */}
      {!hasActivity && !hasBudgets ? (
        <div className="mt-4 text-xs text-white/30 italic">No expenses, revenue, or hours logged yet.</div>
      ) : null}
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const { loading: gateLoading } = useTenantGate({ requireWhatsApp: false });

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [expenses, setExpenses] = useState<Record<number, number>>({});
  const [revenue, setRevenue] = useState<Record<number, number>>({});
  const [labour, setLabour] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("active");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Jobs with budget columns
      const { data: jobsData } = await supabase
        .from("jobs")
        .select(
          "id, job_no, job_name, name, status, active, start_date, end_date, created_at, updated_at, material_budget_cents, labour_hours_budget, contract_value_cents"
        )
        .order("updated_at", { ascending: false })
        .limit(1000);

      const jobsList = (jobsData as JobRow[]) || [];
      setJobs(jobsList);

      if (jobsList.length === 0) {
        setLoading(false);
        return;
      }

      const jobIds = jobsList.map((j) => j.id);
      const jobNos = jobsList.map((j) => j.job_no).filter((n): n is number => n != null);

      // 2. Expense totals per job
      const { data: expData } = await supabase
        .from("chiefos_portal_expenses")
        .select("job_int_id, amount_cents")
        .in("job_int_id", jobIds)
        .is("deleted_at", null);

      const expMap: Record<number, number> = {};
      for (const row of expData || []) {
        if (row.job_int_id != null) {
          expMap[row.job_int_id] = (expMap[row.job_int_id] || 0) + (Number(row.amount_cents) || 0);
        }
      }
      setExpenses(expMap);

      // 3. Revenue totals per job
      const { data: revData } = await supabase
        .from("chiefos_portal_revenue")
        .select("job_int_id, amount_cents")
        .in("job_int_id", jobIds)
        .is("deleted_at", null);

      const revMap: Record<number, number> = {};
      for (const row of revData || []) {
        if (row.job_int_id != null) {
          revMap[row.job_int_id] = (revMap[row.job_int_id] || 0) + (Number(row.amount_cents) || 0);
        }
      }
      setRevenue(revMap);

      // 4. Labour hours from time entries (by job_no)
      if (jobNos.length > 0) {
        const { data: timeData } = await supabase
          .from("time_entries")
          .select("job_no, type, timestamp")
          .in("job_no", jobNos)
          .is("deleted_at", null);

        const byJobNo: Record<number, TimeEntry[]> = {};
        for (const e of timeData || []) {
          if (e.job_no != null) {
            if (!byJobNo[e.job_no]) byJobNo[e.job_no] = [];
            byJobNo[e.job_no].push(e as TimeEntry);
          }
        }

        const hourMap: Record<number, number> = {};
        for (const job of jobsList) {
          if (job.job_no != null && byJobNo[job.job_no]) {
            hourMap[job.id] = calcWorkHours(byJobNo[job.job_no]);
          }
        }
        setLabour(hourMap);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!gateLoading) void load();
  }, [gateLoading, load]);

  const counts = useMemo(() => {
    const out = { all: jobs.length, active: 0, paused: 0, closed: 0, other: 0 };
    for (const j of jobs) out[normalizeStatus(j.status, j.active)]++;
    return out;
  }, [jobs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => {
      const title = String(j.job_name || j.name || "").toLowerCase();
      const no = String(j.job_no || "");
      const matchText = !needle || title.includes(needle) || no.includes(needle);
      const matchStatus = statusFilter === "all" || normalizeStatus(j.status, j.active) === statusFilter;
      return matchText && matchStatus;
    });
  }, [jobs, q, statusFilter]);

  if (gateLoading || loading) {
    return <div className="p-8 text-sm text-white/60">Loading jobs…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl py-2">

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Jobs</div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white/95">
            Jobs
          </h1>
          <p className="mt-1.5 text-sm text-white/50">
            Every dollar and hour lives inside a job. Select one to see the full picture.
          </p>
        </div>
        <Link
          href="/app/jobs/new"
          className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition"
        >
          + Create job
        </Link>
      </div>

      {/* Search + filters */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or number…"
          className="w-64 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
        />
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "paused", "closed", "other"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                statusFilter === key
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10",
              ].join(" ")}
            >
              {key === "all"
                ? `All (${counts.all})`
                : key === "active"
                ? `Active (${counts.active})`
                : key === "paused"
                ? `Paused (${counts.paused})`
                : key === "closed"
                ? `Closed (${counts.closed})`
                : `Other (${counts.other})`}
            </button>
          ))}
        </div>
      </div>

      {/* Legend — below filters, above everything else */}
      <div className="mb-6 flex flex-wrap items-center gap-4 text-[11px] text-white/30">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-emerald-500" />
          <span>On track (&lt;75%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-amber-400" />
          <span>Watch it (75–89%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-red-400" />
          <span>Danger (90%+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-red-500" />
          <span>Over budget</span>
        </div>
        <span className="text-white/20">·</span>
        <span>Revenue bar: green = more collected is better</span>
      </div>

      {/* Business Pulse */}
      <BusinessPulse
        jobs={jobs}
        expenses={expenses}
        revenue={revenue}
        labour={labour}
      />

      {/* Job grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-white/45">
          {jobs.length === 0
            ? "No jobs yet — create your first job to start tracking."
            : "No jobs match your filter."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              expenseCents={expenses[job.id] || 0}
              revenueCents={revenue[job.id] || 0}
              hours={labour[job.id] || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
