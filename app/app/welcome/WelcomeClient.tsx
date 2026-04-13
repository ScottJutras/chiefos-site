"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWhoami } from "@/lib/whoami";
import { supabase } from "@/lib/supabase";

const WA_NUMBER = "12316802664";
// YouTube walkthrough links — set NEXT_PUBLIC_YOUTUBE_* in your env to enable
const YT_WALKTHROUGH = process.env.NEXT_PUBLIC_YOUTUBE_WALKTHROUGH || "";
const YT_EXPENSE     = process.env.NEXT_PUBLIC_YOUTUBE_EXPENSE_GUIDE || "";
const YT_JOB_PNL     = process.env.NEXT_PUBLIC_YOUTUBE_JOB_PNL_GUIDE || "";

type Step = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  action?: React.ReactNode;
};

function VideoLink({ url, label }: { url: string; label: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition mt-2"
    >
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
      </svg>
      {label}
    </a>
  );
}

const NEXT_STEPS = [
  {
    icon: "🏗️",
    title: "Create a Job",
    description: "ChiefOS is job-based. Every expense, revenue entry, and time log should be linked to a job. Create your first job before you start logging so everything stays organized.",
    action: { label: "Create a job", href: "/app/jobs/new", external: false },
    videoUrl: () => "",
  },
  {
    icon: "📥",
    title: "Import historical data",
    description: "Have past invoices or expense records? Import them as a CSV — expenses, revenue, or time entries. Build your financial baseline fast.",
    action: { label: "Go to Import", href: "/app/import", external: false },
    videoUrl: () => "",
  },
  {
    icon: "💸",
    title: "Log an expense",
    description: "Text Chief in WhatsApp: expense $50 Canadian Tire [Job Name]. It gets attached to your job automatically.",
    action: { label: "Open WhatsApp", href: `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("expense $50 Canadian Tire")}`, external: true },
    videoUrl: () => YT_EXPENSE,
  },
  {
    icon: "📊",
    title: "Check job profitability",
    description: "After logging a few expenses, ask Chief: job kpis [job name]. You'll see revenue, costs, and margin — so you know which jobs actually make money.",
    action: { label: "Open WhatsApp", href: `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("job kpis ")}`, external: true },
    videoUrl: () => YT_JOB_PNL,
  },
];

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white/20 bg-white/5">
      <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
    </div>
  );
}

const FREE_LOCKED = [
  "Revenue tracking",
  "Audio logging + receipt scanner",
  "PDF exports + job P&L",
  "Ask Chief: 250 questions/month",
  "Up to 25 jobs, 10 employees",
];

const FREE_INCLUDED = [
  "Expense capture via WhatsApp",
  "Time tracking · 3 jobs · 3 employees",
  "Ask Chief: 10 questions/month",
  "CSV export · 90-day history",
];

