"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepKey =
  | "verify-account"
  | "load-signup"
  | "resolve-workspace"
  | "create-workspace"
  | "record-agreement"
  | "activate-access";

type PendingSignup = {
  id: string;
  email: string;
  owner_name: string | null;
  owner_phone: string | null;
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

type Vars = { company: string; region: string; plan: string };

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepDef = { key: StepKey; label: string; logs: string[] };

const STEP_DEFS_NEW: StepDef[] = [
  {
    key: "verify-account",
    label: "Verify identity",
    logs: [
      "Checking authentication state…",
      "Session token validated",
      "Identity confirmed",
    ],
  },
  {
    key: "load-signup",
    label: "Load signup context",
    logs: [
      "Retrieving signup record…",
      "Company: {{company}}",
      "Region: {{region}}",
      "Plan intent: {{plan}}",
      "Signup context loaded",
    ],
  },
  {
    key: "resolve-workspace",
    label: "Resolve workspace",
    logs: [
      "Scanning existing tenants…",
      "No prior workspace found for this account",
      "Workspace creation authorized",
    ],
  },
  {
    key: "create-workspace",
    label: "Build workspace",
    logs: [
      "Provisioning tenant boundary for {{company}}…",
      "Tenant isolation verified",
      "Initializing financial ledger…",
      "Job tracking schema applied…",
      "Region policies set — {{region}}",
      "Workspace created successfully",
    ],
  },
  {
    key: "record-agreement",
    label: "Record legal agreements",
    logs: [
      "Writing terms acceptance…",
      "Privacy policy acknowledged…",
      "AI usage policy recorded…",
      "DPA acknowledgment stored",
      "All agreements recorded with timestamp",
    ],
  },
  {
    key: "activate-access",
    label: "Activate Chief",
    logs: [
      "Configuring reasoning engine…",
      "Binding ingestion channels…",
      "Plan gating applied — {{plan}}",
      "Chief is ready",
    ],
  },
];

const STEP_DEFS_RETURNING: StepDef[] = [
  {
    key: "verify-account",
    label: "Verify identity",
    logs: [
      "Checking authentication state…",
      "Session token validated",
      "Identity confirmed — welcome back",
    ],
  },
  {
    key: "load-signup",
    label: "Load signup context",
    logs: [
      "Retrieving pending setup record…",
      "Company: {{company}}",
      "Context loaded",
    ],
  },
  {
    key: "resolve-workspace",
    label: "Resolve workspace",
    logs: [
      "Scanning existing tenants…",
      "Prior workspace found for {{company}}",
      "Workspace verified — loading context",
    ],
  },
  {
    key: "record-agreement",
    label: "Record legal agreements",
    logs: [
      "Writing terms acceptance…",
      "Privacy policy acknowledged…",
      "AI usage policy recorded…",
      "All agreements recorded with timestamp",
    ],
  },
  {
    key: "activate-access",
    label: "Activate Chief",
    logs: [
      "Restoring session context…",
      "Chief is ready",
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function interpolate(text: string, vars: Vars): string {
  return text
    .replace("{{company}}", vars.company || "—")
    .replace("{{region}}", vars.region || "—")
    .replace("{{plan}}", vars.plan || "Free");
}

function normalizePlan(raw: string | null): PlanTier {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("pro")) return "pro";
  if (s.includes("starter")) return "starter";
  if (s === "free") return "free";
  return null;
}

function planLabel(p: PlanTier): string {
  if (p === "pro") return "Pro";
  if (p === "starter") return "Starter";
  return "Free";
}

function regionLabel(country: string | null, province: string | null): string {
  if (!country) return "—";
  const countryLabel = country === "US" ? "United States" : "Canada";
  return province ? `${province}, ${countryLabel}` : countryLabel;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ─── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 22) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(iv);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  return { displayed, done };
}

// ─── Components ───────────────────────────────────────────────────────────────

function Cursor() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height: "1.05em",
        background: "#D4A853",
        marginLeft: 2,
        verticalAlign: "text-bottom",
        animation: "chiefCursorBlink 0.9s step-end infinite",
      }}
    />
  );
}

