"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWhoami } from "@/lib/whoami";
import { supabase } from "@/lib/supabase";

const WA_NUMBER = "12316802664";
const YT_WALKTHROUGH = process.env.NEXT_PUBLIC_YOUTUBE_WALKTHROUGH || "";

type UsageMode = "web" | "whatsapp" | "microapp" | "all" | null;

// ─── Utility ─────────────────────────────────────────────────────────────────

function digitsOnly(code: string | null | undefined) {
  return String(code || "").replace(/\D/g, "");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function PlanStep({
  onContinue,
  onUpgrade,
}: {
  onContinue: () => void;
  onUpgrade: () => void;
}) {
  const FREE_INCLUDED = [
    "Expense capture via WhatsApp",
    "Time tracking · 3 jobs · 3 employees",
    "Ask Chief: 10 questions/month",
    "CSV export · 90-day history",
  ];
  const FREE_LOCKED = [
    "Revenue tracking",
    "Tasks & reminders",
    "Audio logging + receipt scanner",
    "PDF exports + job P&L",
    "Ask Chief: 250 questions/month",
    "Up to 25 jobs, 10 employees",
  ];

  return (
    <div className="rounded-[20px] border border-[rgba(212,168,83,0.25)] bg-[rgba(212,168,83,0.05)] p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[rgba(212,168,83,0.4)] bg-[rgba(212,168,83,0.08)]">
          <div className="h-2.5 w-2.5 rounded-full bg-[#D4A853]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white/92 text-sm">Choose your plan</div>

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

// ─── Plan feature data ────────────────────────────────────────────────────────

type FeatureCard = {
  icon: string;
  title: string;
  description: string;
  href?: string;
};

const FREE_FEATURES: FeatureCard[] = [
  {
    icon: "🏗️",
    title: "Create a Job",
    description: "Every expense, revenue entry, and time log should belong to a job. Create one before you start logging so everything stays organized.",
    href: "/app/jobs/new",
  },
  {
    icon: "💸",
    title: "Log an Expense",
    description: "Text Chief on WhatsApp: expense $50 Canadian Tire [Job Name]. It attaches to your job automatically.",
  },
  {
    icon: "⏱️",
    title: "Time Clock — Track Labour Hours",
    description: "Text Chief: clock in [Job Name] when you start, clock out when you finish. Chief logs your hours and links them to the job.",
  },
  {
    icon: "👷",
    title: "Employee Time Clock (up to 3 employees)",
    description: "Employees can clock in and out directly via WhatsApp. Their hours are logged under your account automatically.",
  },
  {
    icon: "🔁",
    title: "Set Overhead & Recurring Costs",
    description: "Fixed costs like rent, insurance, and subscriptions. Set them once and Chief factors them into every job P&L automatically.",
    href: "/app/overhead",
  },
  {
    icon: "🤖",
    title: "Ask Chief (10 questions/month)",
    description: "Ask anything about your business: job kpis [job name], how much did I spend last week?, what's my margin on [job]?",
  },
  {
    icon: "📥",
    title: "Import Historical Data",
    description: "Bring in past records via CSV — expenses, revenue, or time entries. Build your financial baseline fast.",
    href: "/app/import",
  },
];

const STARTER_FEATURES: FeatureCard[] = [
  {
    icon: "📷",
    title: "Receipt Scanner (OCR)",
    description: "Send a photo of any receipt on WhatsApp. Chief reads it, extracts the amount and vendor, and logs the expense.",
  },
  {
    icon: "🎙️",
    title: "Voice Expense Logging",
    description: "Send a voice memo to Chief describing an expense. It gets transcribed and logged automatically.",
  },
  {
    icon: "✅",
    title: "Create and Assign Tasks",
    description: "Create tasks on jobs and assign them to crew members. Track status and completion across your projects.",
    href: "/app/tasks",
  },
  {
    icon: "🔔",
    title: "Set Reminders",
    description: "Ask Chief to remind you of anything at any time. Works via WhatsApp — just say remind me to [thing] on [date].",
  },
  {
    icon: "📄",
    title: "Documents — Quotes, Invoices, Contracts",
    description: "Generate professional quotes, invoices, and contracts directly from job data. Send them to clients in seconds.",
    href: "/app/documents",
  },
  {
    icon: "👷",
    title: "Add Employees (up to 10)",
    description: "Invite crew members to log time, mileage, and photos under your account. Send them a portal invite link via SMS.",
    href: "/app/crew/members",
  },
  {
    icon: "🚗",
    title: "Employee Mileage Logging",
    description: "Employees log mileage from their phones via WhatsApp. Each trip is attributed to them and linked to the job.",
  },
  {
    icon: "📸",
    title: "Employee Job Site Photos",
    description: "Employees submit job site photos via WhatsApp with notes. Attached to jobs for a complete visual record.",
  },
  {
    icon: "📊",
    title: "Exports — PDF, CSV, XLS",
    description: "Download job P&L reports, expense summaries, and time logs in any format. Share with your accountant or bank.",
  },
  {
    icon: "🤖",
    title: "Ask Chief (250 questions/month)",
    description: "Full conversational access to your business data. Ask anything — Chief knows your jobs, costs, and history.",
  },
];

const PRO_FEATURES: FeatureCard[] = [
  {
    icon: "📱",
    title: "Crew Self-Logging via WhatsApp",
    description: "Employees log their own time, mileage, photos, and expenses directly from their phones on WhatsApp.",
  },
  {
    icon: "💰",
    title: "Employee Expense & Revenue Submission",
    description: "Employees submit expenses and revenue entries via WhatsApp. They land in your review queue — approve, decline, or edit before they hit your P&L.",
  },
  {
    icon: "✔️",
    title: "Time Approvals & Crew Inbox",
    description: "Review and approve time entries, expenses, and revenue submitted by crew members. Approve or decline with one tap.",
  },
  {
    icon: "📈",
    title: "Forecasting",
    description: "Chief projects future costs and revenue based on job history, overhead, and current pipeline.",
  },
  {
    icon: "🤖",
    title: "Ask Chief (2,000 questions/month)",
    description: "Unlimited conversational access for power users. Ask complex multi-part questions about your entire operation.",
  },
  {
    icon: "👥",
    title: "Up to 50 Employees + 5 Board Members",
    description: "Scale your crew with 50 employees and designate up to 5 board members who can review and approve time, expenses, and revenue submissions.",
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

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

  // New onboarding state
  const [usageMode, setUsageModeState] = useState<UsageMode>(null);
  const [receiptMethods, setReceiptMethodsState] = useState<string[]>([]);
  const [overheadSkipped, setOverheadSkippedState] = useState(false);
  const [emailCaptureAddress, setEmailCaptureAddress] = useState<string | null>(null);

  // ── Persisted state helpers ──────────────────────────────────────────────────

  function setUsageMode(mode: UsageMode) {
    setUsageModeState(mode);
    if (tenantId) {
      try { localStorage.setItem(`chief_usage_mode_${tenantId}`, mode ?? ""); } catch { /* ignore */ }
    }
  }

  function toggleReceiptMethod(method: string) {
    setReceiptMethodsState((prev) => {
      const next = prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method];
      if (tenantId) {
        try { localStorage.setItem(`chief_receipt_methods_${tenantId}`, next.join(",")); } catch { /* ignore */ }
      }
      return next;
    });
  }

  function skipOverhead() {
    setOverheadSkippedState(true);
    if (tenantId) {
      try { localStorage.setItem(`chief_overhead_skipped_${tenantId}`, "1"); } catch { /* ignore */ }
    }
  }

  // ── Link code ────────────────────────────────────────────────────────────────

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

  // ── Load state ───────────────────────────────────────────────────────────────

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

      if (!w.hasWhatsApp) {
        void fetchOrCreateCode(uid);
      }

      // Restore persisted state
      try {
        if (localStorage.getItem(`chief_plan_ack_${tid}`) === "1") setPlanAcknowledged(true);
        const storedMode = localStorage.getItem(`chief_usage_mode_${tid}`);
        if (storedMode) setUsageModeState(storedMode as UsageMode);
        const storedMethods = localStorage.getItem(`chief_receipt_methods_${tid}`);
        if (storedMethods) setReceiptMethodsState(storedMethods.split(",").filter(Boolean));
        if (localStorage.getItem(`chief_overhead_skipped_${tid}`) === "1") setOverheadSkippedState(true);
      } catch { /* ignore */ }

      // Check at least one expense/revenue logged
      const { count } = await supabase
        .from("chiefos_portal_expenses")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .limit(1);
      setHasExpense((count ?? 0) > 0);

      // Fetch email capture address
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch("/api/settings/email-capture", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const d = await res.json();
            if (d.capture_address) setEmailCaptureAddress(d.capture_address);
          }
        }
      } catch { /* non-blocking */ }

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

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function recheckWhatsApp() {
    setChecking(true);
    try {
      const w: any = await fetchWhoami();
      if (w?.ok) {
        const linked = !!w.hasWhatsApp;
        setHasWhatsApp(linked);
        if (linked && tenantId) {
          const { count } = await supabase
            .from("chiefos_portal_expenses")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .limit(1);
          setHasExpense((count ?? 0) > 0);
        } else if (!linkCode && portalUserId) {
          void fetchOrCreateCode(portalUserId);
        }
      }
    } catch { /* ignore */ } finally {
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
    } catch { /* ignore */ } finally {
      setChecking(false);
    }
  }

  function acknowledgePlan() {
    setPlanAcknowledged(true);
    if (tenantId) {
      try { localStorage.setItem(`chief_plan_ack_${tenantId}`, "1"); } catch { /* ignore */ }
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const planStepDone = planKey !== "free" || planAcknowledged;
  const showWA = usageMode === "whatsapp" || usageMode === "all";
  const showWeb = usageMode === "web" || usageMode === "all";
  const showMicro = usageMode === "microapp" || usageMode === "all";
  const usageSectionDone = usageMode !== null && (!showWA || hasWhatsApp);
  const receiptSectionDone = receiptMethods.length > 0;

  const isStarterOrPro = planKey === "starter" || planKey === "pro";
  const isPro = planKey === "pro";

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  // ── WhatsApp sub-steps (reused in section 4) ─────────────────────────────────

  const whatsAppSubSteps = (
    <div className="mt-5 space-y-5">
      {/* Sub-step A */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">1 · Get WhatsApp</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <div className="text-[10px] text-white/40 font-medium uppercase tracking-wide">Desktop</div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://www.microsoft.com/store/apps/9NKSQGP7F2NH" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition">
                Windows
              </a>
              <a href="https://apps.apple.com/app/whatsapp-desktop/id1147396723" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition">
                Mac
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <div className="text-[10px] text-white/40 font-medium uppercase tracking-wide">Mobile</div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://apps.apple.com/app/whatsapp-messenger/id310633997" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition">
                iPhone
              </a>
              <a href="https://play.google.com/store/apps/details?id=com.whatsapp" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition">
                Android
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-step B */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">2 · Add Chief as a contact</div>
        <button
          onClick={async () => {
            try { await navigator.clipboard.writeText("+12316802664"); setPhoneNumberCopied(true); } catch { /* ignore */ }
          }}
          className="flex items-center gap-3 rounded-xl border border-[rgba(212,168,83,0.25)] bg-[rgba(212,168,83,0.06)] px-4 py-3 hover:bg-[rgba(212,168,83,0.1)] transition w-full text-left"
        >
          <span className="font-mono text-base tracking-widest text-[#D4A853]">+1 (231) 680-2664</span>
          <span className="ml-auto text-[10px] text-[#D4A853]/60">{phoneNumberCopied ? "Copied!" : "Tap to copy"}</span>
        </button>
      </div>

      {/* Sub-step C */}
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
              try { await navigator.clipboard.writeText(linkCode); setCodeCopied(true); } catch { /* ignore */ }
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
      <div className="space-y-1.5">
        <button
          onClick={recheckWhatsApp}
          disabled={checking}
          className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-xs text-white/50 hover:bg-white/5 transition disabled:opacity-50"
        >
          {checking ? "Checking…" : "Already linked? Check now"}
        </button>
        <p className="text-[11px] text-white/35 leading-relaxed">
          Already sent the code to Chief? Tap this to confirm — it checks your account in real time without refreshing the page.
        </p>
      </div>

      {YT_WALKTHROUGH && (
        <VideoLink url={YT_WALKTHROUGH} label="Watch 60-second setup walkthrough" />
      )}
    </div>
  );

  // ── Feature card renderer ─────────────────────────────────────────────────────

  function FeatureCardItem({ card, locked }: { card: FeatureCard; locked: boolean }) {
    return (
      <div className={[
        "rounded-[16px] border p-4 flex flex-col gap-2 relative",
        locked
          ? "border-white/5 bg-white/[0.015] opacity-60"
          : "border-white/8 bg-white/[0.025]",
      ].join(" ")}>
        {locked && (
          <div className="absolute top-3 right-3">
            <svg className="h-3.5 w-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}
        <div className="text-lg leading-none">{card.icon}</div>
        <div className="text-sm font-medium text-white/85 pr-5">{card.title}</div>
        <div className="text-xs text-white/45 leading-relaxed flex-1">{card.description}</div>
        {!locked && card.href && (
          <Link
            href={card.href}
            className="inline-flex items-center text-xs text-white/55 hover:text-white/90 transition mt-1"
          >
            {card.title.startsWith("Create") ? "Create now" : card.title.startsWith("Add") ? "Manage team" : card.title.startsWith("Import") ? "Go to Import" : "Open"} →
          </Link>
        )}
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-[#0f1117] px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-lg">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-3">ChiefOS</div>
          <h1 className="text-3xl font-semibold text-white">Your financial reality starts here.</h1>
          <p className="mt-3 text-white/55 text-sm leading-relaxed">
            Follow these steps to get set up, then explore everything Chief can do for your business.
          </p>
        </div>

        <div className="space-y-3">

          {/* Plan selection — free users only */}
          {planKey === "free" && !planAcknowledged && (
            <PlanStep
              onContinue={acknowledgePlan}
              onUpgrade={() => { acknowledgePlan(); router.push("/app/settings/billing"); }}
            />
          )}

          {/* ── 1. Account Created ─────────────────────────────────────────────── */}
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
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

          {/* ── 2. How do you want to use ChiefOS? ──────────────────────────────── */}
          <div className={[
            "rounded-[20px] border p-5 transition-all",
            usageSectionDone ? "border-white/10 bg-white/[0.03]" : "border-white/15 bg-white/[0.05]",
          ].join(" ")}>
            <div className="flex items-start gap-4">
              <CheckIcon done={usageSectionDone} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={["font-medium text-sm", usageSectionDone ? "text-white/70" : "text-white/92"].join(" ")}>
                    How do you want to use ChiefOS?
                  </div>
                  {usageSectionDone && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Done</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-white/45">Choose how you&apos;ll access Chief — you can use all three.</div>

                {/* Mode selector */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "web", label: "Web Portal", sub: "From your computer" },
                      { value: "whatsapp", label: "WhatsApp Portal", sub: "Log from your phone" },
                      { value: "microapp", label: "Mobile App (PWA)", sub: "Add to home screen" },
                      { value: "all", label: "All of the above", sub: "Recommended" },
                    ] as { value: UsageMode; label: string; sub: string }[]
                  ).map(({ value, label, sub }) => (
                    <button
                      key={value!}
                      type="button"
                      onClick={() => setUsageMode(usageMode === value ? null : value)}
                      className={[
                        "rounded-xl border p-3 text-left transition",
                        usageMode === value
                          ? "border-[rgba(212,168,83,0.5)] bg-[rgba(212,168,83,0.08)]"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                      ].join(" ")}
                    >
                      <div className={["text-xs font-semibold", usageMode === value ? "text-[#D4A853]" : "text-white/80"].join(" ")}>{label}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{sub}</div>
                    </button>
                  ))}
                </div>

                {/* Conditional instructions */}
                {usageMode && (
                  <div className="mt-5 space-y-4">

                    {showWeb && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-1">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">Web Portal</div>
                        <div className="text-xs text-white/55 leading-relaxed">
                          You&apos;re already here. The portal at <span className="text-white/75 font-medium">app.usechiefos.com</span> gives you dashboards, job P&L, expense history, and all settings from any browser. Bookmark it for quick access.
                        </div>
                      </div>
                    )}

                    {showWA && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-1">WhatsApp Portal</div>
                        <div className="text-xs text-white/55 leading-relaxed mb-2">
                          Link your phone number so Chief knows it&apos;s you when you text in expenses, clock in/out, and ask questions.
                        </div>
                        {hasWhatsApp ? (
                          <div className="flex items-center gap-2 text-xs text-emerald-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            WhatsApp is connected. Expenses flow automatically.
                          </div>
                        ) : (
                          whatsAppSubSteps
                        )}
                      </div>
                    )}

                    {showMicro && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium">Mobile App (PWA)</div>
                        <div className="text-xs text-white/55 leading-relaxed">
                          Add ChiefOS to your home screen for a native app experience — no app store required.
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1">
                            <div className="text-[10px] text-white/50 font-semibold uppercase tracking-wide">iPhone (Safari)</div>
                            <ol className="space-y-0.5 text-[11px] text-white/45 list-decimal list-inside">
                              <li>Open <span className="text-white/65">app.usechiefos.com</span> in Safari</li>
                              <li>Tap the <span className="text-white/65">Share</span> button (box with arrow)</li>
                              <li>Tap <span className="text-white/65">&quot;Add to Home Screen&quot;</span></li>
                              <li>Tap <span className="text-white/65">Add</span></li>
                            </ol>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1">
                            <div className="text-[10px] text-white/50 font-semibold uppercase tracking-wide">Android (Chrome)</div>
                            <ol className="space-y-0.5 text-[11px] text-white/45 list-decimal list-inside">
                              <li>Open <span className="text-white/65">app.usechiefos.com</span> in Chrome</li>
                              <li>Tap the <span className="text-white/65">three-dot menu</span></li>
                              <li>Tap <span className="text-white/65">&quot;Add to Home Screen&quot;</span></li>
                              <li>Tap <span className="text-white/65">Add</span></li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 3. How do you want to process Receipts? ────────────────────────── */}
          <div className={[
            "rounded-[20px] border p-5 transition-all",
            receiptSectionDone ? "border-white/10 bg-white/[0.03]" : "border-white/15 bg-white/[0.05]",
          ].join(" ")}>
            <div className="flex items-start gap-4">
              <CheckIcon done={receiptSectionDone} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={["font-medium text-sm", receiptSectionDone ? "text-white/70" : "text-white/92"].join(" ")}>
                    How do you want to process receipts?
                  </div>
                  {receiptSectionDone && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Done</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-white/45">Select all the methods you&apos;d like to use.</div>

                <div className="mt-4 space-y-2">

                  {/* WhatsApp receipt */}
                  <div className={[
                    "rounded-xl border transition cursor-pointer",
                    receiptMethods.includes("whatsapp")
                      ? "border-[rgba(212,168,83,0.4)] bg-[rgba(212,168,83,0.05)]"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                  ].join(" ")}>
                    <button
                      type="button"
                      onClick={() => toggleReceiptMethod("whatsapp")}
                      className="flex w-full items-center justify-between p-3 text-left"
                    >
                      <div>
                        <div className={["text-xs font-semibold", receiptMethods.includes("whatsapp") ? "text-[#D4A853]" : "text-white/80"].join(" ")}>
                          WhatsApp
                        </div>
                        <div className="text-[11px] text-white/40 mt-0.5">Text, voice, or photo</div>
                      </div>
                      <div className={[
                        "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        receiptMethods.includes("whatsapp") ? "border-[#D4A853] bg-[#D4A853]" : "border-white/25",
                      ].join(" ")}>
                        {receiptMethods.includes("whatsapp") && (
                          <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {receiptMethods.includes("whatsapp") && (
                      <div className="px-3 pb-3 space-y-2 border-t border-white/8 pt-3">
                        <div className="space-y-2">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">A · Text message</div>
                          <div className="rounded-lg bg-white/[0.04] border border-white/8 px-3 py-2 font-mono text-xs text-[#D4A853]">
                            expense $45 Home Depot [Job Name]
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">B · Voice message</div>
                          <div className="text-xs text-white/50 leading-relaxed">
                            Send a voice note describing the expense. Chief transcribes it and logs the amount automatically.
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">C · Photo of receipt</div>
                            {!isStarterOrPro && (
                              <span className="rounded-full bg-[rgba(212,168,83,0.15)] px-1.5 py-0.5 text-[9px] font-semibold text-[#D4A853] uppercase tracking-wide">Starter+</span>
                            )}
                          </div>
                          <div className="text-xs text-white/50 leading-relaxed">
                            Send a photo of any receipt. Chief reads the amount and vendor using OCR and asks you to confirm the job.
                            {!isStarterOrPro && (
                              <span className="block mt-1 text-[#D4A853]/70">Requires Starter plan or above.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Email receipt */}
                  <div className={[
                    "rounded-xl border transition cursor-pointer",
                    receiptMethods.includes("email")
                      ? "border-[rgba(212,168,83,0.4)] bg-[rgba(212,168,83,0.05)]"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                  ].join(" ")}>
                    <button
                      type="button"
                      onClick={() => toggleReceiptMethod("email")}
                      className="flex w-full items-center justify-between p-3 text-left"
                    >
                      <div>
                        <div className={["text-xs font-semibold", receiptMethods.includes("email") ? "text-[#D4A853]" : "text-white/80"].join(" ")}>
                          Email
                        </div>
                        <div className="text-[11px] text-white/40 mt-0.5">Forward receipts to your ChiefOS inbox</div>
                      </div>
                      <div className={[
                        "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        receiptMethods.includes("email") ? "border-[#D4A853] bg-[#D4A853]" : "border-white/25",
                      ].join(" ")}>
                        {receiptMethods.includes("email") && (
                          <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {receiptMethods.includes("email") && (
                      <div className="px-3 pb-3 space-y-3 border-t border-white/8 pt-3">
                        <div className="text-xs text-white/55 leading-relaxed">
                          Forward any receipt email to your unique ChiefOS inbox address. Chief parses the amount, vendor, and date automatically.
                        </div>
                        {emailCaptureAddress ? (
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.12em] text-white/35 mb-1.5">Your capture address</div>
                            <div className="rounded-lg bg-white/[0.04] border border-white/8 px-3 py-2 font-mono text-xs text-[#D4A853] break-all">
                              {emailCaptureAddress}
                            </div>
                            <p className="mt-1.5 text-[11px] text-white/35">Forward receipts here from any email client. You can rotate this address in Settings.</p>
                          </div>
                        ) : (
                          <div className="text-xs text-white/40">
                            Your capture address is available in{" "}
                            <Link href="/app/settings" className="text-[#D4A853]/80 hover:text-[#D4A853] transition underline underline-offset-2">
                              Settings → Email Capture
                            </Link>.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bulk import */}
                  <div className={[
                    "rounded-xl border transition cursor-pointer",
                    receiptMethods.includes("bulk")
                      ? "border-[rgba(212,168,83,0.4)] bg-[rgba(212,168,83,0.05)]"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                  ].join(" ")}>
                    <button
                      type="button"
                      onClick={() => toggleReceiptMethod("bulk")}
                      className="flex w-full items-center justify-between p-3 text-left"
                    >
                      <div>
                        <div className={["text-xs font-semibold", receiptMethods.includes("bulk") ? "text-[#D4A853]" : "text-white/80"].join(" ")}>
                          Bulk Import
                        </div>
                        <div className="text-[11px] text-white/40 mt-0.5">Upload CSV files of past records</div>
                      </div>
                      <div className={[
                        "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        receiptMethods.includes("bulk") ? "border-[#D4A853] bg-[#D4A853]" : "border-white/25",
                      ].join(" ")}>
                        {receiptMethods.includes("bulk") && (
                          <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {receiptMethods.includes("bulk") && (
                      <div className="px-3 pb-3 space-y-3 border-t border-white/8 pt-3">
                        <div className="text-xs text-white/55 leading-relaxed">
                          Import historical expenses, revenue, and time entries as CSV files. Supports standard column formats: amount, date, description, job name.
                        </div>
                        <Link
                          href="/app/import"
                          className="inline-flex items-center rounded-xl bg-white/[0.08] border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.12] transition"
                        >
                          Go to Import →
                        </Link>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* ── 4. Overhead & Recurring Costs ──────────────────────────────────── */}
          <div className={[
            "rounded-[20px] border p-5 transition-all",
            overheadSkipped ? "border-white/10 bg-white/[0.03]" : "border-white/15 bg-white/[0.05]",
          ].join(" ")}>
            <div className="flex items-start gap-4">
              <CheckIcon done={overheadSkipped} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={["font-medium text-sm", overheadSkipped ? "text-white/70" : "text-white/92"].join(" ")}>
                    Set up overhead expenses
                  </div>
                  {overheadSkipped && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">Skipped</span>
                  )}
                </div>

                {overheadSkipped ? (
                  <div className="mt-2 text-xs text-white/40 leading-relaxed">
                    You can configure overhead any time from the <Link href="/app/overhead" className="text-[#D4A853]/80 hover:text-[#D4A853] transition underline underline-offset-2">Overhead</Link> tab in the left navigation.
                  </div>
                ) : (
                  <>
                    <div className="mt-1 text-xs text-white/45 leading-relaxed">
                      Overhead expenses are fixed costs that occur whether or not you&apos;re working on a job — rent, insurance, vehicle leases, subscriptions. Chief uses these to calculate your true profitability. If you skip this, your job margins will appear higher than they actually are.
                    </div>
                    <ul className="mt-3 space-y-1">
                      {["Facility rent & utilities", "Vehicle & equipment leases", "Insurance premiums", "Software & subscriptions"].map((item) => (
                        <li key={item} className="flex items-center gap-2 text-xs text-white/45">
                          <span className="shrink-0 text-white/25">·</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href="/app/overhead"
                        className="inline-flex items-center rounded-xl bg-[#D4A853] px-4 py-2 text-xs font-semibold text-black hover:bg-[#C49843] transition"
                      >
                        Set up overhead →
                      </Link>
                      <button
                        type="button"
                        onClick={skipOverhead}
                        className="inline-flex items-center rounded-xl border border-white/15 px-4 py-2 text-xs text-white/50 hover:bg-white/5 transition"
                      >
                        Skip for now
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── 5. Get started — choose your path ──────────────────────────────── */}
          <div className={[
            "rounded-[20px] border p-5 transition-all",
            hasExpense ? "border-white/10 bg-white/[0.03]" : "border-white/15 bg-white/[0.05]",
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
                  {hasExpense ? "You&apos;re in — Chief is tracking your data." : "Pick the approach that fits where you are."}
                </div>
                {!hasExpense && (
                  <div className="mt-4 space-y-3">
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
                    <div className="space-y-1.5">
                      <button
                        onClick={recheckExpense}
                        disabled={checking}
                        className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-xs text-white/50 hover:bg-white/5 transition disabled:opacity-50"
                      >
                        {checking ? "Checking…" : "I've already started — check now"}
                      </button>
                      <p className="text-[11px] text-white/35 leading-relaxed">
                        Already logged an expense or created a job? Tap this to confirm — it checks your account in real time.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ── ChiefOS is built around Jobs ─────────────────────────────────────── */}
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

        {/* ── Chief Operating System Functions ─────────────────────────────────── */}
        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/30 mb-1">Chief Operating System Functions</div>
          <div className="text-xs text-white/40 mb-5">Everything Chief can do — and what plan you need to unlock it.</div>

          {/* Free tier */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                Included on Free
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FREE_FEATURES.map((card) => (
                <FeatureCardItem key={card.title} card={card} locked={false} />
              ))}
            </div>
          </div>

          {/* Starter tier */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className={[
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                isStarterOrPro
                  ? "bg-[rgba(212,168,83,0.15)] border-[rgba(212,168,83,0.3)] text-[#D4A853]"
                  : "bg-white/5 border-white/10 text-white/35",
              ].join(" ")}>
                {isStarterOrPro ? "Included on Starter" : "Starter — $59/mo"}
              </span>
              {!isStarterOrPro && (
                <span className="text-[10px] text-white/25">Locked on your plan</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTER_FEATURES.map((card) => (
                <FeatureCardItem key={card.title} card={card} locked={!isStarterOrPro} />
              ))}
            </div>
            {!isStarterOrPro && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => router.push("/app/settings/billing")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4A853] px-4 py-2 text-xs font-semibold text-black hover:bg-[#C49843] transition"
                >
                  Upgrade to Starter — $59/mo →
                </button>
              </div>
            )}
          </div>

          {/* Pro tier */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className={[
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                isPro
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                  : "bg-white/5 border-white/10 text-white/35",
              ].join(" ")}>
                {isPro ? "Included on Pro" : "Pro — $149/mo"}
              </span>
              {!isPro && (
                <span className="text-[10px] text-white/25">Locked on your plan</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRO_FEATURES.map((card) => (
                <FeatureCardItem key={card.title} card={card} locked={!isPro} />
              ))}
            </div>
            {!isPro && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => router.push("/app/settings/billing")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition"
                >
                  Upgrade to Pro — $149/mo →
                </button>
              </div>
            )}
          </div>

        </div>

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
        <div className="mt-10 text-center">
          <Link
            href="/app/dashboard"
            className="inline-flex items-center rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition"
          >
            Go to Dashboard →
          </Link>
        </div>

      </div>
    </div>
  );
}
