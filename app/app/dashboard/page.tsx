"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

import AskChiefMini from "@/app/app/components/AskChiefMini";
import AskChiefCommandsPanel from "@/app/app/components/AskChiefCommandsPanel";
import JobsDecisionCenterPanel from "@/app/app/components/JobsDecisionCenterPanel";
import DecisionCenterNav from "@/app/app/components/DecisionCenterNav";
import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";

function prettyFromEmail(email?: string | null) {
  if (!email) return "";
  const left = email.split("@")[0] || "";
  if (!left) return "";
  const cleaned = left.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

type ViewKey = "expenses" | "revenue" | "time" | "tasks";

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

type ActivationState = {
  hasWhatsApp: boolean;
  hasJob: boolean;
  hasExpense: boolean;
};

function nextActionFromState(state: ActivationState) {
  if (!state.hasWhatsApp) {
    return {
      eyebrow: "Next action",
      title: "Connect WhatsApp",
      body:
        "ChiefOS works best when capture starts where work happens. Connect your phone, then create your first job.",
      primaryLabel: "Connect WhatsApp",
      primaryHref: "/app/connect-whatsapp?returnTo=/app/dashboard",
      secondaryLabel: "Why WhatsApp?",
      secondaryHref: "#command-reference",
      status: "Step 1 of 3",
    };
  }

  if (!state.hasJob) {
    return {
      eyebrow: "Next action",
      title: "Create your first job",
      body:
        "Every expense, shift, and task gets clearer when it belongs to a job. Start by creating the first one.",
      primaryLabel: "Open Jobs",
      primaryHref: "/app/jobs",
      secondaryLabel: "Use an example",
      secondaryHref: "#command-reference",
      status: "Step 2 of 3",
    };
  }

  if (!state.hasExpense) {
    return {
      eyebrow: "Next action",
      title: "Log your first expense",
      body:
        "The fastest way to feel ChiefOS working is to capture a real expense and see it land inside the system.",
      primaryLabel: "See example",
      primaryHref: "#command-reference",
      secondaryLabel: "Ask Chief after",
      secondaryHref: "/app/chief?q=What%20did%20I%20spend%20today%3F",
      status: "Step 3 of 3",
    };
  }

  return {
    eyebrow: "Workspace ready",
    title: "Ask Chief something real",
    body:
      "Your workspace is active. Ask about spend, revenue, margin, or job activity and use the dashboard as your operating center.",
    primaryLabel: "Open Chief",
    primaryHref: "/app/chief",
    secondaryLabel: "Browse records",
    secondaryHref: "#decision-center",
    status: "Ready",
  };
}

function QuickAction({
  href,
  label,
  muted,
}: {
  href: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <a
      href={href}
      className={[
        "inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold transition",
        muted
          ? "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
          : "border-white/15 bg-white text-black hover:bg-white/90",
      ].join(" ")}
    >
      {label}
    </a>
  );
}

export default function DashboardPage() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const { loading, hasWhatsApp } = gate;

  const [workspaceName, setWorkspaceName] = useState<string>("Your system");
  const [view, setView] = useState<ViewKey>("expenses");
  const [activation, setActivation] = useState<ActivationState>({
    hasWhatsApp: !!hasWhatsApp,
    hasJob: false,
    hasExpense: false,
  });

  useEffect(() => {
    setActivation((s) => ({ ...s, hasWhatsApp: !!hasWhatsApp }));
  }, [hasWhatsApp]);

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
          .select("name")
          .eq("id", tenantId)
          .maybeSingle();

        if (!tErr && alive) {
          const tenantName = ((t as any)?.name as string | null) || null;
          setWorkspaceName(
            pickBestName({
              tenantName,
              metaFallback,
              emailFallback,
            })
          );
        }

        // Lightweight activation truth
        // fail-soft if tables/views differ
        try {
          const [{ count: jobCount }, { count: expenseCount }] = await Promise.all([
            supabase
              .from("jobs")
              .select("*", { count: "exact", head: true }),
            supabase
              .from("chiefos_portal_expenses")
              .select("*", { count: "exact", head: true }),
          ]);

          if (!alive) return;

          setActivation((s) => ({
            ...s,
            hasJob: Number(jobCount || 0) > 0,
            hasExpense: Number(expenseCount || 0) > 0,
          }));
        } catch {
          // fail-soft intentionally
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
  const nextAction = useMemo(() => nextActionFromState(activation), [activation]);

  if (loading) return <div className="p-8 text-white/70">Loading your workspace…</div>;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-5 md:py-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Workspace</div>
            <div className="mt-1 truncate text-lg font-semibold text-white/90">{titleLine}</div>
            <div className="mt-1 text-sm text-white/50">
              Your operating center for jobs, money, and decisions.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <QuickAction href="/app/chief" label="Ask Chief" />
            <QuickAction href="/app/connect-whatsapp?returnTo=/app/dashboard" label="Connect WhatsApp" muted />
            <QuickAction href="#command-reference" label="Command examples" muted />
          </div>
        </div>

        {/* Top row */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          {/* Next Action + Ask Chief */}
          <div className="space-y-4">
            <section className="rounded-[28px] border border-white/10 bg-black/60 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-white/45">{nextAction.eyebrow}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
                    {nextAction.title}
                  </div>
                  <div className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
                    {nextAction.body}
                  </div>
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                  {nextAction.status}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={nextAction.primaryHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
                >
                  {nextAction.primaryLabel}
                </a>

                <a
                  href={nextAction.secondaryHref}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  {nextAction.secondaryLabel}
                </a>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-[11px] text-white/60">
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  {activation.hasWhatsApp ? "WhatsApp connected" : "WhatsApp not connected"}
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  {activation.hasJob ? "Job created" : "No job yet"}
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  {activation.hasExpense ? "Expense logged" : "No expense yet"}
                </span>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-black/60 px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-white/50">Ask Chief</div>
                  <div className="text-sm text-white/70">
                    Ask about spend, revenue, margin, jobs, or what is missing.
                  </div>
                </div>

                <div className="hidden sm:block text-[11px] text-white/40">Live</div>
              </div>

              <div className="mt-3">
                <AskChiefMini />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
                <a
                  href="/app/chief?q=What%20did%20I%20spend%20this%20week%3F"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  What did I spend this week?
                </a>
                <a
                  href="/app/chief?q=Did%20my%20main%20job%20make%20money%20yet%3F"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  Did my main job make money yet?
                </a>
                <a
                  href="/app/chief?q=What%E2%80%99s%20missing%20from%20today%E2%80%99s%20records%3F"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10"
                >
                  What’s missing from today’s records?
                </a>
              </div>
            </section>
          </div>

          {/* Command reference */}
          <div className="xl:sticky xl:top-4 h-fit" id="command-reference">
            <AskChiefCommandsPanel />
          </div>
        </div>

        {/* Decision center */}
        <div id="decision-center" className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0">
            <JobsDecisionCenterPanel title="Jobs" />
          </div>

          <div className="min-w-0 space-y-3">
            <section className="rounded-[24px] border border-white/10 bg-black/50 p-4">
              <div className="text-xs text-white/45">Decision center</div>
              <div className="mt-1 text-sm text-white/70">
                Browse records while you ask questions. This keeps the dashboard useful without forcing navigation.
              </div>

              <DecisionCenterNav view={view} setView={setView} />
            </section>

            <DashboardDataPanel view={view} />
          </div>
        </div>
      </div>
    </main>
  );
}