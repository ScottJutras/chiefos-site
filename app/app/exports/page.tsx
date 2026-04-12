"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportKind = "expenses" | "expenses-csv" | "timesheet" | "job-pnl" | "year-end" | "payroll" | "payroll-csv";

type JobOption = {
  id: number;
  job_no: number | null;
  label: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function triggerDownload(token: string, path: string, body?: object) {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : "{}",
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as any)?.error || `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const cdHeader = res.headers.get("content-disposition") || "";
  const match = cdHeader.match(/filename="([^"]+)"/);
  const filename = match?.[1] || "chiefos-export";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

// ─── ExportCard ───────────────────────────────────────────────────────────────

function ExportCard({
  title,
  description,
  format,
  locked,
  children,
}: {
  title: string;
  description: string;
  format: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={[
      "rounded-[20px] border p-5 space-y-4 relative",
      locked ? "border-white/5 bg-white/[0.02] opacity-60" : "border-white/10 bg-white/[0.04]",
    ].join(" ")}>
      {locked && (
        <div className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
          Starter+
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white/90">{title}</div>
          <div className="text-[10px] font-medium uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10 text-white/40">
            {format}
          </div>
        </div>
        <div className="mt-1 text-xs text-white/50 leading-relaxed">{description}</div>
      </div>
      {!locked && children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExportsPage() {
  const { loading, planKey } = useTenantGate({ requireWhatsApp: false });
  const isPaidPlan = planKey === "starter" || planKey === "pro";

  const [status, setStatus] = useState<Record<ExportKind, "idle" | "loading" | "error">>({
    "expenses": "idle",
    "expenses-csv": "idle",
    "timesheet": "idle",
    "job-pnl": "idle",
    "year-end": "idle",
    "payroll": "idle",
    "payroll-csv": "idle",
  });

  const [payrollDateFrom, setPayrollDateFrom] = useState("");
  const [payrollDateTo, setPayrollDateTo] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [jobId, setJobId] = useState<string>("");
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);

  async function loadJobs() {
    if (jobsLoaded) return;
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) return;

      const { data: pu } = await supabase
        .from("chiefos_portal_users")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();

      const tenantId = (pu as any)?.tenant_id;
      if (!tenantId) return;

      const { data: jobRows } = await supabase
        .from("jobs")
        .select("id, job_no, job_name, name")
        .eq("tenant_id", tenantId)
        .not("status", "in", '("archived","cancelled")')
        .order("created_at", { ascending: false })
        .limit(100);

      setJobs(
        ((jobRows || []) as any[]).map((j) => ({
          id: j.id,
          job_no: j.job_no,
          label: j.job_name || j.name || `Job #${j.job_no || j.id}`,
        }))
      );
      setJobsLoaded(true);
    } catch {}
  }

  async function doExport(kind: ExportKind, body?: object) {
    setStatus((s) => ({ ...s, [kind]: "loading" }));
    setErrors((e) => ({ ...e, [kind]: "" }));
    try {
      const token = await getToken();
      // payroll-csv maps to same route with format=csv in body
      const path = kind === "payroll-csv" ? "/api/exports/payroll" : `/api/exports/${kind}`;
      await triggerDownload(token, path, body);
      setStatus((s) => ({ ...s, [kind]: "idle" }));
    } catch (err: any) {
      setStatus((s) => ({ ...s, [kind]: "error" }));
      setErrors((e) => ({ ...e, [kind]: err?.message || "Export failed" }));
    }
  }

  if (loading) return <div className="p-8 text-white/50">Loading…</div>;

  const currentYear = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-3xl py-2 space-y-6">
      {/* Header */}
      <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-[var(--text-faint)]">Finance</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Exports</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Download your financial records as XLSX or PDF — ready for your accountant.
        </p>
      </div>

      {!isPaidPlan && (
        <div className="rounded-[16px] border border-amber-500/25 bg-amber-500/[0.06] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-amber-300">Exports require Starter or Pro</div>
            <div className="mt-0.5 text-xs text-white/50">Upgrade to download your financial records in Excel and PDF.</div>
          </div>
          <Link
            href="/app/settings/billing"
            className="shrink-0 inline-flex items-center rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-400 transition"
          >
            Upgrade →
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {/* Expenses by Job */}
        <ExportCard
          title="Expenses by Job"
          description="All expenses grouped by job — date, vendor, category, amount. Includes QuickBooks account names and CRA T2125 / IRS Schedule C tax lines."
          format="XLSX + CSV"
          locked={!isPaidPlan}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={status["expenses"] === "loading"}
              onClick={() => doExport("expenses")}
              className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
            >
              {status["expenses"] === "loading" ? "Generating…" : "Download XLSX"}
            </button>
            <button
              type="button"
              disabled={status["expenses-csv"] === "loading"}
              onClick={() => doExport("expenses-csv")}
              className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-50"
            >
              {status["expenses-csv"] === "loading" ? "Generating…" : "Download CSV (QuickBooks)"}
            </button>
            {(errors["expenses"] || errors["expenses-csv"]) && (
              <span className="text-xs text-red-400">{errors["expenses"] || errors["expenses-csv"]}</span>
            )}
          </div>
        </ExportCard>

        {/* Timesheet */}
        <ExportCard
          title="Timesheet with Labor Cost"
          description="All time entries with employee names, hours, hourly rates, and dollar labor cost per job."
          format="XLSX"
          locked={!isPaidPlan}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={status["timesheet"] === "loading"}
              onClick={() => doExport("timesheet")}
              className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
            >
              {status["timesheet"] === "loading" ? "Generating…" : "Download Timesheet"}
            </button>
            {errors["timesheet"] && <span className="text-xs text-red-400">{errors["timesheet"]}</span>}
          </div>
        </ExportCard>

        {/* Job P&L PDF */}
        <ExportCard
          title="Job P&L Report"
          description="Revenue, materials, labor cost, and net margin for a single job — formatted for sharing with clients or investors."
          format="PDF"
          locked={!isPaidPlan}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] text-white/40 mb-1">Select job</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus:outline-none focus:ring-1 focus:ring-white/20"
                value={jobId}
                onFocus={loadJobs}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">— Pick a job —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={String(j.id)}>
                    {j.job_no ? `#${j.job_no} — ` : ""}{j.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!jobId || status["job-pnl"] === "loading"}
                onClick={() => doExport("job-pnl", { job_id: Number(jobId) })}
                className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
              >
                {status["job-pnl"] === "loading" ? "Generating…" : "Download P&L PDF"}
              </button>
              {errors["job-pnl"] && <span className="text-xs text-red-400">{errors["job-pnl"]}</span>}
            </div>
          </div>
        </ExportCard>

        {/* Payroll Summary */}
        <ExportCard
          title="Payroll Summary"
          description="Hours and gross pay per employee — regular hours, OT at 1.5×, and totals. Hand to your payroll provider. ChiefOS calculates labour costs only."
          format="XLSX + CSV"
          locked={!isPaidPlan}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-[11px] text-white/40 mb-1">From (optional)</label>
                <input
                  type="date"
                  value={payrollDateFrom}
                  onChange={(e) => setPayrollDateFrom(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/40 mb-1">To (optional)</label>
                <input
                  type="date"
                  value={payrollDateTo}
                  onChange={(e) => setPayrollDateTo(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={status["payroll"] === "loading"}
                onClick={() => doExport("payroll", { date_from: payrollDateFrom || undefined, date_to: payrollDateTo || undefined })}
                className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
              >
                {status["payroll"] === "loading" ? "Generating…" : "Download XLSX"}
              </button>
              <button
                type="button"
                disabled={status["payroll-csv"] === "loading"}
                onClick={() => doExport("payroll-csv", { format: "csv", date_from: payrollDateFrom || undefined, date_to: payrollDateTo || undefined })}
                className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-50"
              >
                {status["payroll-csv"] === "loading" ? "Generating…" : "Download CSV"}
              </button>
              {(errors["payroll"] || errors["payroll-csv"]) && (
                <span className="text-xs text-red-400">{errors["payroll"] || errors["payroll-csv"]}</span>
              )}
              <span className="text-xs text-white/30">Defaults to current week if no dates set</span>
            </div>
          </div>
        </ExportCard>

        {/* Year-end bundle */}
        <ExportCard
          title={`Year-End Bundle (${currentYear})`}
          description="Everything in one ZIP: expenses spreadsheet, timesheet, and P&L PDFs for every job. Hand it to your accountant."
          format="ZIP"
          locked={!isPaidPlan}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={status["year-end"] === "loading"}
              onClick={() => doExport("year-end", { year: currentYear })}
              className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
            >
              {status["year-end"] === "loading" ? "Building bundle…" : `Download ${currentYear} Bundle`}
            </button>
            {errors["year-end"] && <span className="text-xs text-red-400">{errors["year-end"]}</span>}
            <span className="text-xs text-white/30">Includes all jobs with revenue data</span>
          </div>
        </ExportCard>
      </div>

      {/* Tip */}
      <div className="rounded-[14px] border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-white/40 leading-relaxed">
        <span className="font-medium text-white/60">Pro tip:</span> Ask Chief "give me a summary of this year" before exporting — Chief can highlight anything worth flagging for your accountant.
      </div>
    </div>
  );
}
