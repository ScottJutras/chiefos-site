"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepKey = "verify-account" | "resolve-workspace" | "secure-tenant" | "prepare-chiefos";

type StepDef = { key: StepKey; label: string; logs: string[] };

const STEP_DEFS: StepDef[] = [
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
    key: "resolve-workspace",
    label: "Resolve workspace",
    logs: [
      "Calling workspace resolver…",
      "Verifying tenant boundary…",
      "Workspace resolved",
    ],
  },
  {
    key: "secure-tenant",
    label: "Secure tenant context",
    logs: [
      "Confirming tenant isolation…",
      "Context boundary secured",
    ],
  },
  {
    key: "prepare-chiefos",
    label: "Prepare ChiefOS",
    logs: [
      "Loading operating center…",
      "Chief is standing by",
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      if (i >= text.length) { clearInterval(iv); setDone(true); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return { displayed, done };
}

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

function LogLine({ text, onDone }: { text: string; onDone?: () => void }) {
  const { displayed, done } = useTypewriter(text, 20);
  useEffect(() => { if (done && onDone) onDone(); }, [done, onDone]);
  const isSuccess = done && (
    text.includes("confirmed") || text.includes("resolved") ||
    text.includes("secured") || text.includes("by") || text.includes("validated")
  );
  return (
    <div style={{ fontFamily: "'JetBrains Mono','Fira Code','SF Mono',Consolas,monospace", fontSize: 12, lineHeight: 1.75, display: "flex", gap: 8, alignItems: "flex-start", color: isSuccess ? "#6BCB77" : "rgba(168,160,144,0.85)" }}>
      <span style={{ color: "rgba(212,168,83,0.4)", userSelect: "none", flexShrink: 0 }}>›</span>
      <span>{displayed}{!done && <Cursor />}</span>
    </div>
  );
}

function StepBlock({ step, isActive, isComplete, isReallyDone, onAnimDone }: {
  step: StepDef;
  isActive: boolean;
  isComplete: boolean;
  isReallyDone: boolean;
  onAnimDone: (key: StepKey) => void;
}) {
  const [visibleLogs, setVisibleLogs] = useState(0);
  const calledRef = useRef(false);

  useEffect(() => { if (isActive && visibleLogs === 0) setVisibleLogs(1); }, [isActive, visibleLogs]);

  const handleLogDone = useCallback(() => {
    if (visibleLogs < step.logs.length) {
      setTimeout(() => setVisibleLogs((v) => v + 1), 160 + Math.random() * 240);
    } else if (!calledRef.current) {
      calledRef.current = true;
      setTimeout(() => onAnimDone(step.key), 300);
    }
  }, [visibleLogs, step.logs.length, step.key, onAnimDone]);

  if (!isActive && !isComplete) return null;

  return (
    <div style={{ marginBottom: 18, opacity: isComplete ? 0.55 : 1, transition: "opacity 0.5s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: isComplete ? "#6BCB77" : "#D4A853", boxShadow: isComplete ? "0 0 6px rgba(107,203,119,0.4)" : "0 0 6px rgba(212,168,83,0.35)", transition: "all 0.4s" }} />
        <span style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: isComplete ? "#6BCB77" : "#D4A853" }}>
          {step.label}
        </span>
        {isComplete && <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(107,203,119,0.45)", marginLeft: "auto" }}>✓ complete</span>}
      </div>
      <div style={{ paddingLeft: 16 }}>
        {step.logs.slice(0, visibleLogs).map((log, i) => (
          <LogLine key={i} text={log} onDone={i === visibleLogs - 1 ? handleLogDone : undefined} />
        ))}
      </div>
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────

function AuthTransitionInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const routerRef = useRef(router);
  const returnToRef = useRef("/app");
  useEffect(() => { routerRef.current = router; }, [router]);
  useEffect(() => {
    const raw = sp.get("returnTo") || "";
    if (raw.startsWith("/") && !raw.startsWith("//")) returnToRef.current = raw;
  }, [sp]);

  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(new Set());
  const [allComplete, setAllComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const realDoneRef = useRef<Set<StepKey>>(new Set());
  const pendingAdvanceRef = useRef<Map<StepKey, () => void>>(new Map());

  function signalRealDone(key: StepKey) {
    realDoneRef.current.add(key);
    const cb = pendingAdvanceRef.current.get(key);
    if (cb) { pendingAdvanceRef.current.delete(key); cb(); }
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

  useEffect(() => {
    if (allComplete) return;
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [allComplete]);

  useEffect(() => {
    if (activeStepIdx >= STEP_DEFS.length && STEP_DEFS.length > 0 && !allComplete) {
      setAllComplete(true);
      setTimeout(() => routerRef.current.replace(returnToRef.current), 600);
    }
  }, [activeStepIdx, allComplete]);

  const hasRunRef = useRef(false);
  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    async function run() {
      try {
        // verify-account
        const { data: sd } = await supabase.auth.getSession();
        const accessToken = sd?.session?.access_token || "";
        if (!accessToken) {
          routerRef.current.replace(`/login?returnTo=${encodeURIComponent(returnToRef.current)}`);
          return;
        }
        signalRealDone("verify-account");

        // resolve-workspace
        let who: Awaited<ReturnType<typeof fetchWhoami>>;
        try {
          who = await fetchWhoami();
        } catch {
          routerRef.current.replace(`/finish-signup?returnTo=${encodeURIComponent(returnToRef.current)}`);
          return;
        }

        if (!who?.ok) {
          if (who?.error === "no-session-token") {
            routerRef.current.replace(`/login?returnTo=${encodeURIComponent(returnToRef.current)}`);
            return;
          }
          routerRef.current.replace(`/finish-signup?returnTo=${encodeURIComponent(returnToRef.current)}`);
          return;
        }
        signalRealDone("resolve-workspace");

        // secure-tenant
        if (!who.userId) {
          routerRef.current.replace(`/login?returnTo=${encodeURIComponent(returnToRef.current)}`);
          return;
        }
        if (!who.tenantId) {
          routerRef.current.replace(`/finish-signup?returnTo=${encodeURIComponent(returnToRef.current)}`);
          return;
        }
        signalRealDone("secure-tenant");

        // prepare-chiefos
        signalRealDone("prepare-chiefos");

      } catch {
        routerRef.current.replace(`/finish-signup?returnTo=${encodeURIComponent(returnToRef.current)}`);
      }
    }

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        @keyframes chiefCursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        .chief-scrollbar::-webkit-scrollbar{width:3px}
        .chief-scrollbar::-webkit-scrollbar-track{background:transparent}
        .chief-scrollbar::-webkit-scrollbar-thumb{background:rgba(212,168,83,0.15);border-radius:2px}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0C0B0A", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ position: "fixed", inset: 0, background: "radial-gradient(circle at top,rgba(212,168,83,0.06),transparent 40%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>
          {/* Chief mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "linear-gradient(135deg,rgba(212,168,83,0.15),rgba(212,168,83,0.05))", border: "1px solid rgba(212,168,83,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, color: "#D4A853", flexShrink: 0 }}>C</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#E8E0D4", letterSpacing: "-0.01em" }}>Chief</div>
              <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 10, color: "rgba(168,160,144,0.55)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Secure Sign-in</div>
            </div>
          </div>

          {/* Terminal */}
          <div style={{ background: "rgba(15,14,12,0.9)", border: "1px solid rgba(212,168,83,0.12)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(212,168,83,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[0.3, 0.15, 0.07].map((o, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: `rgba(212,168,83,${o})` }} />)}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(168,160,144,0.35)", letterSpacing: "0.04em" }}>
                chief://auth/transition · {elapsed}s
              </div>
            </div>

            <div className="chief-scrollbar" style={{ padding: "18px 14px", maxHeight: 360, overflowY: "auto" }}>
              {STEP_DEFS.map((step, i) => (
                <StepBlock
                  key={step.key}
                  step={step}
                  isActive={i === activeStepIdx}
                  isComplete={completedSteps.has(step.key)}
                  isReallyDone={realDoneRef.current.has(step.key)}
                  onAnimDone={onAnimDone}
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(168,160,144,0.3)" }}>
              {allComplete ? "All systems nominal" : `Step ${activeStepIdx + 1} of ${STEP_DEFS.length}`}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(168,160,144,0.3)" }}>ChiefOS v1.0</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AuthTransitionPage() {
  return (
    <Suspense fallback={null}>
      <AuthTransitionInner />
    </Suspense>
  );
}