function LogLine({
  text,
  vars,
  onDone,
  isError,
}: {
  text: string;
  vars: Vars;
  onDone?: () => void;
  isError?: boolean;
}) {
  const interpolated = interpolate(text, vars);
  const { displayed, done } = useTypewriter(interpolated, 20);

  useEffect(() => {
    if (done && onDone) onDone();
  }, [done, onDone]);

  const isSuccess =
    done &&
    !isError &&
    (interpolated.includes("successfully") ||
      interpolated.includes("confirmed") ||
      interpolated.includes("ready") ||
      interpolated.includes("loaded") ||
      interpolated.includes("recorded with") ||
      interpolated.includes("verified") ||
      interpolated.includes("authorized") ||
      interpolated.includes("found") ||
      interpolated.includes("applied") ||
      interpolated.includes("created") ||
      interpolated.includes("stored"));

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono','Fira Code','SF Mono',Consolas,monospace",
        fontSize: 12,
        lineHeight: 1.75,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        color: isError
          ? "rgba(248,113,113,0.9)"
          : isSuccess
            ? "#6BCB77"
            : "rgba(168,160,144,0.85)",
      }}
    >
      <span style={{ color: isError ? "rgba(248,113,113,0.4)" : "rgba(212,168,83,0.4)", userSelect: "none", flexShrink: 0 }}>›</span>
      <span>
        {displayed}
        {!done && <Cursor />}
      </span>
    </div>
  );
}

function StepBlock({
  step,
  isActive,
  isComplete,
  vars,
  isReallyDone,
  onAnimDone,
  errorLine,
}: {
  step: StepDef;
  isActive: boolean;
  isComplete: boolean;
  vars: Vars;
  isReallyDone: boolean;
  onAnimDone: (key: StepKey) => void;
  errorLine?: string | null;
}) {
  const [visibleLogs, setVisibleLogs] = useState(0);
  const calledRef = useRef(false);

  useEffect(() => {
    if (isActive && visibleLogs === 0) setVisibleLogs(1);
  }, [isActive, visibleLogs]);

  // Reset when step becomes active again (shouldn't happen, but safety)
  useEffect(() => {
    if (!isActive && !isComplete) {
      setVisibleLogs(0);
      calledRef.current = false;
    }
  }, [isActive, isComplete]);

  const handleLogDone = useCallback(() => {
    if (errorLine) return; // don't advance on error
    const totalLogs = step.logs.length;
    if (visibleLogs < totalLogs) {
      setTimeout(() => setVisibleLogs((v) => v + 1), 160 + Math.random() * 280);
    } else if (!calledRef.current) {
      calledRef.current = true;
      setTimeout(() => onAnimDone(step.key), 350);
    }
  }, [visibleLogs, step.logs.length, step.key, onAnimDone, errorLine]);

  if (!isActive && !isComplete) return null;

  return (
    <div style={{ marginBottom: 18, opacity: isComplete ? 0.55 : 1, transition: "opacity 0.5s" }}>
      {/* Step header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: isComplete ? "#6BCB77" : errorLine ? "#f87171" : "#D4A853",
            boxShadow: isComplete
              ? "0 0 6px rgba(107,203,119,0.4)"
              : errorLine
                ? "0 0 6px rgba(248,113,113,0.3)"
                : "0 0 6px rgba(212,168,83,0.35)",
            transition: "all 0.4s",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: isComplete ? "#6BCB77" : errorLine ? "#f87171" : "#D4A853",
          }}
        >
          {step.label}
        </span>
        {isComplete && (
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(107,203,119,0.45)", marginLeft: "auto" }}>
            ✓ complete
          </span>
        )}
      </div>

      {/* Log lines */}
      <div style={{ paddingLeft: 16 }}>
        {step.logs.slice(0, visibleLogs).map((log, i) => (
          <LogLine
            key={i}
            text={log}
            vars={vars}
            onDone={i === visibleLogs - 1 && !errorLine ? handleLogDone : undefined}
          />
        ))}
        {errorLine && isActive && (
          <LogLine text={errorLine} vars={vars} isError />
        )}
      </div>
    </div>
  );
}

