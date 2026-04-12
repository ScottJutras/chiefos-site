"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type StepKey =
  | "verify-account"
  | "load-signup"
  | "resolve-workspace"
  | "create-workspace"
  | "record-agreement"
  | "activate-access"
  | "done";

type PendingSignup = {
  id: string;
  email: string;
  owner_name: string | null;
  company_name: string | null;
  country: string | null;
  province: string | null;
  signup_mode: string | null;
  requested_plan_key: string | null;

  terms_accepted_at: string | null;
  terms_version: string | null;

  privacy_accepted_at: string | null;
  privacy_version: string | null;

  ai_policy_accepted_at: string | null;
  ai_policy_version: string | null;

  dpa_acknowledged_at: string | null;
  dpa_version: string | null;

  accepted_via: string | null;
};

type PlanTier = "free" | "starter" | "pro" | null;

function normalizePlan(raw: string | null): PlanTier {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("pro")) return "pro";
  if (s.includes("starter")) return "starter";
  if (s === "free") return "free";
  return null;
}

function isFree(plan: PlanTier) {
  return plan === "free" || plan === null;
}

function getHypeLine(
  step: StepKey,
  ownerName: string | null,
  companyName: string | null,
  plan: PlanTier,
  isReturning: boolean
): string {
  const biz = companyName ?? "your business";
  if (isReturning) return `Welcome back. Chief is getting ${biz} ready.`;

  const ownerPrefix = ownerName ? `${ownerName} wants` : `${biz} is about`;

  switch (step) {
    case "verify-account":
      return "Chief is standing by.";
    case "load-signup":
      return `${ownerPrefix} to increase ${biz}'s profit.`;
    case "resolve-workspace":
    case "create-workspace":
      return `Building ${biz}'s command center.`;
    case "record-agreement":
      return "Your agreements are locked in. Chief is almost ready.";
    case "activate-access":
      return isFree(plan)
        ? `${biz} is online. Want more firepower?`
        : `${biz} just got an unfair advantage.`;
    case "done":
      return "Chief is ready. Let's go.";
    default:
      return "Chief is setting up your workspace.";
  }
}

function getStepDescription(
  key: StepKey,
  companyName: string | null,
  plan: PlanTier
): string {
  const biz = companyName ?? "your workspace";
  switch (key) {
    case "verify-account":
      return "Confirming your identity before we begin.";
    case "load-signup":
      return `Retrieving ${biz}'s setup details.`;
    case "resolve-workspace":
      return `Checking if ${biz} already exists.`;
    case "create-workspace":
      return `Building ${biz}'s command center from scratch.`;
    case "record-agreement":
      return "Securing your accepted agreements on record.";
    case "activate-access":
      return isFree(plan)
        ? `Preparing ${biz}'s workspace.`
        : `Unlocking ${biz}'s full operating system.`;
    case "done":
      return "Everything is in place. Taking you in.";
  }
}

type Step = { key: StepKey; label: string };

const STEPS: Step[] = [
  { key: "verify-account", label: "Verify account" },
  { key: "load-signup", label: "Load setup details" },
  { key: "resolve-workspace", label: "Resolve workspace" },
  { key: "create-workspace", label: "Create workspace" },
  { key: "record-agreement", label: "Record agreement" },
  { key: "activate-access", label: "Activate access" },
];

function stepState(
  steps: Step[],
  stepKey: StepKey,
  activeStepKey: StepKey,
  isError: boolean
): "done" | "active" | "upcoming" | "error" {
  if (isError && activeStepKey === stepKey) return "error";
  const activeIdx = steps.findIndex((s) => s.key === activeStepKey);
  const thisIdx = steps.findIndex((s) => s.key === stepKey);
  if (activeIdx === -1 || thisIdx === -1) return "upcoming";
  if (thisIdx < activeIdx) return "done";
  if (thisIdx === activeIdx) return "active";
  return "upcoming";
}

function progressPercent(activeStepKey: StepKey, isError: boolean): number {
  const activeIdx = STEPS.findIndex((s) => s.key === activeStepKey);
  if (activeIdx === -1) return 12;
  const base = ((activeIdx + 1) / STEPS.length) * 100;
  if (isError) return Math.max(18, Math.min(92, base));
  return Math.max(12, Math.min(100, base));
}

// ──────────────────────────────────────────────
// Plan feature definitions
// ──────────────────────────────────────────────

const FREE_INCLUDED = [
  "Expense capture via WhatsApp",
  "Basic time tracking",
  "Chief conversation",
];

const FREE_LOCKED = [
  "Revenue tracking",
  "Export to accountant",
  "Job-based reporting",
  "Mileage tracking",
  "Multi-employee capture",
];

