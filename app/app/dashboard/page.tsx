"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

import AskChiefMini from "@/app/app/components/AskChiefMini";
import JobsDecisionCenterPanel from "@/app/app/components/JobsDecisionCenterPanel";
import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";

type ViewKey = "expenses" | "revenue" | "time" | "tasks";
type RangeKey = "wtd" | "mtd" | "ytd" | "all";

type JobRow = {
  id: number;
  job_no: number | null;
  job_name: string | null;
  name?: string | null;
  status: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type Summary = {
  pendingReview: number;
  openTasks: number;
  activeJobs: number;
  totalJobs: number;
  revenueCents: number;
  expenseCents: number;
  profitCents: number;
};

type TransactionRow = {
  id: string | number;
  date?: string | null;
  created_at?: string | null;
  kind?: string | null;
  amount_cents?: number | null;
};

type ChartPoint = {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
};

function centsToMoney(cents?: number | null) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function prettyFromEmail(email?: string | null) {
  if (!email) return "";
  const left = email.split("@")[0] || "";
  if (!left) return "";
  const cleaned = left.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

function pickBestName({
  tenantName,
  metaFallback,
  emailFallback,
}: {
  tenantName?: string | null;
  metaFallback?: string | null;
  emailFallback?: string | null;
}) {
  const a = String(tenantName ?? "").trim();
  if (a) return a;

  const b = String(metaFallback ?? "").trim();
  if (b) return b;

  const c = String(emailFallback ?? "").trim();
  if (c) return c;

  return "Your system";
}

function normalizeStatus(raw?: string | null, active?: boolean | null) {
  const s = String(raw || "").trim().toLowerCase();
  if (active || s === "active" || s === "open" || s.includes("active")) return "Active";
  if (s.includes("pause") || s.includes("hold")) return "Paused";
  if (s.includes("closed") || s.includes("done") || s.includes("complete")) return "Closed";
  return "Other";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = startOfToday();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth() {
  const d = startOfToday();
  d.setDate(1);
  return d;
}

function startOfYear() {
  const d = startOfToday();
  d.setMonth(0, 1);
  return d;
}

function inSelectedRange(dateValue?: string | null, range: RangeKey = "mtd") {
  if (!dateValue || range === "all") return true;

  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return false;

  const compare = startOfToday();

  if (range === "wtd") return dt >= startOfWeek() && dt <= compare;
  if (range === "mtd") return dt >= startOfMonth() && dt <= compare;
  if (range === "ytd") return dt >= startOfYear() && dt <= compare;

  return true;
}

function bucketLabel(dateValue: string | null | undefined, range: RangeKey) {
  const d = new Date(String(dateValue || ""));
  if (Number.isNaN(d.getTime())) return "Unknown";

  if (range === "wtd") {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }

  if (range === "mtd") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  if (range === "ytd") {
    return d.toLocaleDateString(undefined, { month: "short" });
  }

  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function buildChartPoints(rows: TransactionRow[], range: RangeKey): ChartPoint[] {
  const filtered = rows.filter((r) => inSelectedRange(r.date || r.created_at || null, range));

  const map = new Map<string, ChartPoint>();

  for (const row of filtered) {
    const label = bucketLabel(row.date || row.created_at || null, range);
    const current = map.get(label) || { label, revenue: 0, expenses: 0, profit: 0 };
    const cents = Number(row.amount_cents || 0);

    if (String(row.kind || "").toLowerCase() === "revenue") {
      current.revenue += cents;
    } else {
      current.expenses += cents;
    }

    current.profit = current.revenue - current.expenses;
    map.set(label, current);
  }

  return Array.from(map.values());
}

function maxChartValue(points: ChartPoint[]) {
  const vals = points.flatMap((p) => [p.revenue, p.expenses, Math.abs(p.profit)]);
  const m = Math.max(0, ...vals);
  return m || 1;
}

function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">{eyebrow}</div>
      <div className="mt-2 text-lg font-semibold text-white/90">{title}</div>
      {body ? <div className="mt-2 text-sm text-white/60 leading-relaxed">{body}</div> : null}
    </div>
  );
}

function UtilityLink({
  href,
  label,
  tone = "secondary",
}: {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition",
        tone === "primary"
          ? "bg-white text-black hover:bg-white/90"
          : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white/92">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/50">{hint}</div> : null}
    </div>
  );
}

function DailyBriefing({
  hasWhatsApp,
  summary,
  selectedJob,
}: {
  hasWhatsApp: boolean;
  summary: Summary;
  selectedJob: JobRow | null;
}) {
  const lines = useMemo(() => {
    const out: string[] = [];

    if (!hasWhatsApp) {
      out.push("Connect WhatsApp so field capture starts flowing into the right jobs.");
    }

    if (selectedJob) {
      out.push(
        `${String(selectedJob.job_name || selectedJob.name || "This job")} is selected. Review the records tied to it below.`
      );
    } else if (summary.totalJobs === 0) {
      out.push("Create your first job. Jobs are the spine of ChiefOS.");
    } else {
      out.push("Pick a job from the left rail to inspect job-level records and activity.");
    }

    if (summary.pendingReview > 0) {
      out.push(
        `${summary.pendingReview} item${summary.pendingReview === 1 ? " is" : "s are"} waiting in Pending Review.`
      );
    } else {
      out.push("Nothing is waiting in Pending Review right now.");
    }

    if (summary.openTasks > 0) {
      out.push(`${summary.openTasks} open task${summary.openTasks === 1 ? "" : "s"} still need attention.`);
    }

    return out;
  }, [hasWhatsApp, summary, selectedJob]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <SectionTitle
        eyebrow="Daily Briefing"
        title="Run the business from one screen"
        body="Business scope at the top. Job scope below. Review and capture close by."
      />

      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <div key={line} className="text-sm text-white/72 leading-relaxed">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function RangeTabs({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
}) {
  const items: Array<{ key: RangeKey; label: string }> = [
    { key: "wtd", label: "WTD" },
    { key: "mtd", label: "MTD" },
    { key: "ytd", label: "YTD" },
    { key: "all", label: "Since start" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={[
            "rounded-full border px-3 py-1.5 text-xs font-medium transition",
            value === item.key
              ? "border-white/20 bg-white text-black"
              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
          ].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SimpleLineChart({
  points,
}: {
  points: ChartPoint[];
}) {
  const width = 100;
  const height = 36;
  const max = maxChartValue(points);

  function buildPath(selector: (p: ChartPoint) => number) {
    if (!points.length) return "";
    return points
      .map((p, i) => {
        const x = points.length === 1 ? 0 : (i / (points.length - 1)) * width;
        const y = height - (selector(p) / max) * height;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  const revenuePath = buildPath((p) => p.revenue);
  const expensePath = buildPath((p) => p.expenses);
  const profitPath = buildPath((p) => Math.max(0, p.profit));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle
          eyebrow="Performance"
          title="Business trend"
          body="Simple and trustworthy. Revenue, expenses, and profit only."
        />
      </div>

      <div className="mt-5">
        {points.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-8 text-sm text-white/55">
            Not enough data yet to draw the trend line.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" preserveAspectRatio="none">
                <path d={revenuePath} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.8" />
                <path d={expensePath} fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="1.4" />
                <path d={profitPath} fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="1.2" strokeDasharray="3 2" />
              </svg>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Revenue</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Expenses</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Profit</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {points.map((p) => (
                <div key={p.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] text-white/45">{p.label}</div>
                  <div className="mt-1 text-sm text-white/85">{centsToMoney(p.profit)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CenterWorkspace({
  selectedJob,
  view,
  setView,
}: {
  selectedJob: JobRow | null;
  view: ViewKey;
  setView: (v: ViewKey) => void;
}) {
  const title = selectedJob
    ? String(selectedJob.job_name || selectedJob.name || "Untitled job")
    : "Select a job";

  const subtitle = selectedJob
    ? `${selectedJob.job_no ? `#${selectedJob.job_no} • ` : ""}${normalizeStatus(
        selectedJob.status,
        selectedJob.active
      )}`
    : "Choose a job from the left rail to inspect its records.";

  return (
    <div className="rounded-2xl border border-white/10 bg-black">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Job Scope</div>
            <div className="mt-2 truncate text-2xl font-semibold text-white/92">{title}</div>
            <div className="mt-2 text-sm text-white/55">{subtitle}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <UtilityLink href="/app/jobs/new" label="Create job" tone="primary" />
            <UtilityLink href="/app/uploads" label="Upload files" />
            <UtilityLink href="/app/pending-review" label="Pending Review" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["expenses", "revenue", "time", "tasks"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-medium transition border",
                view === k
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
              ].join(" ")}
            >
              {k === "expenses"
                ? "Expenses"
                : k === "revenue"
                ? "Revenue"
                : k === "time"
                ? "Time"
                : "Tasks"}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[420px] px-5 py-5">
        {!selectedJob ? (
          <div className="flex h-full min-h-[340px] items-center justify-center">
            <div className="max-w-md text-center">
              <div className="text-lg font-semibold text-white/90">Pick a job to begin</div>
              <div className="mt-3 text-sm leading-relaxed text-white/60">
                Home should show business performance. This section should show the selected job.
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <UtilityLink href="/app/jobs/new" label="Create job" tone="primary" />
                <UtilityLink href="/app/uploads" label="Upload receipts / files" />
              </div>
            </div>
          </div>
        ) : (
          <DashboardDataPanel view={view} />
        )}
      </div>
    </div>
  );
}

function RightRail({
  hasWhatsApp,
  betaPlan,
  summary,
}: {
  hasWhatsApp: boolean;
  betaPlan?: string | null;
  summary: Summary;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <SectionTitle
          eyebrow="Ask Chief"
          title="Ask while you work"
          body="Chief should stay close to the data, not send you off into another workflow."
        />
        <div className="mt-4">
          <AskChiefMini />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <SectionTitle eyebrow="Key Signals" title="What needs attention" />
        <div className="mt-4 space-y-3">
          <MetricCard label="Pending Review" value={String(summary.pendingReview)} hint="Owner confirmation lane" />
          <MetricCard label="Active Jobs" value={String(summary.activeJobs)} hint={`${summary.totalJobs} total jobs`} />
          <MetricCard label="Open Tasks" value={String(summary.openTasks)} hint="Still needs action" />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <SectionTitle eyebrow="Next Actions" title="Move the operation forward" />
        <div className="mt-4 flex flex-col gap-2">
          {!hasWhatsApp ? (
            <UtilityLink href="/app/connect-whatsapp" label="Connect WhatsApp" tone="primary" />
          ) : null}
          <UtilityLink href="/app/pending-review" label="Open Pending Review" />
          <UtilityLink href="/app/uploads" label="Bulk upload receipts" />
          {betaPlan === "pro" ? (
            <UtilityLink href="/app/crew/inbox" label="Open Crew Inbox" />
          ) : (
            <UtilityLink href="/app/settings/billing" label="See Pro governance" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { loading, hasWhatsApp, betaPlan } = useTenantGate({ requireWhatsApp: false });

  const [workspaceName, setWorkspaceName] = useState<string>("Your system");
  const [view, setView] = useState<ViewKey>("expenses");
  const [range, setRange] = useState<RangeKey>("mtd");
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [txRows, setTxRows] = useState<TransactionRow[]>([]);

  const [summary, setSummary] = useState<Summary>({
    pendingReview: 0,
    openTasks: 0,
    activeJobs: 0,
    totalJobs: 0,
    revenueCents: 0,
    expenseCents: 0,
    profitCents: 0,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data: u, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;

        const user = u?.user;
        const userId = user?.id || "";

        const metaFallback =
          (user?.user_metadata?.business_name as string | undefined) ||
          (user?.user_metadata?.company as string | undefined) ||
          (user?.user_metadata?.full_name as string | undefined) ||
          (user?.user_metadata?.name as string | undefined) ||
          "";

        const emailFallback = prettyFromEmail(user?.email || null);

        if (!userId) {
          if (alive) setWorkspaceName(pickBestName({ metaFallback, emailFallback }));
          return;
        }

        const { data: pu, error: puErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (puErr) {
          if (alive) setWorkspaceName(pickBestName({ metaFallback, emailFallback }));
          return;
        }

        const tenantId = (pu as any)?.tenant_id as string | null;

        if (!tenantId) {
          if (alive) setWorkspaceName(pickBestName({ metaFallback, emailFallback }));
          return;
        }

        const { data: tenant } = await supabase
          .from("chiefos_tenants")
          .select("name, owner_id")
          .eq("id", tenantId)
          .maybeSingle();

        if (alive) {
          setWorkspaceName(
            pickBestName({
              tenantName: (tenant as any)?.name || null,
              metaFallback,
              emailFallback,
            })
          );
        }

        try {
          const { data: jobsData } = await supabase
            .from("jobs")
            .select("id, job_no, job_name, name, status, active, created_at, updated_at")
            .order("created_at", { ascending: false })
            .limit(1000);

          const jobs = (jobsData as JobRow[]) || [];
          const activeJobs = jobs.filter((j) => normalizeStatus(j.status, j.active) === "Active").length;

          if (alive) {
            setSummary((s) => ({
              ...s,
              activeJobs,
              totalJobs: jobs.length,
            }));

            if (!selectedJob && jobs.length > 0) {
              const firstActive = jobs.find((j) => normalizeStatus(j.status, j.active) === "Active");
              setSelectedJob(firstActive || jobs[0]);
            }
          }
        } catch {
          // fail-soft
        }

        try {
          const { data: pendingRows } = await supabase
            .from("intake_items")
            .select("id")
            .eq("tenant_id", tenantId)
            .in("status", ["pending_review", "uploaded", "validated", "extracted"]);

          if (alive) {
            setSummary((s) => ({
              ...s,
              pendingReview: Array.isArray(pendingRows) ? pendingRows.length : 0,
            }));
          }
        } catch {
          // fail-soft
        }

        try {
          const ownerId = String((tenant as any)?.owner_id || "").trim();

          if (ownerId) {
            const { data: tasksRows } = await supabase
              .from("tasks")
              .select("id, status")
              .eq("owner_id", ownerId)
              .limit(500);

            const openTasks = Array.isArray(tasksRows)
              ? tasksRows.filter((t: any) => {
                  const s = String(t?.status || "").toLowerCase();
                  return s !== "done" && s !== "completed" && s !== "closed";
                }).length
              : 0;

            if (alive) {
              setSummary((s) => ({
                ...s,
                openTasks,
              }));
            }
          }
        } catch {
          // fail-soft
        }

        try {
          const { data: tx } = await supabase
            .from("transactions")
            .select("id, date, created_at, kind, amount_cents")
            .eq("tenant_id", tenantId)
            .in("kind", ["expense", "revenue"])
            .order("created_at", { ascending: true })
            .limit(5000);

          const rows = (tx as TransactionRow[]) || [];

          if (alive) {
            setTxRows(rows);

            const filtered = rows.filter((r) => inSelectedRange(r.date || r.created_at || null, range));
            const revenueCents = filtered
              .filter((r) => String(r.kind || "").toLowerCase() === "revenue")
              .reduce((sum, r) => sum + Number(r.amount_cents || 0), 0);

            const expenseCents = filtered
              .filter((r) => String(r.kind || "").toLowerCase() === "expense")
              .reduce((sum, r) => sum + Number(r.amount_cents || 0), 0);

            setSummary((s) => ({
              ...s,
              revenueCents,
              expenseCents,
              profitCents: revenueCents - expenseCents,
            }));
          }
        } catch {
          // fail-soft
        }
      } catch {
        // fail-soft
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedJob, range]);

  const chartPoints = useMemo(() => buildChartPoints(txRows, range), [txRows, range]);

  if (loading) return <div className="p-8 text-white/70">Loading your workspace…</div>;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1700px] space-y-4 px-0 py-0">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Business Scope</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white/95">{workspaceName}</h1>
              <div className="mt-2 text-sm text-white/60">
                One screen to see the business, review what needs attention, and drop into jobs.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <UtilityLink href="/app/jobs/new" label="Start job" tone="primary" />
              <UtilityLink href="/app/uploads" label="Capture" />
              <UtilityLink href="/app/pending-review" label="Review" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Active Jobs" value={String(summary.activeJobs)} hint={`${summary.totalJobs} total`} />
            <MetricCard label="Pending Review" value={String(summary.pendingReview)} hint="Needs owner review" />
            <MetricCard label="Open Tasks" value={String(summary.openTasks)} hint="Still in motion" />
            <MetricCard label="Revenue" value={centsToMoney(summary.revenueCents)} hint={range.toUpperCase()} />
            <MetricCard label="Profit" value={centsToMoney(summary.profitCents)} hint={range.toUpperCase()} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionTitle
              eyebrow="Performance Range"
              title="See the business at a glance"
              body="Use simple toggles. No speculative numbers."
            />
            <RangeTabs value={range} onChange={setRange} />
          </div>

          <div className="mt-5">
            <SimpleLineChart points={chartPoints} />
          </div>
        </div>

        <div className="grid min-h-[calc(100vh-72px)] grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <JobsDecisionCenterPanel
              selectedJobId={selectedJob?.id ?? null}
              onSelectJob={(job) => setSelectedJob(job)}
            />
          </div>

          <div className="min-w-0 space-y-4">
            <DailyBriefing hasWhatsApp={hasWhatsApp} summary={summary} selectedJob={selectedJob} />
            <CenterWorkspace selectedJob={selectedJob} view={view} setView={setView} />
          </div>

          <div className="min-w-0">
            <RightRail hasWhatsApp={hasWhatsApp} betaPlan={betaPlan} summary={summary} />
          </div>
        </div>
      </div>
    </main>
  );
}