function PlanStep({
  onContinue,
  onUpgrade,
}: {
  onContinue: () => void;
  onUpgrade: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-[rgba(212,168,83,0.25)] bg-[rgba(212,168,83,0.05)] p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[rgba(212,168,83,0.4)] bg-[rgba(212,168,83,0.08)]">
          <div className="h-2.5 w-2.5 rounded-full bg-[#D4A853]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-white/92 text-sm">Choose your plan</div>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5">Free plan includes</div>
              <ul className="space-y-1">
                {FREE_INCLUDED.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-white/70">
                    <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5">Unlock with Starter</div>
              <ul className="space-y-1">
                {FREE_LOCKED.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-red-400/80">
                    <svg className="h-3.5 w-3.5 shrink-0 text-red-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="line-through decoration-red-500/50">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onUpgrade}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4A853] px-4 py-2 text-xs font-semibold text-black hover:bg-[#C49843] transition"
            >
              Upgrade to Starter — $59/mo →
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center rounded-xl border border-white/15 px-4 py-2 text-xs text-white/60 hover:bg-white/5 transition"
            >
              Continue with Free
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function digitsOnly(code: string | null | undefined) {
  return String(code || "").replace(/\D/g, "");
}

export default function WelcomeClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasWhatsApp, setHasWhatsApp] = useState(false);
  const [hasExpense, setHasExpense] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [portalUserId, setPortalUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [planKey, setPlanKey] = useState<string | null>(null);
  const [planAcknowledged, setPlanAcknowledged] = useState(false);

  // Link code state
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [phoneNumberCopied, setPhoneNumberCopied] = useState(false);

  async function fetchOrCreateCode(uid: string) {
    setCodeLoading(true);
    try {
      const { data } = await supabase
        .from("chiefos_link_codes")
        .select("code")
        .eq("portal_user_id", uid)
        .is("used_at", null)
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.code) {
        setLinkCode(digitsOnly(data.code));
        return;
      }

      // No existing code — create one
      await supabase.rpc("chiefos_create_link_code", {});

      const { data: fresh } = await supabase
        .from("chiefos_link_codes")
        .select("code")
        .eq("portal_user_id", uid)
        .is("used_at", null)
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setLinkCode(fresh?.code ? digitsOnly(fresh.code) : null);
    } catch {
      // non-blocking
    } finally {
      setCodeLoading(false);
    }
  }

  async function loadState() {
    try {
      const w: any = await fetchWhoami();
      if (!w?.ok || !w.userId) {
        router.replace("/login");
        return;
      }
      if (!w.tenantId) {
        router.replace("/finish-signup");
        return;
      }

      const tid = String(w.tenantId);
      const uid = String(w.userId);
      setHasWhatsApp(!!w.hasWhatsApp);
      setTenantId(tid);
      setPortalUserId(uid);
      setPlanKey(w.planKey ?? "free");

      // Fetch/create link code if not yet linked
      if (!w.hasWhatsApp) {
        void fetchOrCreateCode(uid);
      }

      // Restore plan acknowledgment from localStorage
      try {
        const stored = localStorage.getItem(`chief_plan_ack_${tid}`);
        if (stored === "1") setPlanAcknowledged(true);
      } catch {
        // ignore storage errors
      }

      // Check if user has logged at least one expense/revenue
      const { count } = await supabase
        .from("chiefos_portal_expenses")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .limit(1);

      setHasExpense((count ?? 0) > 0);
    } catch {
      // non-blocking — show page anyway
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!codeCopied) return;
    const t = setTimeout(() => setCodeCopied(false), 1400);
    return () => clearTimeout(t);
  }, [codeCopied]);

  useEffect(() => {
    if (!phoneNumberCopied) return;
    const t = setTimeout(() => setPhoneNumberCopied(false), 1400);
    return () => clearTimeout(t);
  }, [phoneNumberCopied]);

  // Auto-redirect to dashboard once all steps are done
  // Free users must acknowledge the plan step first
  const planStepDone = planKey !== "free" || planAcknowledged;
  useEffect(() => {
    if (!loading && hasWhatsApp && hasExpense && planStepDone) {
      const t = setTimeout(() => router.replace("/app/dashboard"), 1200);
      return () => clearTimeout(t);
    }
  }, [loading, hasWhatsApp, hasExpense, planStepDone, router]);

  async function recheckWhatsApp() {
    setChecking(true);
    try {
      const w: any = await fetchWhoami();
      if (w?.ok) {
        const linked = !!w.hasWhatsApp;
        setHasWhatsApp(linked);
        if (linked) {
          // Also recheck expense
          if (tenantId) {
            const { count } = await supabase
              .from("chiefos_portal_expenses")
              .select("*", { count: "exact", head: true })
              .eq("tenant_id", tenantId)
              .limit(1);
            setHasExpense((count ?? 0) > 0);
          }
        } else if (!linkCode && portalUserId) {
          // Still not linked — ensure we have a code ready
          void fetchOrCreateCode(portalUserId);
        }
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }

  async function recheckExpense() {
    setChecking(true);
    try {
      if (tenantId) {
        const { count } = await supabase
          .from("chiefos_portal_expenses")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .limit(1);
        setHasExpense((count ?? 0) > 0);
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }

  function acknowledgePlan() {
    setPlanAcknowledged(true);
    if (tenantId) {
      try { localStorage.setItem(`chief_plan_ack_${tenantId}`, "1"); } catch { /* ignore */ }
    }
  }

  const allDone = hasWhatsApp && hasExpense && planStepDone;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0f1117] px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-lg">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-3">ChiefOS</div>
          <h1 className="text-3xl font-semibold text-white">
            {allDone ? "You're all set." : "Your financial reality starts here."}
          </h1>
          <p className="mt-3 text-white/55 text-sm leading-relaxed">
            {allDone
              ? "Taking you to your dashboard…"
              : "Complete three quick steps and Chief will start tracking your job profitability."}
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">

          {/* Step 0 — Plan selection (free users only, until acknowledged) */}
          {planKey === "free" && !planAcknowledged && (
            <PlanStep
              onContinue={acknowledgePlan}
              onUpgrade={() => {
                acknowledgePlan();
                router.push("/app/settings/billing");
              }}
            />
          )}

          {/* Step 1 — Account created */}
          <div className={[
            "rounded-[20px] border p-5 transition-all",
            "border-white/10 bg-white/[0.03]",
          ].join(" ")}>
            <div className="flex items-start gap-4">
              <CheckIcon done={true} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-white/92 text-sm">Account created</div>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Done</span>
                </div>
                <div className="mt-1 text-xs text-white/45">Your workspace is ready.</div>
              </div>
            </div>
          </div>

          {/* Step 2 — Link WhatsApp */}
          <div className={[
            "rounded-[20px] border p-5 transition-all",
            hasWhatsApp
              ? "border-white/10 bg-white/[0.03]"
              : "border-white/15 bg-white/[0.05]",
          ].join(" ")}>
            <div className="flex items-start gap-4">
              <CheckIcon done={hasWhatsApp} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={["font-medium text-sm", hasWhatsApp ? "text-white/70" : "text-white/92"].join(" ")}>
                    Link WhatsApp
                  </div>
                  {hasWhatsApp && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Done</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {hasWhatsApp
                    ? "Your phone is connected. Expenses flow automatically."
                    : "Connect your phone so Chief knows it's you logging expenses."}
                </div>

                {!hasWhatsApp && (
                  <div className="mt-5 space-y-5">

                    {/* Sub-step A: Download WhatsApp */}
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">1 · Get WhatsApp</div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Desktop */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                          <div className="text-[10px] text-white/40 font-medium uppercase tracking-wide">Desktop</div>
                          <div className="flex flex-wrap gap-1.5">
                            <a
                              href="https://www.microsoft.com/store/apps/9NKSQGP7F2NH"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition"
                            >
                              Windows
                            </a>
                            <a
                              href="https://apps.apple.com/app/whatsapp-desktop/id1147396723"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition"
                            >
                              Mac
                            </a>
                          </div>
                        </div>
                        {/* Mobile */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                          <div className="text-[10px] text-white/40 font-medium uppercase tracking-wide">Mobile</div>
                          <div className="flex flex-wrap gap-1.5">
                            <a
                              href="https://apps.apple.com/app/whatsapp-messenger/id310633997"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition"
                            >
                              iPhone
                            </a>
                            <a
                              href="https://play.google.com/store/apps/details?id=com.whatsapp"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition"
                            >
                              Android
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sub-step B: Add Chief as a contact */}
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">2 · Add Chief as a contact</div>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText("+12316802664");
                            setPhoneNumberCopied(true);
                          } catch { /* ignore */ }
                        }}
                        className="flex items-center gap-3 rounded-xl border border-[rgba(212,168,83,0.25)] bg-[rgba(212,168,83,0.06)] px-4 py-3 hover:bg-[rgba(212,168,83,0.1)] transition w-full text-left"
                      >
                        <span className="font-mono text-base tracking-widest text-[#D4A853]">+1 (231) 680-2664</span>
                        <span className="ml-auto text-[10px] text-[#D4A853]/60">
                          {phoneNumberCopied ? "Copied!" : "Tap to copy"}
                        </span>
                      </button>
                    </div>

                    {/* Sub-step C: Send link code */}
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">3 · Send this code to Chief on WhatsApp</div>
                      <div className="rounded-xl border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.05)] px-5 py-4 text-center">
                        {codeLoading ? (
                          <span className="text-white/30 text-sm">Generating code…</span>
                        ) : linkCode ? (
                          <span className="font-mono text-2xl tracking-[0.35em] text-[#D4A853]">{linkCode}</span>
                        ) : (
                          <span className="text-white/30 text-sm">No code available</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={async () => {
                            if (!linkCode) return;
                            try {
                              await navigator.clipboard.writeText(linkCode);
                              setCodeCopied(true);
                            } catch { /* ignore */ }
                          }}
                          disabled={!linkCode}
                          className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/60 hover:bg-white/10 transition disabled:opacity-40"
                        >
                          {codeCopied ? "Copied!" : "Copy code"}
                        </button>
                        <a
                          href={linkCode ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(linkCode)}` : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition ${!linkCode ? "pointer-events-none opacity-40" : ""}`}
                        >
                          Open WhatsApp →
                        </a>
                        <button
                          onClick={() => portalUserId && void fetchOrCreateCode(portalUserId)}
                          disabled={codeLoading || !portalUserId}
                          className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/50 hover:bg-white/10 transition disabled:opacity-40"
                        >
                          {codeLoading ? "…" : "New code"}
                        </button>
                      </div>
                    </div>

                    {/* Check now */}
                    <button
                      onClick={recheckWhatsApp}
                      disabled={checking}
                      className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-xs text-white/50 hover:bg-white/5 transition disabled:opacity-50"
                    >
                      {checking ? "Checking…" : "Already linked? Check now"}
                    </button>

                    {YT_WALKTHROUGH && (
                      <VideoLink url={YT_WALKTHROUGH} label="Watch 60-second setup walkthrough" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3 — Get started: choose your path */}
          <div className={[
            "rounded-[20px] border p-5 transition-all",
            hasExpense
              ? "border-white/10 bg-white/[0.03]"
              : "border-white/15 bg-white/[0.05]",
          ].join(" ")}>
            <div className="flex items-start gap-4">
              <CheckIcon done={hasExpense} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={["font-medium text-sm", hasExpense ? "text-white/70" : "text-white/92"].join(" ")}>
                    Get started — choose your path
                  </div>
                  {hasExpense && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Done</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {hasExpense
                    ? "You're in — Chief is tracking your data."
                    : "Pick the approach that fits where you are."}
                </div>
                {!hasExpense && (
                  <div className="mt-4 space-y-3">
                    {/* Option A: Import */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                      <div className="text-xs font-semibold text-white/80">Option A — Import financial history</div>
                      <div className="text-xs text-white/45 leading-relaxed">
                        Already have past invoices, expenses, or revenue records? Import them as a CSV to build your financial baseline fast.
                      </div>
                      <Link
                        href="/app/import"
                        className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition"
                      >
                        Import data →
                      </Link>
                    </div>
                    {/* Option B: Create job */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                      <div className="text-xs font-semibold text-white/80">Option B — Create a job &amp; start logging</div>
                      <div className="text-xs text-white/45 leading-relaxed">
                        Starting fresh? Create your first job in the portal, then text Chief to log expenses, time, and revenue as you go.
                      </div>
                      <Link
                        href="/app/jobs/new"
                        className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition"
                      >
                        Create a job →
                      </Link>
                    </div>
                    <button
                      onClick={recheckExpense}
                      disabled={checking}
                      className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-xs text-white/50 hover:bg-white/5 transition disabled:opacity-50"
                    >
                      {checking ? "Checking…" : "I've already started — check now"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Job-based philosophy blurb */}
        <div className="mt-8 rounded-[16px] border border-white/8 bg-white/[0.025] p-5 space-y-3">
          <div className="text-sm font-semibold text-white/85">ChiefOS is built around Jobs.</div>
          <div className="text-xs text-white/50 leading-relaxed">
            Every expense, revenue entry, and time log should be assigned to a Job. This is how Chief understands where your money is going and whether each project is actually profitable.
          </div>
          <ul className="space-y-1.5">
            {[
              "Keep jobs up to date — create a new job before you start a project",
              "Assign everything to a job — the more you tag, the more insight Chief can give you",
              "The more you log, the smarter Chief gets — Chief can only surface useful data when it has real records to work with",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-white/55">
                <span className="mt-0.5 shrink-0 text-emerald-400">→</span>
                {item}
              </li>
            ))}
          </ul>
          <div className="pt-1 text-xs text-white/40 leading-relaxed border-t border-white/8">
            <span className="font-medium text-white/55">Have a lot of historical data?</span> If your past records aren&apos;t organized by jobs, that&apos;s fine — import them as a batch to establish your baseline. Going forward, organize everything by job so Chief can show you which projects make money and which don&apos;t.
          </div>
        </div>

        {/* What to try next — shown once setup is underway */}
        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-3">Your next steps</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {NEXT_STEPS.map((step) => {
              const videoUrl = step.videoUrl();
              return (
                <div
                  key={step.title}
                  className="rounded-[16px] border border-white/8 bg-white/[0.025] p-4 flex flex-col gap-2"
                >
                  <div className="text-lg leading-none">{step.icon}</div>
                  <div className="text-sm font-medium text-white/85">{step.title}</div>
                  <div className="text-xs text-white/45 leading-relaxed flex-1">{step.description}</div>
                  <div className="flex flex-col gap-1 mt-1">
                    {step.action.external ? (
                      <a
                        href={step.action.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-white/55 hover:text-white/90 transition"
                      >
                        {step.action.label} →
                      </a>
                    ) : (
                      <Link
                        href={step.action.href}
                        className="inline-flex items-center text-xs text-white/55 hover:text-white/90 transition"
                      >
                        {step.action.label} →
                      </Link>
                    )}
                    {videoUrl && (
                      <VideoLink url={videoUrl} label="Watch walkthrough" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          {allDone ? (
            <Link
              href="/app/dashboard"
              className="inline-flex items-center rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition"
            >
              Go to dashboard
            </Link>
          ) : (
            <Link
              href="/app/dashboard"
              className="text-xs text-white/35 underline underline-offset-4 hover:text-white/55 transition"
            >
              Skip for now — go to dashboard
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
