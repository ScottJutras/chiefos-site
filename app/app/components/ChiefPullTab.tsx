"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Quota = {
  used: number;
  limit: number;
  planKey: string;
  mode?: "metered" | "support";
  unlimited?: boolean;
};

/**
 * Floating "Ask Chief" chat-head anchored to the right edge.
 * - Gold "C" circle matching the homepage DemoChiefChat FAB
 * - Pulsing ring animation while closed
 * - Quota indicator below the circle:
 *     Free (limit 10)  → "1/10"
 *     Starter (250)    → "1/250"
 *     Pro (2,000)      → "1/2,000"
 * - Disappears while the Chief panel is open
 * - Suppressed when rendered inside the embed iframe (?embed=1)
 */
function ChiefPullTabInner() {
  const searchParams = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const fetchedRef = useRef(false);

  // Fetch quota once on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function load() {
      try {
        const sess = await supabase.auth.getSession();
        const token = sess?.data?.session?.access_token;
        if (!token) return;
        const r = await fetch("/api/chief-quota", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = await r.json();
        if (j?.ok) setQuota({
          used: j.used,
          limit: j.limit,
          planKey: j.planKey,
          mode: j.mode,
          unlimited: j.unlimited,
        });
      } catch {
        // fail-soft — quota indicator just won't show
      }
    }

    void load();
  }, []);

  // Listen for open/close events from GlobalChiefDock
  useEffect(() => {
    function onOpen() { setPanelOpen(true); }
    function onClose() { setPanelOpen(false); }
    window.addEventListener("open-chief", onOpen);
    window.addEventListener("close-chief", onClose);
    return () => {
      window.removeEventListener("open-chief", onOpen);
      window.removeEventListener("close-chief", onClose);
    };
  }, []);

  // Listen for postMessage from the ChiefClient iframe when a question is sent
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "chief-quota-used") {
        setQuota((prev) => {
          if (!prev) return prev;
          // Support-mode users are unmetered — don't drift the counter.
          if (prev.mode === "support") return prev;
          return { ...prev, used: Math.min(prev.used + 1, prev.limit) };
        });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Don't render inside the embed iframe (would create a dock-inside-dock loop)
  if (searchParams.get("embed") === "1") return null;
  if (panelOpen) return null;

  function open() {
    window.dispatchEvent(
      new CustomEvent("open-chief", {
        detail: { query: "", page: window.location.pathname },
      })
    );
  }

  const isSupport = quota?.mode === "support";
  const remaining = quota && !isSupport ? Math.max(0, quota.limit - quota.used) : null;
  const isFree    = !quota || quota.planKey === "free";
  const isStarter = quota?.planKey === "starter";
  const isPro     = quota?.planKey === "pro";

  return (
    <>
      <style>{`
        @keyframes chiefPullRing {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(2.4); opacity: 0;    }
        }
        @keyframes chiefPullGlow {
          0%,100% { box-shadow: 0 0 0 1.5px rgba(212,168,83,0.3), 0 0 18px rgba(212,168,83,0.12), 0 6px 24px rgba(0,0,0,0.6); }
          50%     { box-shadow: 0 0 0 1.5px rgba(212,168,83,0.55), 0 0 38px rgba(212,168,83,0.28), 0 6px 24px rgba(0,0,0,0.6); }
        }
      `}</style>

      <button
        type="button"
        onClick={open}
        aria-label="Ask Chief"
        style={{
          position: "fixed",
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        {/* Pulsing rings */}
        <div style={{ position: "relative", width: 48, height: 48 }}>
          {[0, 900, 1800].map((delay) => (
            <div key={delay} style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "1px solid rgba(212,168,83,0.45)",
              animation: `chiefPullRing 2.7s ease-out ${delay}ms infinite`,
              pointerEvents: "none",
            }} />
          ))}

          {/* Gold "C" circle */}
          <div style={{
            position: "relative", zIndex: 1,
            width: 48, height: 48, borderRadius: "50%",
            background: "radial-gradient(circle at 38% 38%, #1C1910, #0C0B0A)",
            border: "1.5px solid rgba(212,168,83,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "chiefPullGlow 3.2s ease-in-out infinite",
            transition: "transform 0.15s ease",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.09)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
          >
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
              fontSize: 20,
              color: "#D4A853",
              lineHeight: 1,
              textShadow: "0 0 14px rgba(212,168,83,0.65)",
            }}>C</span>
          </div>
        </div>

        {/* Quota indicator — only for metered users (owners/admins/board).
            Support-mode users (employees) see nothing extra: the gold "C"
            speaks for itself and there's no counter to display. */}
        {quota !== null && !isSupport && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 9,
              fontWeight: 600,
              color: remaining === 0 ? "rgba(212,168,83,0.4)" : "rgba(212,168,83,0.65)",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}>
              {quota.used}/{isFree ? "10" : isStarter ? "250" : isPro ? "2,000" : quota.limit.toLocaleString()}
            </span>
          </div>
        )}
      </button>
    </>
  );
}

export default function ChiefPullTab() {
  return (
    <Suspense fallback={null}>
      <ChiefPullTabInner />
    </Suspense>
  );
}