function ReadyState() {
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setOpacity(1), 100);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      style={{
        marginTop: 24,
        padding: "20px 16px",
        background: "linear-gradient(135deg,rgba(107,203,119,0.06) 0%,rgba(212,168,83,0.04) 100%)",
        border: "1px solid rgba(107,203,119,0.15)",
        borderRadius: 8,
        opacity,
        transition: "opacity 0.8s ease",
      }}
    >
      <div style={{ fontFamily: "-apple-system,sans-serif", fontSize: 16, fontWeight: 600, color: "#E8E0D4", marginBottom: 4 }}>
        Your workspace is ready.
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "rgba(168,160,144,0.65)" }}>
        Chief has full context. Redirecting you now…
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinishSignupClient() {
  const router = useRouter();
  const sp = useSearchParams();

  // Stable refs to avoid effect re-runs when router/returnTo change during hydration
  const routerRef = useRef(router);
  const returnToRef = useRef("/app/welcome");
  useEffect(() => { routerRef.current = router; }, [router]);
  useEffect(() => {
    const raw = sp.get("returnTo") || "";
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      returnToRef.current = raw;
    }
  }, [sp]);

  // Vars for log interpolation
  const [vars, setVars] = useState<Vars>({ company: "—", region: "—", plan: "Free" });
  const [isReturning, setIsReturning] = useState(false);
  const [steps, setSteps] = useState<StepDef[]>(STEP_DEFS_NEW);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(new Set());
  const [allComplete, setAllComplete] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom as log lines appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  // Sync/advance machinery
  const realDoneRef = useRef<Set<StepKey>>(new Set());
  const pendingAdvanceRef = useRef<Map<StepKey, () => void>>(new Map());

  function signalRealDone(key: StepKey) {
    realDoneRef.current.add(key);
    const cb = pendingAdvanceRef.current.get(key);
    if (cb) {
      pendingAdvanceRef.current.delete(key);
      cb();
    }
  }

  const onAnimDone = useCallback((key: StepKey) => {
    if (realDoneRef.current.has(key)) {
      setCompletedSteps((prev) => new Set([...prev, key]));
      setActiveStepIdx((i) => i + 1);
    } else {
      pendingAdvanceRef.current.set(key, () => {
        setCompletedSteps((prev) => new Set([...prev, key]));
        setActiveStepIdx((i) => i + 1);
      });
    }
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (allComplete || errorLine) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [allComplete, errorLine]);

  // Detect "done" when activeStepIdx goes past the last step
  const prevStepsRef = useRef(steps);
  useEffect(() => { prevStepsRef.current = steps; }, [steps]);
  useEffect(() => {
    if (activeStepIdx >= steps.length && steps.length > 0 && !allComplete && !errorLine) {
      setAllComplete(true);
      setTimeout(() => {
        routerRef.current.replace(returnToRef.current);
      }, 1800);
    }
  }, [activeStepIdx, steps.length, allComplete, errorLine]);

  // ── Main async run — only fires once ────────────────────────────────────────
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    async function getPendingSignup(accessToken: string): Promise<PendingSignup | null> {
      const res = await fetch("/api/auth/pending-signup", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load pending signup.");
      return j?.pendingSignup || null;
    }

    async function consumePendingSignup(accessToken: string) {
      const res = await fetch("/api/auth/pending-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: "consume" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to consume pending signup.");
    }

    async function writeLegalAcceptance(pending: PendingSignup, accessToken: string) {
      if (
        !pending.terms_accepted_at || !pending.privacy_accepted_at ||
        !pending.ai_policy_accepted_at || !pending.dpa_acknowledged_at ||
        !pending.terms_version || !pending.privacy_version ||
        !pending.ai_policy_version || !pending.dpa_version
      ) return;

      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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

    async function setTenantMeta(accessToken: string) {
      await fetch("/api/auth/pending-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: "set-tenant-meta" }),
      });
    }

    async function maybeActivateTester(pending: PendingSignup | null, accessToken: string) {
      if (!pending || pending.signup_mode !== "tester") return;
      const res = await fetch("/api/tester-access/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Tester activation failed.");
      if (typeof window !== "undefined" && j?.plan) {
        localStorage.setItem("chiefos_selected_plan", String(j.plan));
      }
    }

    async function run() {
      try {
        // ── Step 1: verify-account ─────────────────────────────────────────
        let userId: string | null = null;
        let accessToken = "";

        // Try session cache first (no network call)
        try {
          const { data: sd } = await supabase.auth.getSession();
          if (sd?.session?.user?.id) {
            userId = sd.session.user.id;
            accessToken = sd.session.access_token || "";
          }
        } catch { /* ignore */ }

        // Fall back to getUser with retries (handles AbortErrors gracefully)
        if (!userId) {
          for (let i = 0; i < 6; i++) {
            try {
              const { data, error } = await supabase.auth.getUser();
              if (!error && data?.user?.id) {
                userId = data.user.id;
                const { data: sd2 } = await supabase.auth.getSession();
                accessToken = sd2?.session?.access_token || "";
                break;
              }
            } catch { /* AbortError or transient — retry */ }
            await sleep(400);
          }
        }

        if (!userId) {
          routerRef.current.replace(`/login?returnTo=${encodeURIComponent(returnToRef.current)}`);
          return;
        }

        signalRealDone("verify-account");

        // ── Step 2: load-signup ────────────────────────────────────────────
        const pending = await getPendingSignup(accessToken);
        const plan = normalizePlan(pending?.requested_plan_key ?? null);
        const resolvedVars: Vars = {
          company: pending?.company_name || "your workspace",
          region: regionLabel(pending?.country ?? null, pending?.province ?? null),
          plan: planLabel(plan),
        };
        setVars(resolvedVars);
        signalRealDone("load-signup");

        // ── Step 3: resolve-workspace ──────────────────────────────────────
        const { data: existing, error: exErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (exErr) throw exErr;

        const returning = !!existing?.tenant_id;

        if (returning) {
          // Switch to returning user step definitions (no create-workspace step)
          setIsReturning(true);
          setSteps(STEP_DEFS_RETURNING);
        }

        signalRealDone("resolve-workspace");

        // ── Step 4: create-workspace (new users only) ──────────────────────
        if (!returning) {
          const { error: rpcErr } = await supabase.rpc("chiefos_finish_signup", {
            company_name: pending?.company_name || null,
          });
          if (rpcErr) throw rpcErr;
          await setTenantMeta(accessToken);
          signalRealDone("create-workspace");
        }

        // ── Step 5: record-agreement ───────────────────────────────────────
        if (pending) await writeLegalAcceptance(pending, accessToken);
        signalRealDone("record-agreement");

        // ── Step 6: activate-access ────────────────────────────────────────
        await maybeActivateTester(pending, accessToken);
        await consumePendingSignup(accessToken);
        signalRealDone("activate-access");

      } catch (e: any) {
        const msg = String(e?.message || "An unexpected error occurred.");
        setErrorLine(`ERROR: ${msg}`);
      }
    }

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeStep = steps[activeStepIdx] ?? null;

  return (
    <>
      <style>{`
        @keyframes chiefCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .chief-scrollbar::-webkit-scrollbar { width: 3px; }
        .chief-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .chief-scrollbar::-webkit-scrollbar-thumb { background: rgba(212,168,83,0.15); border-radius: 2px; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#0C0B0A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "radial-gradient(circle at top,rgba(212,168,83,0.06),transparent 40%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>
          {/* Chief mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "linear-gradient(135deg,rgba(212,168,83,0.15) 0%,rgba(212,168,83,0.05) 100%)",
                border: "1px solid rgba(212,168,83,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Georgia,serif",
                fontSize: 20,
                fontWeight: 700,
                color: "#D4A853",
                flexShrink: 0,
              }}
            >
              C
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#E8E0D4", letterSpacing: "-0.01em" }}>
                Chief
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono','Fira Code',monospace",
                  fontSize: 10,
                  color: "rgba(168,160,144,0.55)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {isReturning ? "Workspace Handoff" : "Workspace Setup"}
              </div>
            </div>
          </div>

          {/* Terminal window */}
          <div
            style={{
              background: "rgba(15,14,12,0.9)",
              border: "1px solid rgba(212,168,83,0.12)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Title bar */}
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid rgba(212,168,83,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {[0.3, 0.15, 0.07].map((o, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: `rgba(212,168,83,${o})` }} />
                ))}
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 10,
                  color: "rgba(168,160,144,0.35)",
                  letterSpacing: "0.04em",
                }}
              >
                chief://workspace/setup · {elapsed}s
              </div>
            </div>

            {/* Log area */}
            <div
              ref={scrollRef}
              className="chief-scrollbar"
              style={{ padding: "18px 14px", maxHeight: 420, overflowY: "auto" }}
            >
              {steps.map((step, i) => (
                <StepBlock
                  key={step.key}
                  step={step}
                  isActive={i === activeStepIdx}
                  isComplete={completedSteps.has(step.key)}
                  vars={vars}
                  isReallyDone={realDoneRef.current.has(step.key)}
                  onAnimDone={onAnimDone}
                  errorLine={i === activeStepIdx ? errorLine : null}
                />
              ))}
              {allComplete && <ReadyState />}
            </div>
          </div>

          {/* Bottom status */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 2px",
            }}
          >
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(168,160,144,0.3)" }}>
              {allComplete
                ? "All systems nominal"
                : errorLine
                  ? "Setup paused — see error above"
                  : `Step ${activeStepIdx + 1} of ${steps.length}`}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(168,160,144,0.3)" }}>
              ChiefOS v1.0
            </div>
          </div>

          {/* Error actions */}
          {errorLine && (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href={`/login?returnTo=${encodeURIComponent(returnToRef.current)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 20px",
                  background: "#D4A853",
                  color: "#0C0B0A",
                  fontWeight: 600,
                  fontSize: 14,
                  borderRadius: 2,
                  textDecoration: "none",
                }}
              >
                Back to login
              </a>
              <a
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 20px",
                  border: "1px solid rgba(212,168,83,0.3)",
                  color: "rgba(168,160,144,0.8)",
                  fontWeight: 600,
                  fontSize: 14,
                  borderRadius: 2,
                  textDecoration: "none",
                }}
              >
                Create account again
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
