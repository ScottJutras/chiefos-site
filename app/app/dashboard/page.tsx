"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

import AskChiefMini from "@/app/app/components/AskChiefMini";
import AskChiefCommandsPanel from "@/app/app/components/AskChiefCommandsPanel";
import JobsDecisionCenterPanel from "@/app/app/components/JobsDecisionCenterPanel";
import DecisionCenterNav from "@/app/app/components/DecisionCenterNav";
import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";

type ViewKey = "expenses" | "revenue" | "time" | "tasks";

type DashboardSummary = {
  activeJobs: number;
  totalJobs: number;
  pendingReview: number;
  openTasks: number;
  expenseCount7d: number;
  expenseTotal7dCents: number;
  revenueCount7d: number;
  revenueTotal7dCents: number;
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

function money(cents?: number | null) {
  const n = Number(cents ?? 0);
  return (n / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function SummaryBand({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-l border-white/10 pl-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white/90">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/50">{hint}</div> : null}
    </div>
  );
}

function ActionButton({
  href,
  label,
  kind = "secondary",
}: {
  href: string;
  label: string;
  kind?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
        kind === "primary"
          ? "bg-white text-black hover:bg-white/90"
          : "border border-white/10 bg-white/5 text-white/85 hover:bg-white/10",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function DailyBriefing({
  hasWhatsApp,
  summary,
  workspaceName,
}: {
  hasWhatsApp: boolean;
  summary: DashboardSummary;
  workspaceName: string;
}) {
  const lines = useMemo(() => {
    const output: string[] = [];

    if (!hasWhatsApp) {
      output.push("Connect WhatsApp first so field capture can flow into the right jobs.");
    }

    if (summary.activeJobs > 0) {
      output.push(
        `You have ${summary.activeJobs} active ${summary.activeJobs === 1 ? "job" : "jobs"} in motion.`
      );
    } else if (summary.totalJobs > 0) {
      output.push(`You have ${summary.totalJobs} jobs on file, but none marked active right now.`);
    } else {
      output.push("You do not have any jobs yet. Create your first job to make ChiefOS feel real.");
    }

    if (summary.pendingReview > 0) {
      output.push(
        `${summary.pendingReview} ${summary.pendingReview === 1 ? "item is" : "items are"} waiting in Pending Review before becoming truth.`
      );
    } else {
      output.push("Nothing is waiting in Pending Review right now.");
    }

    if (summary.openTasks > 0) {
      output.push(
        `${summary.openTasks} ${summary.openTasks === 1 ? "task remains" : "tasks remain"} open.`
      );
    }

    if (summary.expenseCount7d > 0 || summary.revenueCount7d > 0) {
      output.push(
        `Last 7 days: ${money(summary.revenueTotal7dCents)} revenue and ${money(summary.expenseTotal7dCents)} expenses captured.`
      );
    } else {
      output.push("No recent money activity is visible yet in the last 7 days.");
    }

    return output;
  }, [hasWhatsApp, summary]);

  return (
    <section className="rounded-[28px] border border-white/10 bg-black/50 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Daily Briefing
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-white">
            {workspaceName}
          </h1>
          <div className="mt-2 text-sm text-white/55">
            Jobs-first operating center
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!hasWhatsApp ? (
            <ActionButton href="/app/connect-whatsapp" label="Connect WhatsApp" kind="primary" />
          ) : null}
          <ActionButton href="/app/uploads" label="Upload receipts / files" />
          <ActionButton href="/app/pending-review" label="Open Pending Review" />
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {lines.map((line) => (
          <div
            key={line}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75"
          >
            {line}
          </div>
        ))}
      </div>
    </section>
  );
}

function NextActionBand({
  hasWhatsApp,
  pendingReview,
  totalJobs,
}: {
  hasWhatsApp: boolean;
  pendingReview: number;
  totalJobs: number;
}) {
  const state = !hasWhatsApp
    ? {
        title: "Connect WhatsApp",
        body: "Start capture where work actually happens. Once connected, ChiefOS becomes much easier to use in the field.",
        href: "/app/connect-whatsapp",
        label: "Connect now",
      }
    : totalJobs === 0
      ? {
          title: "Create your first job",
          body: "Jobs are the spine. Everything should attach to a job before it turns into useful answers.",
          href: "/app/chief?q=Create%20job%20",
          label: "Create via Chief",
        }
      : pendingReview > 0
        ? {
            title: "Clear Pending Review",
            body: "Low-confidence or ambiguous items should be reviewed before they touch canonical truth.",
            href: "/app/pending-review",
            label: "Review now",
          }
        : {
            title: "Ask a job question",
            body: "Now that the system has structure, use Chief to ask what changed, what is missing, or where margin went.",
            href: "/app/chief",
            label: "Open Chief",
          };

  return (
    <section className="rounded-[28px] border border-white/10 bg-black/40 px-5 py-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Next Action</div>
      <div className="mt-2 text-xl font-semibold text-white/90">{state.title}</div>
      <div className="mt-2 text-sm leading-relaxed text-white/65">{state.body}</div>
      <div className="mt-4">
        <ActionButton href={state.href} label={state.label} kind="primary" />
      </div>
    </section>
  );
}

function GovernanceBand({
  betaPlan,
  pendingReview,
}: {
  betaPlan?: string | null;
  pendingReview: number;
}) {
  const isPro = betaPlan === "pro";

  return (
    <section className="rounded-[28px] border border-white/10 bg-black/40 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Governance</div>
          <div className="mt-2 text-lg font-semibold text-white/90">Review, approvals, trace</div>
        </div>

        <div
          className={[
            "rounded-full border px-2.5 py-1 text-[11px]",
            isPro
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
              : "border-white/10 bg-white/5 text-white/55",
          ].join(" ")}
        >
          {isPro ? "Pro" : "Starter / Free"}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-sm font-semibold text-white/85">Pending Review</div>
          <div className="mt-1 text-sm text-white/65">
            {pendingReview > 0
              ? `${pendingReview} items are waiting for owner confirmation.`
              : "No items are waiting right now."}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-sm font-semibold text-white/85">Approvals</div>
          <div className="mt-1 text-sm text-white/65">
            {isPro
              ? "Pro governance is where employee edits, approvals, and audit controls belong."
              : "Approvals are a Pro governance feature. Keep this calm and visible, but fail closed on lower tiers."}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton href="/app/pending-review" label="Open Pending Review" />
        {isPro ? <ActionButton href="/app/crew/inbox" label="Open Crew Inbox" /> : null}
        {!isPro ? <ActionButton href="/app/settings/billing" label="See Pro governance" /> : null}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const {
    loading,
    hasWhatsApp,
    betaPlan,
  } = useTenantGate({ requireWhatsApp: false });

  const [workspaceName, setWorkspaceName] = useState<string>("Your system");
  const [view, setView] = useState<ViewKey>("expenses");

  const [summary, setSummary] = useState<DashboardSummary>({
    activeJobs: 0,
    totalJobs: 0,
    pendingReview: 0,
    openTasks: 0,
    expenseCount7d: 0,
    expenseTotal7dCents: 0,
    revenueCount7d: 0,
    revenueTotal7dCents: 0,
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

        const { data: t, error: tErr } = await supabase
          .from("chiefos_tenants")
          .select("name, owner_id")
          .eq("id", tenantId)
          .maybeSingle();

        const tenantName = ((t as any)?.name as string | null) || null;
        const ownerId = String((t as any)?.owner_id || "").trim() || null;

        if (alive) {
          setWorkspaceName(
            pickBestName({
              tenantName,
              metaFallback,
              emailFallback,
            })
          );
        }

        // Jobs summary
        try {
          const { data: jobsData } = await supabase
            .from("jobs")
            .select("id, status, active, created_at")
            .order("created_at", { ascending: false })
            .limit(500);

          const jobs = Array.isArray(jobsData) ? jobsData : [];
          const activeJobs = jobs.filter((j: any) => {
            const s = String(j?.status || "").toLowerCase();
            return !!j?.active || s === "active" || s === "open";
          }).length;

          if (alive) {
            setSummary((s) => ({
              ...s,
              totalJobs: jobs.length,
              activeJobs,
            }));
          }
        } catch {
          // fail-soft
        }

        // Pending review summary
        try {
          const { data: reviewItems } = await supabase
            .from("intake_items")
            .select("id, status")
            .eq("tenant_id", tenantId)
            .in("status", ["pending_review", "uploaded", "validated", "extracted"]);

          if (alive) {
            setSummary((s) => ({
              ...s,
              pendingReview: Array.isArray(reviewItems) ? reviewItems.length : 0,
            }));
          }
        } catch {
          // fail-soft
        }

        // Expenses 7d via portal-safe surface
        try {
          const today = new Date();
          const start = new Date(today);
          start.setDate(today.getDate() - 7);
          const startStr = formatDateInput(start);

          const { data: expenses } = await supabase
            .from("chiefos_portal_expenses")
            .select("id, amount_cents, expense_date, created_at")
            .gte("expense_date", startStr)
            .order("created_at", { ascending: false })
            .limit(500);

          const rows = Array.isArray(expenses) ? expenses : [];
          const total = rows.reduce((sum: number, row: any) => sum + Number(row?.amount_cents || 0), 0);

          if (alive) {
            setSummary((s) => ({
              ...s,
              expenseCount7d: rows.length,
              expenseTotal7dCents: total,
            }));
          }
        } catch {
          // fail-soft
        }

        // Revenue 7d from canonical spine
        try {
          const today = new Date();
          const start = new Date(today);
          start.setDate(today.getDate() - 7);
          const startStr = formatDateInput(start);

          const { data: revenueRows } = await supabase
            .from("transactions")
            .select("id, amount_cents, date")
            .eq("tenant_id", tenantId)
            .eq("kind", "revenue")
            .gte("date", startStr)
            .order("date", { ascending: false })
            .limit(500);

          const rows = Array.isArray(revenueRows) ? revenueRows : [];
          const total = rows.reduce((sum: number, row: any) => sum + Number(row?.amount_cents || 0), 0);

          if (alive) {
            setSummary((s) => ({
              ...s,
              revenueCount7d: rows.length,
              revenueTotal7dCents: total,
            }));
          }
        } catch {
          // fail-soft
        }

        // Tasks summary (owner-safe if available)
        if (ownerId) {
          try {
            const { data: tasksRows } = await supabase
              .from("tasks")
              .select("id, status, created_at")
              .eq("owner_id", ownerId)
              .order("created_at", { ascending: false })
              .limit(500);

            const openTasks = Array.isArray(tasksRows)
              ? tasksRows.filter((r: any) => {
                  const s = String(r?.status || "").toLowerCase();
                  return s !== "done" && s !== "completed" && s !== "closed";
                }).length
              : 0;

            if (alive) {
              setSummary((s) => ({
                ...s,
                openTasks,
              }));
            }
          } catch {
            // fail-soft
          }
        }
      } catch {
        // fail-soft
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const titleLine = useMemo(() => workspaceName || "Your system", [workspaceName]);

  if (loading) return <div className="p-8 text-white/70">Loading your workspace…</div>;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1600px] px-4 py-4">
        {/* Top strip */}
        <section className="mb-4 rounded-[28px] border border-white/10 bg-black/60 px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                ChiefOS
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-white/92">
                Jobs Operating Center
              </div>
              <div className="mt-2 text-sm text-white/55">
                Jobs first. Review fast. Ask clearly. Keep everything attached to work that actually happened.
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryBand label="Active Jobs" value={String(summary.activeJobs)} hint={`${summary.totalJobs} total`} />
              <SummaryBand label="Pending Review" value={String(summary.pendingReview)} hint="Owner review lane" />
              <SummaryBand label="Tasks Open" value={String(summary.openTasks)} hint="Needs action" />
              <SummaryBand
                label="7d Capture"
                value={`${money(summary.revenueTotal7dCents)} / ${money(summary.expenseTotal7dCents)}`}
                hint="Revenue / expenses"
              />
            </div>
          </div>
        </section>

        {/* Briefing + right rail */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="min-w-0">
            <DailyBriefing
              hasWhatsApp={hasWhatsApp}
              summary={summary}
              workspaceName={titleLine}
            />
          </div>

          <div className="min-w-0 space-y-4">
            <NextActionBand
              hasWhatsApp={hasWhatsApp}
              pendingReview={summary.pendingReview}
              totalJobs={summary.totalJobs}
            />

            <section className="rounded-[28px] border border-white/10 bg-black/40 px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                    Ask Chief
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white/90">
                    Ask about jobs, spend, revenue, or what is missing
                  </div>
                </div>

                <div className="hidden sm:block text-[11px] text-white/40">
                  Owner-only
                </div>
              </div>

              <div className="mt-4">
                <AskChiefMini />
              </div>
            </section>

            <GovernanceBand betaPlan={betaPlan} pendingReview={summary.pendingReview} />
          </div>
        </div>

        {/* Main body */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">
            <section className="rounded-[28px] border border-white/10 bg-black/40 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                    Jobs
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white/90">
                    Find the job. Then inspect everything attached to it.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton href="/app/chief?q=Create%20job%20" label="Create job" />
                  <ActionButton href="/app/uploads" label="Upload receipt / file" />
                </div>
              </div>

              <div className="mt-5">
                <JobsDecisionCenterPanel title="Jobs" />
              </div>
            </section>
          </div>

          <div className="min-w-0 space-y-4">
            <section id="records" className="rounded-[28px] border border-white/10 bg-black/40 px-5 py-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                Records
              </div>
              <div className="mt-2 text-xl font-semibold text-white/90">
                Review the latest underlying records while you think
              </div>

              <div className="mt-4">
                <DecisionCenterNav view={view} setView={setView} />
              </div>

              <div className="mt-4">
                <DashboardDataPanel view={view} />
              </div>
            </section>

            <section id="command-reference" className="rounded-[28px] border border-white/10 bg-black/40 px-5 py-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                Prompt Reference
              </div>
              <div className="mt-2 text-xl font-semibold text-white/90">
                Questions that work now
              </div>
              <div className="mt-4">
                <AskChiefCommandsPanel maxHeightClassName="max-h-[45vh]" />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}