"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

import AskChiefMini from "@/app/app/components/AskChiefMini";
import JobsDecisionCenterPanel from "@/app/app/components/JobsDecisionCenterPanel";
import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";

type ViewKey = "expenses" | "revenue" | "time" | "tasks";

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

function FlatMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-b border-white/8 py-3 last:border-b-0">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white/90">{value}</div>
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
        `${String(selectedJob.job_name || selectedJob.name || "This job")} is selected. Use the center pane to inspect the records tied to it.`
      );
    } else if (summary.totalJobs === 0) {
      out.push("Create your first job. Jobs are the spine of ChiefOS.");
    } else {
      out.push("Pick a job from the left rail to inspect its records, activity, and costs.");
    }

    if (summary.pendingReview > 0) {
      out.push(
        `${summary.pendingReview} item${summary.pendingReview === 1 ? " is" : "s are"} waiting in Pending Review before touching truth.`
      );
    } else {
      out.push("Nothing is waiting in Pending Review right now.");
    }

    if (summary.openTasks > 0) {
      out.push(`${summary.openTasks} task${summary.openTasks === 1 ? "" : "s"} still need attention.`);
    }

    return out;
  }, [hasWhatsApp, summary, selectedJob]);

  return (
    <div className="border-b border-white/10 px-5 py-5">
      <SectionTitle
        eyebrow="Daily Briefing"
        title="Run the business from jobs"
        body="Jobs first. Review fast. Ask clearly. Keep every record attached to real work."
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
    <div className="flex h-full min-h-[78vh] flex-col bg-black">
      {/* Header */}
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Workspace</div>
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

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {!selectedJob ? (
          <div className="flex h-full min-h-[340px] items-center justify-center">
            <div className="max-w-md text-center">
              <div className="text-lg font-semibold text-white/90">Pick a job to begin</div>
              <div className="mt-3 text-sm leading-relaxed text-white/60">
                ChiefOS should feel like a job operating center, not a widget dashboard.
                Start with the job, then inspect the records tied to it.
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
  workspaceName,
  hasWhatsApp,
  betaPlan,
  summary,
}: {
  workspaceName: string;
  hasWhatsApp: boolean;
  betaPlan?: string | null;
  summary: Summary;
}) {
  return (
    <div className="flex h-full min-h-[78vh] flex-col bg-black">
      <DailyBriefing hasWhatsApp={hasWhatsApp} summary={summary} selectedJob={null} />

      <div className="border-b border-white/10 px-5 py-5">
        <SectionTitle
          eyebrow="Ask Chief"
          title="Ask without digging"
          body="Chief should be available wherever the owner can see the data — without feeling like a bot."
        />

        <div className="mt-4">
          <AskChiefMini />
        </div>
      </div>

      <div className="border-b border-white/10 px-5 py-5">
        <SectionTitle
          eyebrow="Key Signals"
          title="What needs attention"
        />

        <div className="mt-3">
          <FlatMetric
            label="Pending Review"
            value={String(summary.pendingReview)}
            hint="Owner confirmation lane"
          />
          <FlatMetric
            label="Active Jobs"
            value={String(summary.activeJobs)}
            hint={`${summary.totalJobs} total jobs`}
          />
          <FlatMetric
            label="Open Tasks"
            value={String(summary.openTasks)}
            hint="Still needs action"
          />
        </div>
      </div>

      <div className="border-b border-white/10 px-5 py-5">
        <SectionTitle
          eyebrow="Next Actions"
          title="Move the operation forward"
        />

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

      <div className="min-h-0 flex-1 px-5 py-5">
        <SectionTitle
          eyebrow="Trust-first"
          title="Why this feels different"
          body="ChiefOS does not silently mutate ambiguous data. It should stop, show evidence, and ask."
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { loading, hasWhatsApp, betaPlan } = useTenantGate({ requireWhatsApp: false });

  const [workspaceName, setWorkspaceName] = useState<string>("Your system");
  const [view, setView] = useState<ViewKey>("expenses");
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);

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

        // Jobs summary + default selected job
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

        // Pending review
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

        // Open tasks
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
      } catch {
        // fail-soft
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedJob]);

  if (loading) return <div className="p-8 text-white/70">Loading your workspace…</div>;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1700px] px-0 py-0">
        {/* One page shell, 3 panes */}
        <div className="grid min-h-[calc(100vh-72px)] grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)_340px]">
          {/* Left rail */}
          <div className="border-r border-white/10">
            <JobsDecisionCenterPanel
              selectedJobId={selectedJob?.id ?? null}
              onSelectJob={(job) => setSelectedJob(job)}
            />
          </div>

          {/* Center workspace */}
          <div className="min-w-0">
            <CenterWorkspace selectedJob={selectedJob} view={view} setView={setView} />
          </div>

          {/* Right utility rail */}
          <div className="border-l border-white/10">
            <RightRail
              workspaceName={workspaceName}
              hasWhatsApp={hasWhatsApp}
              betaPlan={betaPlan}
              summary={summary}
            />
          </div>
        </div>
      </div>
    </main>
  );
}