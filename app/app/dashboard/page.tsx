"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";
import BusinessPulseChart, { type PulsePoint } from "@/app/app/components/BusinessPulseChart";
import OnboardingWidget from "@/app/app/components/OnboardingWidget";
import RevenueLineChart, { type RevenueChartRow } from "@/app/app/components/RevenueLineChart";

type ViewKey = "expenses" | "revenue" | "time" | "tasks";
type RangeKey = "wtd" | "mtd" | "qtd" | "ytd" | "all";

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

type MarginAlert = {
  id: number;
  signal_key: string;
  payload: {
    job_id: number;
    job_no: number;
    job_name: string;
    margin_pct: number;
    prev_margin: number | null;
    threshold: number;
    revenue_cents: number;
    is_rapid_drop: boolean;
    title: string;
    summary: string;
  };
  sent_at: string;
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

type OverheadRow = {
  item_type: string;
  amount_cents: number;
  frequency: string;
  amortization_months: number | null;
};

function monthlyEquivalent(item: OverheadRow): number {
  if (item.item_type === "amortized") {
    return item.amortization_months
      ? Math.round(item.amount_cents / item.amortization_months)
      : 0;
  }
  if (item.frequency === "weekly") return Math.round((item.amount_cents * 52) / 12);
  if (item.frequency === "annual") return Math.round(item.amount_cents / 12);
  return item.amount_cents;
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

function startOfQuarter(d: Date) {
  const x = new Date(d);
  const q = Math.floor(x.getMonth() / 3) * 3;
  x.setMonth(q, 1);
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
      : range === "qtd"
      ? startOfQuarter(now)
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

function KpiCard({
  label,
  value,
  sub,
  color = "text-white/95",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${color}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-white/50">{sub}</div> : null}
    </div>
  );
}

function moneyFmt(cents: number) {
  return (Math.abs(cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const WA_NUMBER = "12316802664";

function EmptyStateBanner({ hasWhatsApp }: { hasWhatsApp: boolean }) {
  const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("expense $150 Home Depot")}`;
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-white/90">Your dashboard is ready — nothing here yet.</div>
          <div className="mt-1 text-xs text-white/50 max-w-md leading-relaxed">
            {hasWhatsApp
              ? "Start logging in WhatsApp and your numbers will appear here automatically."
              : "Link WhatsApp first, then log your first expense — it takes about 30 seconds."}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {hasWhatsApp ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition"
              >
                Log first expense in WhatsApp
              </a>
            ) : (
              <Link
                href="/app/welcome"
                className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition"
              >
                Complete setup
              </Link>
            )}
            <a
              href={`https://wa.me/${WA_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-xs text-white/60 hover:bg-white/5 transition"
            >
              Open WhatsApp
            </a>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Try texting Chief</div>
          <div className="font-mono text-xs text-white/50 bg-black/20 border border-white/10 rounded-lg px-3 py-2">
            expense $150 Home Depot
          </div>
        </div>
      </div>
    </div>
  );
}

function MarginAlertsBanner({
  alerts,
  onDismiss,
}: {
  alerts: MarginAlert[];
  onDismiss: (id: number, signalKey: string) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const p = alert.payload;
        const isRapidDrop = p?.is_rapid_drop;
        const jobId = p?.job_id;
        return (
          <div
            key={alert.id}
            className={[
              "flex flex-wrap items-start justify-between gap-3 rounded-[18px] border px-5 py-4",
              isRapidDrop
                ? "border-amber-500/30 bg-amber-500/[0.06]"
                : "border-red-500/30 bg-red-500/[0.06]",
            ].join(" ")}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={[
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                    isRapidDrop
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-red-500/20 text-red-400",
                  ].join(" ")}
                >
                  {isRapidDrop ? "Margin Declining" : "Low Margin"}
                </span>
                <span className="text-[11px] text-white/40">{p?.margin_pct}% margin</span>
              </div>
              <div className="mt-1.5 text-sm font-medium text-white/90">{p?.title}</div>
              <div className="mt-0.5 text-xs text-white/50 leading-relaxed">{p?.summary}</div>
              {jobId ? (
                <Link
                  href={`/app/jobs/${jobId}`}
                  className="mt-2 inline-flex items-center text-xs text-white/60 hover:text-white/90 underline underline-offset-2 transition"
                >
                  View job →
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(alert.id, alert.signal_key)}
              className="shrink-0 text-[11px] text-white/30 hover:text-white/70 transition mt-0.5"
              aria-label="Dismiss alert"
            >
              Dismiss
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AskChiefNudge({ txCount }: { txCount: number }) {
  const NUDGE_KEY = "chiefos:ask_chief_nudge_dismissed";
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(NUDGE_KEY) === "1");
    }
  }, []);

  if (!mounted || dismissed || txCount < 3) return null;

  return (
    <div className="rounded-[16px] border border-white/8 bg-white/[0.025] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-xs font-medium text-white/75">You have {txCount} transactions — Chief can answer questions about them.</div>
        <div className="mt-0.5 text-[11px] text-white/40">Try: "how did this month go?" or "which job made the most money?"</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/app/chief"
          className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-white/90 transition"
        >
          Ask Chief →
        </Link>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") localStorage.setItem(NUDGE_KEY, "1");
            setDismissed(true);
          }}
          className="text-[10px] text-white/25 hover:text-white/50 transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function CenterWorkspace({
  view,
  setView,
  summary,
  pulsePoints,
  pulseRows,
  pulseRange,
  setPulseRange,
  pulseLoading,
  monthlyOverhead,
  hasWhatsApp,
  marginAlerts,
  onDismissAlert,
  txCount,
  tenantCreatedAt,
  tenantCountry,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  summary: Summary;
  pulsePoints: PulsePoint[];
  pulseRows: TxRow[];
  pulseRange: RangeKey;
  setPulseRange: (v: RangeKey) => void;
  pulseLoading: boolean;
  monthlyOverhead: number;
  hasWhatsApp: boolean;
  marginAlerts: MarginAlert[];
  onDismissAlert: (id: number, signalKey: string) => void;
  txCount: number;
  tenantCreatedAt: string | null;
  tenantCountry: string | null;
}) {
  const isEmptyState = !pulseLoading && pulseRows.length === 0 && summary.totalJobs === 0;
  // Range-filtered financial totals
  const { rangeRevenue, rangeExpenses, rangeNet } = useMemo(() => {
    const now = new Date();
    const start =
      pulseRange === "wtd" ? startOfWeek(now)
      : pulseRange === "mtd" ? startOfMonth(now)
      : pulseRange === "qtd" ? startOfQuarter(now)
      : pulseRange === "ytd" ? startOfYear(now)
      : null;

    let rev = 0;
    let exp = 0;
    for (const row of pulseRows) {
      const raw = row.date || row.created_at;
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      if (start && d < start) continue;
      const cents = Number(row.amount_cents || 0);
      if (String(row.kind).toLowerCase() === "revenue") rev += cents;
      else if (String(row.kind).toLowerCase() === "expense") exp += cents;
    }
    return { rangeRevenue: rev, rangeExpenses: exp, rangeNet: rev - exp };
  }, [pulseRows, pulseRange]);

  const overheadForRange = useMemo(() => {
    const now = new Date();
    if (pulseRange === "wtd") return Math.round(monthlyOverhead * 7 / 30);
    if (pulseRange === "mtd") return monthlyOverhead;
    if (pulseRange === "qtd") return monthlyOverhead * 3;
    if (pulseRange === "ytd") return monthlyOverhead * (now.getMonth() + 1);
    return monthlyOverhead * 12;
  }, [monthlyOverhead, pulseRange]);

  const rangeLabel =
    pulseRange === "wtd" ? "This week"
    : pulseRange === "mtd" ? "This month"
    : pulseRange === "qtd" ? "This quarter"
    : pulseRange === "ytd" ? "This year"
    : "All time";

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Dashboard</div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white/95">Business overview</h1>
          <p className="mt-1.5 text-sm text-white/50">Your numbers at a glance — real data, real time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <UtilityLink href="/app/jobs/new" label="+ Create job" tone="primary" />
          <UtilityLink href="/app/uploads" label="Log / Upload" />
        </div>
      </div>

      {/* Margin alerts — shown when active jobs have low/declining margins */}
      <MarginAlertsBanner alerts={marginAlerts} onDismiss={onDismissAlert} />

      {/* Empty state guidance — shown only when there's no data yet */}
      {isEmptyState && <EmptyStateBanner hasWhatsApp={hasWhatsApp} />}

      {/* Onboarding progress — compact widget, hides itself when setup is done */}
      <OnboardingWidget hasWhatsApp={hasWhatsApp} hasData={txCount > 0} />

      {/* Ask Chief nudge — surfaces once ≥ 3 transactions exist */}
      <AskChiefNudge txCount={txCount} />

      {/* 8 KPI cards — 2 rows of 4 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={`Revenue (${rangeLabel})`}
          value={moneyFmt(rangeRevenue)}
          color="text-emerald-400"
        />
        <KpiCard
          label={`Expenses (${rangeLabel})`}
          value={moneyFmt(rangeExpenses)}
          color="text-white/90"
        />
        <KpiCard
          label={`Net profit (${rangeLabel})`}
          value={(rangeNet >= 0 ? "+" : "–") + moneyFmt(Math.abs(rangeNet))}
          color={rangeNet >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <KpiCard
          label="Monthly overhead"
          value={monthlyOverhead > 0 ? moneyFmt(monthlyOverhead) : "—"}
          sub="Fixed monthly burden"
          color="text-amber-400"
        />
        <KpiCard
          label={`True net (${rangeLabel})`}
          value={
            monthlyOverhead > 0
              ? ((rangeNet - overheadForRange) >= 0 ? "+" : "–") + moneyFmt(Math.abs(rangeNet - overheadForRange))
              : "—"
          }
          sub={monthlyOverhead > 0 ? "After overhead" : "Set overhead to see"}
          color={monthlyOverhead > 0
            ? (rangeNet - overheadForRange) >= 0 ? "text-emerald-400" : "text-red-400"
            : "text-white/40"}
        />
        <KpiCard
          label="Active jobs"
          value={String(summary.activeJobs)}
          sub={`${summary.totalJobs} total`}
        />
        <KpiCard
          label="Pending review"
          value={String(summary.pendingReview)}
          sub="Awaiting confirmation"
        />
        <KpiCard
          label="Open tasks"
          value={String(summary.openTasks)}
          sub="Still needs action"
        />
      </div>

      {/* Pulse chart */}
      <BusinessPulseChart
        points={pulsePoints}
        activeJobs={summary.activeJobs}
        totalJobs={summary.totalJobs}
        title="Business performance pulse"
        subtitle="Revenue, expenses, and profit — bucketed by day across your selected range."
        loading={pulseLoading}
        range={pulseRange}
        onRangeChange={setPulseRange}
      />

      {/* Revenue line chart — all-time from account creation */}
      <RevenueLineChart
        txRows={pulseRows as RevenueChartRow[]}
        accountCreatedAt={tenantCreatedAt}
        country={tenantCountry}
        loading={pulseLoading}
      />

      {/* Records panel */}
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Records</div>
            <div className="mt-2 text-lg font-semibold text-white/92">Business records</div>
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
                  {k === "expenses" ? "Expenses" : k === "revenue" ? "Revenue" : k === "time" ? "Time" : "Tasks"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <DashboardDataPanel view={view} selectedJobName={null} />
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const { loading, hasWhatsApp } = useTenantGate({ requireWhatsApp: false });
  const [view, setView] = useState<ViewKey>("expenses");
  const [pulseRange, setPulseRange] = useState<RangeKey>("mtd");
  const [pulseRows, setPulseRows] = useState<TxRow[]>([]);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [monthlyOverhead, setMonthlyOverhead] = useState(0);
  const [marginAlerts, setMarginAlerts] = useState<MarginAlert[]>([]);
  const [txCount, setTxCount] = useState(0);
  const [tenantCreatedAt, setTenantCreatedAt] = useState<string | null>(null);
  const [tenantCountry, setTenantCountry] = useState<string | null>(null);

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

        const userId = u?.user?.id || "";
        if (!userId) return;

        const { data: pu, error: puErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (puErr) return;

        const tenantId = (pu as any)?.tenant_id as string | null;
        if (!tenantId) return;

        const { data: tenant } = await supabase
          .from("chiefos_tenants")
          .select("name, owner_id, country, created_at")
          .eq("id", tenantId)
          .maybeSingle();

        if (alive && tenant) {
          setTenantCreatedAt((tenant as any).created_at ?? null);
          setTenantCountry((tenant as any).country ?? null);
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
            const rows = (txRows as TxRow[]) || [];
            setPulseRows(rows);
            setTxCount(rows.length);
            setPulseLoading(false);
          }
        } catch {
          if (alive) setPulseLoading(false);
        }

        try {
          const { data: overheadRows } = await supabase
            .from("overhead_items")
            .select("item_type, amount_cents, frequency, amortization_months")
            .eq("tenant_id", tenantId)
            .eq("active", true);

          if (alive && overheadRows) {
            const total = (overheadRows as OverheadRow[]).reduce(
              (sum, item) => sum + monthlyEquivalent(item),
              0
            );
            setMonthlyOverhead(total);
          }
        } catch {
          // fail-soft
        }

        // Margin alerts — unacknowledged, most recent first, max 5
        try {
          const { data: alertRows } = await supabase
            .from("insight_log")
            .select("id, signal_key, payload, sent_at")
            .eq("tenant_id", tenantId)
            .eq("kind", "margin_alert")
            .is("acknowledged_at", null)
            .order("sent_at", { ascending: false })
            .limit(5);

          if (alive && alertRows) {
            setMarginAlerts(alertRows as MarginAlert[]);
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
  }, []);

  const pulsePoints = useMemo(
    () => buildPulsePoints(pulseRows, pulseRange),
    [pulseRows, pulseRange]
  );

  async function handleDismissAlert(id: number, signalKey: string) {
    // Optimistically remove from UI
    setMarginAlerts((prev) => prev.filter((a) => a.id !== id));
    // Write acknowledged_at — RLS allows tenant reads; service role writes on backend
    // We update via a Next.js route to ensure server-side auth for the write
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token || "";
      await fetch("/api/alerts/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, signal_key: signalKey }),
      });
    } catch {
      // fail-soft: UI already updated
    }
  }

  if (loading) return <div className="p-8 text-white/70">Loading your workspace…</div>;

  return (
    <div className="mx-auto max-w-6xl py-2">
      <CenterWorkspace
        view={view}
        setView={setView}
        summary={summary}
        pulsePoints={pulsePoints}
        pulseRows={pulseRows}
        pulseRange={pulseRange}
        setPulseRange={setPulseRange}
        pulseLoading={pulseLoading}
        monthlyOverhead={monthlyOverhead}
        hasWhatsApp={hasWhatsApp}
        marginAlerts={marginAlerts}
        onDismissAlert={handleDismissAlert}
        txCount={txCount}
        tenantCreatedAt={tenantCreatedAt}
        tenantCountry={tenantCountry}
      />
    </div>
  );
}