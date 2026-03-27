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

// ─── Budget Edit Form ─────────────────────────────────────────────────────────

function BudgetEditForm({
  job,
  onSave,
  onCancel,
}: {
  job: JobRow;
  onSave: (updated: Partial<JobRow>) => void;
  onCancel: () => void;
}) {
  const [matStr, setMatStr] = useState(
    job.material_budget_cents != null ? String(job.material_budget_cents / 100) : ""
  );
  const [contractStr, setContractStr] = useState(
    job.contract_value_cents != null ? String(job.contract_value_cents / 100) : ""
  );
  const [hoursStr, setHoursStr] = useState(
    job.labour_hours_budget != null ? String(job.labour_hours_budget) : ""
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);

    const matCents = matStr.trim() ? Math.round(parseFloat(matStr) * 100) : null;
    const contractCents = contractStr.trim() ? Math.round(parseFloat(contractStr) * 100) : null;
    const hoursVal = hoursStr.trim() ? parseFloat(hoursStr) : null;

    if (
      (matStr.trim() && (isNaN(matCents!) || matCents! < 0)) ||
      (contractStr.trim() && (isNaN(contractCents!) || contractCents! < 0)) ||
      (hoursStr.trim() && (isNaN(hoursVal!) || hoursVal! < 0))
    ) {
      setErr("Please enter valid positive numbers.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("jobs")
      .update({
        material_budget_cents: matCents,
        contract_value_cents: contractCents,
        labour_hours_budget: hoursVal,
      })
      .eq("id", job.id);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    onSave({
      material_budget_cents: matCents,
      contract_value_cents: contractCents,
      labour_hours_budget: hoursVal,
    });
    setSaving(false);
  }

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25";

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Set budgets</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Materials ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 8000"
            value={matStr}
            onChange={(e) => setMatStr(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Contract value ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 24000"
            value={contractStr}
            onChange={(e) => setContractStr(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Labour hours</label>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g. 120"
            value={hoursStr}
            onChange={(e) => setHoursStr(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {err && <div className="text-xs text-red-300">{err}</div>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save budgets"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  expenseCents,
  revenueCents,
  hours,
  onBudgetSaved,
}: {
  job: JobRow;
  expenseCents: number;
  revenueCents: number;
  hours: number;
  onBudgetSaved: (jobId: number, updated: Partial<JobRow>) => void;
}) {
  const [editingBudget, setEditingBudget] = useState(false);
  const status = normalizeStatus(job.status, job.active);
  const title = String(job.job_name || job.name || "Untitled job");
  const profitCents = revenueCents - expenseCents;
  const hasBudgets =
    job.material_budget_cents != null ||
    job.contract_value_cents != null ||
    job.labour_hours_budget != null;
  const hasActivity = expenseCents > 0 || revenueCents > 0 || hours > 0;

  return (
    <div className="flex flex-col rounded-[24px] border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05]">
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

      {/* Budget edit form */}
      {editingBudget ? (
        <BudgetEditForm
          job={job}
          onSave={(updated) => {
            onBudgetSaved(job.id, updated);
            setEditingBudget(false);
          }}
          onCancel={() => setEditingBudget(false)}
        />
      ) : null}

      {/* Footer actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
        <a
          href={`/app/chief?q=${encodeURIComponent(`Summarise job ${job.job_name || job.name || job.job_no || job.id} — what has been spent, what has been collected, and is it on track?`)}`}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/10 transition"
        >
          Ask Chief
        </a>
        <button
          type="button"
          onClick={() => setEditingBudget((v) => !v)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/10 transition"
        >
          {hasBudgets ? "Edit budget" : "Set budget"}
        </button>
        <Link
          href={`/app/dashboard?jobId=${job.id}`}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/10 transition"
        >
          View job
        </Link>
      </div>
    </div>
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

  function handleBudgetSaved(jobId: number, updated: Partial<JobRow>) {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...updated } : j))
    );
  }

  if (gateLoading || loading) {
    return <div className="p-8 text-sm text-white/60">Loading jobs…</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Jobs</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white/95">
              Job health at a glance.
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Each bar shows how far through budget you are — like a power bar for every job.
            </p>
          </div>
          <Link
            href="/app/jobs/new"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition"
          >
            + Create job
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
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

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-white/45">
            {jobs.length === 0
              ? "No jobs yet. Create your first job to start tracking."
              : "No jobs match your filter."}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                expenseCents={expenses[job.id] || 0}
                revenueCents={revenue[job.id] || 0}
                hours={labour[job.id] || 0}
                onBudgetSaved={handleBudgetSaved}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        {filtered.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-4 text-[11px] text-white/30">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-6 rounded-full bg-emerald-500" />
              <span>On track (&lt;75%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-6 rounded-full bg-amber-400" />
              <span>Watch it (75–89%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-6 rounded-full bg-red-400" />
              <span>Danger (90%+)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-6 rounded-full bg-red-500" />
              <span>Over budget</span>
            </div>
            <span className="text-white/20">·</span>
            <span>Revenue bar: green = more collected is better</span>
          </div>
        )}
      </div>
    </div>
  );
}