const STARTER_INCLUDED = [
  "Expense capture via WhatsApp",
  "Revenue tracking",
  "Time tracking",
  "Export to accountant",
  "Job-based reporting",
  "Mileage tracking",
  "Multi-employee capture",
];

const PRO_INCLUDED = [
  "Everything in Starter",
  "Priority support",
  "Advanced analytics",
  "Custom workflows",
];

// ──────────────────────────────────────────────
// Right panel sub-components
// ──────────────────────────────────────────────

function ChiefBadge() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[rgba(212,168,83,0.25)] bg-[rgba(212,168,83,0.06)] px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(212,168,83,0.4)] bg-[rgba(212,168,83,0.12)] text-sm font-bold text-[#D4A853]">
        C
      </div>
      <div>
        <div className="text-sm font-semibold text-[#E8E2D8]">Chief</div>
        <div className="text-xs text-[#706A60]">Your personal CFO</div>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-[#706A60]">Online</span>
      </div>
    </div>
  );
}

function FeatureRow({ label, included }: { label: string; included: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span
        className={[
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          included
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-red-500/15 text-red-400",
        ].join(" ")}
      >
        {included ? "✓" : "✗"}
      </span>
      <span
        className={[
          included ? "text-[#A8A090]" : "text-red-400/70 line-through",
        ].join(" ")}
      >
        {label}
      </span>
    </div>
  );
}

