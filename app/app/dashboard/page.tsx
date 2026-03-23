"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

import AskChiefMini from "@/app/app/components/AskChiefMini";
import JobsDecisionCenterPanel from "@/app/app/components/JobsDecisionCenterPanel";
import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";
import BusinessPulseChart, { type PulsePoint } from "@/app/app/components/BusinessPulseChart";
import ChiefDock from "@/app/app/components/ChiefDock";

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
};

type TxRow = {
  id: number;
  tenant_id: string;
  owner_id: string | null;
  date: string | null;
  amount_cents: number | null;
  kind: "expense" | "revenue" | string;
  job_name: string | null;
  job_id: number | null;
  created_at: string | null;
};

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

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfYear(d: Date) {
  const x = new Date(d);
  x.setMonth(0, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toDayKey(dateLike: string | null | undefined) {
  const d = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dayLabel(dayKey: string) {
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildPulsePoints(rows: TxRow[], range: RangeKey): PulsePoint[] {
  const now = new Date();

  const start =
    range === "wtd"
      ? startOfWeek(now)
      : range === "mtd"
      ? startOfMonth(now)
      : range === "ytd"
      ? startOfYear(now)
      : null;

  const filtered = rows.filter((row) => {
    const raw = row.date || row.created_at;
    if (!raw) return false;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;
    if (!start) return true;
    return d >= start;
  });

  const buckets = new Map<string, { revenue: number; expenses: number }>();

  for (const row of filtered) {
    const dayKey = toDayKey(row.date || row.created_at);
    if (!dayKey) continue;

    const existing = buckets.get(dayKey) || { revenue: 0, expenses: 0 };
    const cents = Number(row.amount_cents || 0);

    if (String(row.kind).toLowerCase() === "revenue") {
      existing.revenue += cents;
    } else if (String(row.kind).toLowerCase() === "expense") {
      existing.expenses += cents;
    }

    buckets.set(dayKey, existing);
  }

  const sorted = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return sorted.map(([dayKey, v]) => ({
    label: dayLabel(dayKey),
    revenueCents: v.revenue,
    expenseCents: v.expenses,
    profitCents: v.revenue - v.expenses,
  }));
}

function HeroStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white/95">{value}</div>
      {sub ? <div className="mt-1 text-xs text-white/50">{sub}</div> : null}
    </div>
  );
}

function CenterWorkspace({
  selectedJob,
  view,
  setView,
  summary,
  pulsePoints,
  pulseRange,
  setPulseRange,
  pulseLoading,
  onAskChief,
}: {
  selectedJob: JobRow | null;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  summary: Summary;
  pulsePoints: PulsePoint[];
  pulseRange: RangeKey;
  setPulseRange: (v: RangeKey) => void;
  pulseLoading: boolean;
  onAskChief: (q?: string) => void;
}) {
  const title = selectedJob
    ? String(selectedJob.job_name || selectedJob.name || "Untitled job")
    : "Business overview";

  const subtitle = selectedJob
    ? `${selectedJob.job_no ? `#${selectedJob.job_no} • ` : ""}${normalizeStatus(
        selectedJob.status,
        selectedJob.active
      )}`
    : "Run the business from one operating screen.";

  return (
    <div className="flex h-full min-h-[84vh] flex-col bg-black">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
              {selectedJob ? "Job scope" : "Business scope"}
            </div>
            <div className="mt-2 truncate text-2xl font-semibold text-white/95">{title}</div>
            <div className="mt-2 text-sm text-white/55">{subtitle}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <UtilityLink href="/app/jobs/new" label="Create job" tone="primary" />
            <UtilityLink href="/app/uploads" label="Upload" />
            <button
              type="button"
              onClick={() => onAskChief(selectedJob ? `What should I know about ${title}?` : "")}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Ask Chief
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <HeroStat label="Active jobs" value={String(summary.activeJobs)} sub={`${summary.totalJobs} total`} />
          <HeroStat label="Pending review" value={String(summary.pendingReview)} sub="Needs owner confirmation" />
          <HeroStat label="Open tasks" value={String(summary.openTasks)} sub="Still needs action" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <BusinessPulseChart
            points={pulsePoints}
            activeJobs={summary.activeJobs}
            totalJobs={summary.totalJobs}
            title={selectedJob ? `${title} performance pulse` : "Business performance pulse"}
            subtitle={
              selectedJob
                ? "Keep job scope visible while asking Chief and reviewing records."
                : "A simple line graph keeps performance visible without turning the screen into a spreadsheet."
            }
            loading={pulseLoading}
            range={pulseRange}
            onRangeChange={setPulseRange}
          />

          <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Records</div>
                <div className="mt-2 text-lg font-semibold text-white/92">
                  {selectedJob ? `${title} records` : "Business records"}
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Keep the data visible while you reason.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-1">
  <div className="flex flex-wrap gap-1">
    {(["expenses", "revenue", "time", "tasks"] as const).map((k) => (
      <button
        key={k}
        type="button"
        onClick={() => setView(k)}
        className={[
          "rounded-xl px-3 py-1.5 text-xs font-medium transition",
          view === k
            ? "bg-white text-black"
            : "text-white/60 hover:bg-white/5 hover:text-white/85",
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
            </div>

            <div className="mt-4">
              <DashboardDataPanel
  view={view}
  selectedJobName={selectedJob ? String(selectedJob.job_name || selectedJob.name || "").trim() : null}
/>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function RightRail({
  hasWhatsApp,
  betaPlan,
  summary,
  onAskChief,
}: {
  hasWhatsApp: boolean;
  betaPlan?: string | null;
  summary: Summary;
  onAskChief: (q?: string) => void;
}) {
  return (
    <div className="flex h-full min-h-[84vh] flex-col bg-black">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Chief</div>
        <div className="mt-2 text-lg font-semibold text-white/92">Ask while you operate</div>
        <div className="mt-2 text-sm text-white/60">
          Chief should open without taking you away from the business.
        </div>

        <div className="mt-4">
          <AskChiefMini onAsk={(q) => onAskChief(q)} />
        </div>
      </div>

      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Quick actions</div>
        <div className="mt-4 flex flex-col gap-2">
          {!hasWhatsApp ? (
            <UtilityLink href="/app/connect-whatsapp" label="Connect WhatsApp" tone="primary" />
          ) : null}

          <UtilityLink href="/app/pending-review" label={`Pending Review (${summary.pendingReview})`} />
          <UtilityLink href="/app/uploads" label="Upload receipts / files" />
          <UtilityLink href="/app/activity/expenses" label="Open expense ledger" />
          <UtilityLink href="/app/activity/revenue" label="Open revenue ledger" />
          <UtilityLink href="/app/jobs/new" label="Start a new job" />
          <UtilityLink href="/app/settings" label="Settings" />
          <UtilityLink href="/app/settings/billing" label="Billing" />

          {betaPlan === "pro" ? (
            <UtilityLink href="/app/crew/inbox" label="Crew Inbox" />
          ) : null}
        </div>
      </div>

      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">What matters</div>
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/45">Active jobs</div>
            <div className="mt-1 text-xl font-semibold text-white/95">{summary.activeJobs}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/45">Open tasks</div>
            <div className="mt-1 text-xl font-semibold text-white/95">{summary.openTasks}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/45">Pending review</div>
            <div className="mt-1 text-xl font-semibold text-white/95">{summary.pendingReview}</div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-5 py-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Trust-first note</div>
          <div className="mt-2 text-sm leading-relaxed text-white/60">
            ChiefOS should keep the graph, jobs, records, and reasoning visible together.
            Fewer page jumps. More operational clarity.
          </div>
          <button
            type="button"
            onClick={() => onAskChief("What needs my attention right now?")}
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Ask Chief what needs attention
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { loading, hasWhatsApp, betaPlan } = useTenantGate({ requireWhatsApp: false });

  const [workspaceName, setWorkspaceName] = useState<string>("Your system");
  const [view, setView] = useState<ViewKey>("expenses");
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [pulseRange, setPulseRange] = useState<RangeKey>("mtd");
  const [pulseRows, setPulseRows] = useState<TxRow[]>([]);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [chiefOpen, setChiefOpen] = useState(false);
  const [chiefQuery, setChiefQuery] = useState("");

  const [summary, setSummary] = useState<Summary>({
    pendingReview: 0,
    openTasks: 0,
    activeJobs: 0,
    totalJobs: 0,
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
          const { data: txRows } = await supabase
            .from("transactions")
            .select("id, tenant_id, owner_id, date, amount_cents, kind, job_name, job_id, created_at")
            .eq("tenant_id", tenantId)
            .order("date", { ascending: true })
            .limit(5000);

          if (alive) {
            setPulseRows((txRows as TxRow[]) || []);
            setPulseLoading(false);
          }
        } catch {
          if (alive) setPulseLoading(false);
        }
      } catch {
        // fail-soft
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const pulsePoints = useMemo(() => {
    const base = selectedJob
      ? pulseRows.filter((r) => {
          // Prefer job_id match (exact); fall back to normalised name comparison
          if (selectedJob.id != null && r.job_id != null) return r.job_id === selectedJob.id;
          const a = String(r.job_name || "").trim().toLowerCase();
          const b = String(selectedJob.job_name || selectedJob.name || "").trim().toLowerCase();
          return !!b && a === b;
        })
      : pulseRows;

    return buildPulsePoints(base, pulseRange);
  }, [pulseRows, selectedJob, pulseRange]);

  function openChief(query?: string) {
    setChiefQuery(String(query || "").trim());
    setChiefOpen(true);
  }

  if (loading) return <div className="p-8 text-white/70">Loading your workspace…</div>;

  return (
    <>
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-[1700px] px-0 py-0">
          <div className="grid min-h-[calc(100vh-72px)] grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
            <div className="border-r border-white/10">
              <JobsDecisionCenterPanel
                selectedJobId={selectedJob?.id ?? null}
                onSelectJob={(job) => setSelectedJob(job)}
              />
            </div>

            <div className="min-w-0">
              <CenterWorkspace
                selectedJob={selectedJob}
                view={view}
                setView={setView}
                summary={summary}
                pulsePoints={pulsePoints}
                pulseRange={pulseRange}
                setPulseRange={setPulseRange}
                pulseLoading={pulseLoading}
                onAskChief={openChief}
              />
            </div>

            <div className="border-l border-white/10">
              <RightRail
                hasWhatsApp={hasWhatsApp}
                betaPlan={betaPlan}
                summary={summary}
                onAskChief={openChief}
              />
            </div>
          </div>
        </div>
      </main>

      <ChiefDock
        open={chiefOpen}
        onClose={() => setChiefOpen(false)}
        initialQuery={chiefQuery}
      />
    </>
  );
}