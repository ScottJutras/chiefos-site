"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchWhoami } from "@/lib/whoami";

type GateState = {
  loading: boolean;
  userId: string | null;
  tenantId: string | null;
  hasWhatsApp: boolean;
  role?: string | null; // currently not returned by whoami route (keep for future)
  reason?: string | null;
};

export function useTenantGate(opts?: { requireWhatsApp?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const requireWhatsApp = !!opts?.requireWhatsApp;

  const [state, setState] = useState<GateState>({
    loading: true,
    userId: null,
    tenantId: null,
    hasWhatsApp: false,
    role: null,
    reason: null,
  });

  useEffect(() => {
    let cancelled = false;

    function safeSet(next: Partial<GateState>) {
      if (cancelled) return;
      setState((s) => ({ ...s, ...next }));
    }

    function safePush(target: string) {
      if (!target) return;
      if (pathname === target) return;
      router.push(target);
    }

    async function run() {
      try {
        const w = await fetchWhoami();

       if (!w?.ok) {
  // ✅ Tomorrow-safe: "no-session-token" is often just hydration delay right after login
  if (w?.error === "no-session-token") {
    safeSet({ loading: true, reason: "waiting-session" });
    // retry once shortly (don’t loop forever)
    setTimeout(() => {
      if (!cancelled) run();
    }, 350);
    return;
  }

  safeSet({ loading: false, reason: w?.error || "whoami-failed" });
  safePush("/login");
  return;
}

        const userId = w.userId ? String(w.userId) : null;
        const tenantId = w.tenantId ? String(w.tenantId) : null;
        const hasWhatsApp = !!w.hasWhatsApp;

        if (!userId) {
          safeSet({ loading: false, reason: "no-auth" });
          safePush("/login");
          return;
        }

        if (!tenantId) {
          safeSet({ loading: false, userId, tenantId: null, hasWhatsApp, reason: "no-tenant" });
          safePush("/finish-signup");
          return;
        }

        if (requireWhatsApp && !hasWhatsApp) {
          safeSet({ loading: false, userId, tenantId, hasWhatsApp: false, reason: "no-whatsapp" });
          safePush("/app/connect-whatsapp");
          return;
        }

        safeSet({
          loading: false,
          userId,
          tenantId,
          hasWhatsApp,
          reason: null,
        });
      } catch {
        safeSet({ loading: false, reason: "error" });
        safePush("/login");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, requireWhatsApp]);

  return state;
}