function PlanPanel({ plan }: { plan: PlanTier }) {
  if (plan === "pro") {
    return (
      <div className="rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.04)] p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#D4A853]">
          Pro workspace unlocked
        </div>
        <div className="space-y-2">
          {PRO_INCLUDED.map((f) => (
            <FeatureRow key={f} label={f} included />
          ))}
        </div>
      </div>
    );
  }

  if (plan === "starter") {
    return (
      <div className="rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.04)] p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#D4A853]">
          Starter workspace unlocked
        </div>
        <div className="space-y-2">
          {STARTER_INCLUDED.map((f) => (
            <FeatureRow key={f} label={f} included />
          ))}
        </div>
      </div>
    );
  }

  // Free (default)
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[rgba(212,168,83,0.15)] bg-[rgba(212,168,83,0.04)] p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#706A60]">
          Your free workspace includes
        </div>
        <div className="space-y-2">
          {FREE_INCLUDED.map((f) => (
            <FeatureRow key={f} label={f} included />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-red-400/80">
          Unlock more with Starter
        </div>
        <div className="space-y-2">
          {FREE_LOCKED.map((f) => (
            <FeatureRow key={f} label={f} included={false} />
          ))}
        </div>
        <a
          href="/pricing"
          className="mt-4 inline-flex w-full items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-4 py-2.5 text-xs font-semibold text-[#D4A853] transition hover:bg-[rgba(212,168,83,0.15)]"
        >
          Upgrade to Starter →
        </a>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

export default function FinishSignupClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const returnTo = useMemo(() => {
    const raw = sp.get("returnTo") || "";
    if (!raw.startsWith("/")) return "/app/welcome";
    if (raw.startsWith("//")) return "/app/welcome";
    return raw;
  }, [sp]);

  const [status, setStatus] = useState("Verifying your account…");
  const [activeStep, setActiveStep] = useState<StepKey>("verify-account");
  const [isError, setIsError] = useState(false);

  // Personalization state
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanTier>(null);
  const [isReturning, setIsReturning] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const hypeLine = useMemo(
    () => getHypeLine(activeStep, ownerName, companyName, plan, isReturning),
    [activeStep, ownerName, companyName, plan, isReturning]
  );

  const pct = progressPercent(activeStep, isError);

  useEffect(() => {
    let cancelled = false;

    async function getPendingSignup(): Promise<PendingSignup | null> {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) return null;

      const res = await fetch("/api/auth/pending-signup", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load pending signup.");
      return j?.pendingSignup || null;
    }

    async function consumePendingSignup() {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) return;

      const res = await fetch("/api/auth/pending-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: "consume" }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to consume pending signup.");
    }

    async function writeLegalAcceptance(pending: PendingSignup | null) {
      if (!pending) return;

      if (
        !pending.terms_accepted_at ||
        !pending.privacy_accepted_at ||
        !pending.ai_policy_accepted_at ||
        !pending.dpa_acknowledged_at ||
        !pending.terms_version ||
        !pending.privacy_version ||
        !pending.ai_policy_version ||
        !pending.dpa_version
      ) {
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) return;

      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          termsAcceptedAt: pending.terms_accepted_at,
          privacyAcceptedAt: pending.privacy_accepted_at,
          aiPolicyAcceptedAt: pending.ai_policy_accepted_at,
          dpaAcknowledgedAt: pending.dpa_acknowledged_at,
          termsVersion: pending.terms_version,
          privacyVersion: pending.privacy_version,
          aiPolicyVersion: pending.ai_policy_version,
          dpaVersion: pending.dpa_version,
          acceptedVia: pending.accepted_via || (pending.signup_mode === "tester" ? "tester_signup" : "signup"),
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to record legal acceptance.");
    }

    async function setTenantMeta() {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) return;

      await fetch("/api/auth/pending-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: "set-tenant-meta" }),
      });
      // Non-fatal
    }

    async function maybeActivateTester(pending: PendingSignup | null) {
      if (!pending || pending.signup_mode !== "tester") return;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) return;

      const activateRes = await fetch("/api/tester-access/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });

      const activateJson = await activateRes.json().catch(() => ({}));
      if (!activateRes.ok) throw new Error(activateJson?.error || "Tester activation failed.");

      if (typeof window !== "undefined" && activateJson?.plan) {
        localStorage.setItem("chiefos_selected_plan", String(activateJson.plan));
        if (!cancelled) setPlan(normalizePlan(activateJson.plan));
      }
    }

    async function run() {
      try {
        setIsError(false);
        setActiveStep("verify-account");
        setStatus("Verifying your account…");

        let userId: string | null = null;
        for (let i = 0; i < 6; i++) {
          const { data, error } = await supabase.auth.getUser();
          if (!error && data?.user?.id) {
            userId = data.user.id;
            break;
          }
          await sleep(250);
        }

        if (!userId) {
          router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        setActiveStep("load-signup");
        setStatus("Loading your setup details…");
        const pending = await getPendingSignup();

        if (!cancelled && pending) {
          const resolvedPlan = normalizePlan(pending.requested_plan_key);
          setOwnerName(pending.owner_name ?? null);
          setCompanyName(pending.company_name ?? null);
          setPlan(resolvedPlan);
          setDataLoaded(true);

          const biz = pending.company_name ?? "your workspace";
          setStatus(`Retrieving ${biz}'s setup details…`);
        }

        setActiveStep("resolve-workspace");
        if (!cancelled) {
          const biz = companyName ?? "your workspace";
          setStatus(`Checking if ${biz} already exists…`);
        }

        const { data: existing, error: exErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (exErr) throw exErr;

        if (!existing?.tenant_id) {
          setActiveStep("create-workspace");
          if (!cancelled) {
            const biz = pending?.company_name ?? "your workspace";
            setStatus(`Building ${biz}'s command center…`);
          }

          const { error: rpcErr } = await supabase.rpc("chiefos_finish_signup", {
            company_name: pending?.company_name || null,
          });

          if (rpcErr) throw rpcErr;

          await setTenantMeta();
        } else {
          if (!cancelled) setIsReturning(true);
        }

        setActiveStep("record-agreement");
        if (!cancelled) setStatus("Securing your agreements on record…");
        await writeLegalAcceptance(pending);

        setActiveStep("activate-access");
        if (!cancelled) {
          const resolvedPlan = normalizePlan(pending?.requested_plan_key ?? null);
          const biz = pending?.company_name ?? "your workspace";
          setStatus(
            pending?.signup_mode === "tester"
              ? "Activating tester access…"
              : isFree(resolvedPlan)
                ? `Preparing ${biz}'s workspace…`
                : `Unlocking ${biz}'s full operating system…`
          );
        }
        await maybeActivateTester(pending);

        await consumePendingSignup();

        if (!cancelled) {
          setActiveStep("done");
          setStatus("Taking you in…");
          window.setTimeout(() => {
            if (!cancelled) router.replace(returnTo);
          }, 600);
        }
      } catch (e: any) {
        const msg = e?.message || "Unknown error";
        if (!cancelled) {
          setIsError(true);
          setStatus(`We couldn't finish setting up your workspace. ${msg}`);
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [router, returnTo]);

  // Compute title
  const pageTitle = useMemo(() => {
    if (isError) return "We hit a snag";
    if (isReturning) return ownerName ? `Welcome back, ${ownerName}.` : "Welcome back.";
    if (companyName) return `Building ${companyName}'s command center`;
    return "Getting ChiefOS ready";
  }, [isError, isReturning, ownerName, companyName]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#0C0B0A] text-[#E8E2D8]">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,168,83,0.07),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(212,168,83,0.03),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[rgba(212,168,83,0.15)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12 md:py-16">
        <div className="grid w-full gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:gap-10">

          {/* ── Left panel: progress ── */}
          <section className="rounded-[30px] border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-6 shadow-[0_40px_140px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-8">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] px-3 py-1 text-xs text-[#A8A090]">
              <span className={["h-2.5 w-2.5 rounded-full", isError ? "bg-red-400" : "bg-emerald-400 animate-pulse"].join(" ")} />
              {isError ? "Setup paused" : "Chief is online"}
            </div>

            {/* Title */}
            <h1
              className={[
                "mt-6 text-3xl font-semibold tracking-tight leading-tight text-[#E8E2D8] transition-opacity duration-500 md:text-4xl",
                dataLoaded || isReturning ? "opacity-100" : "opacity-60",
              ].join(" ")}
            >
              {pageTitle}
            </h1>

            {/* Status line */}
            <p className={["mt-4 max-w-2xl text-base leading-relaxed md:text-lg", isError ? "text-red-300/90" : "text-[#A8A090]"].join(" ")}>
              {status}
            </p>

            {/* Progress bar */}
            <div className="mt-7 rounded-2xl border border-[rgba(212,168,83,0.15)] bg-[#0C0B0A] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-[#706A60]">
                  {isError ? "Setup paused" : "Secure setup in progress"}
                </div>
                <div className="text-xs text-[#706A60]">{Math.round(pct)}%</div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgba(212,168,83,0.1)]">
                <div
                  className={["h-full rounded-full transition-all duration-500", isError ? "bg-red-400/80" : "bg-[#D4A853]"].join(" ")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="mt-7 grid gap-3">
              {STEPS.map((step) => {
                const state = stepState(STEPS, step.key, activeStep, isError);
                const desc = getStepDescription(step.key, companyName, plan);

                return (
                  <div
                    key={step.key}
                    className={[
                      "rounded-2xl border px-4 py-4 transition",
                      state === "done"
                        ? "border-[rgba(212,168,83,0.15)] bg-[rgba(212,168,83,0.05)]"
                        : state === "active"
                          ? "border-[rgba(212,168,83,0.25)] bg-[rgba(212,168,83,0.08)] ring-1 ring-[rgba(212,168,83,0.15)]"
                          : state === "error"
                            ? "border-red-400/20 bg-red-500/10"
                            : "border-[rgba(212,168,83,0.1)] bg-[#0C0B0A]",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                          state === "done"
                            ? "border-[rgba(212,168,83,0.3)] bg-[#D4A853] text-[#0C0B0A]"
                            : state === "active"
                              ? "border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.12)] text-[#D4A853]"
                              : state === "error"
                                ? "border-red-400/30 bg-red-500/20 text-red-100"
                                : "border-[rgba(212,168,83,0.1)] bg-[#0F0E0C] text-[#706A60]",
                        ].join(" ")}
                      >
                        {state === "done" ? "✓" : state === "error" ? "!" : ""}
                      </div>

                      <div className="min-w-0">
                        <div className={["text-sm font-semibold", state === "upcoming" ? "text-[#706A60]" : "text-[#E8E2D8]"].join(" ")}>
                          {step.label}
                        </div>
                        <div className={["mt-1 text-xs leading-relaxed", state === "upcoming" ? "text-[#706A60]" : "text-[#A8A090]"].join(" ")}>
                          {desc}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {isError && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                  className="inline-flex items-center justify-center rounded-[2px] bg-[#D4A853] px-5 py-3 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition"
                >
                  Back to login
                </a>
                <a
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] px-5 py-3 text-sm font-semibold text-[#A8A090] hover:text-[#D4A853] hover:border-[rgba(212,168,83,0.5)] transition"
                >
                  Create account again
                </a>
              </div>
            )}
          </section>

          {/* ── Right panel: Chief persona + plan ── */}
          <aside className="flex flex-col gap-4 rounded-[30px] border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-6 backdrop-blur-xl md:p-8">
            <ChiefBadge />

            {/* Hype headline */}
            <div className="rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.15em] text-[#706A60]">
                Chief says
              </div>
              <p className="mt-2 text-base font-semibold leading-snug text-[#E8E2D8] transition-all duration-300">
                {hypeLine}
              </p>
            </div>

            {/* Plan panel */}
            <PlanPanel plan={plan} />

            {/* Trust note */}
            <div className="mt-auto rounded-2xl border border-[rgba(212,168,83,0.12)] bg-[#0C0B0A] p-4">
              <div className="text-xs text-[#706A60]">Why this matters</div>
              <div className="mt-1.5 text-xs leading-relaxed text-[#706A60]">
                This is the handoff from account creation into your operating system. Clean setup,
                durable trust, and a clear first entry — every time.
              </div>
            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}
