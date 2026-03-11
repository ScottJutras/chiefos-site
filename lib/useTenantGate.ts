"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchWhoami } from "@/lib/whoami";

type BetaPlan = "free" | "starter" | "pro";
type BetaStatus = "requested" | "approved" | "denied";

type GateState = {
  loading: boolean;
  userId: string | null;
  tenantId: string | null;
  hasWhatsApp: boolean;

  email: string | null;

  // Canonical paid plan from /api/whoami
  planKey: BetaPlan | null;

  // Backward-compatible entitlement fields
  betaPlan: BetaPlan | null;
  betaStatus: BetaStatus | null;
  betaEntitlementPlan: BetaPlan | null;

  role: string | null;
  reason: string | null;
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

    email: null,
    planKey: null,
    betaPlan: null,
    betaStatus: null,
    betaEntitlementPlan: null,

    role: null,
    reason: null,
  });

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function safeSet(next: Partial<GateState>) {
      if (cancelled) return;
      setState((prev) => ({ ...prev, ...next }));
    }

    function safePush(target: string) {
      if (!target) return;
      if (pathname === target) return;
      router.push(target);
    }

    function withReturnTo(basePath: string) {
      const rt = encodeURIComponent(pathname || "/app/expenses");
      return `${basePath}?returnTo=${rt}`;
    }

    async function run() {
      try {
        const w: any = await fetchWhoami();

        if (!w?.ok) {
          if (w?.error === "no-session-token") {
            safeSet({ loading: true, reason: "waiting-session" });

            attempts += 1;
            if (attempts > 6) {
              safeSet({ loading: false, reason: "no-session-token" });
              safePush("/login");
              return;
            }

            setTimeout(() => {
              if (!cancelled) void run();
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

        const email = w.email ? String(w.email) : null;
        const planKey = (w.planKey as BetaPlan) ?? null;
        const betaPlan = (w.betaPlan as BetaPlan) ?? null;
        const betaStatus = (w.betaStatus as BetaStatus) ?? null;
        const betaEntitlementPlan = (w.betaEntitlementPlan as BetaPlan) ?? null;
        const role = w.role ? String(w.role) : null;

        if (!userId) {
          safeSet({
            loading: false,
            userId: null,
            tenantId: null,
            hasWhatsApp: false,
            email,
            planKey,
            betaPlan,
            betaStatus,
            betaEntitlementPlan,
            role,
            reason: "no-auth",
          });
          safePush("/login");
          return;
        }

        if (!tenantId) {
          safeSet({
            loading: false,
            userId,
            tenantId: null,
            hasWhatsApp,
            email,
            planKey,
            betaPlan,
            betaStatus,
            betaEntitlementPlan,
            role,
            reason: "no-tenant",
          });
          safePush(withReturnTo("/finish-signup"));
          return;
        }

        if (requireWhatsApp && !hasWhatsApp) {
          safeSet({
            loading: false,
            userId,
            tenantId,
            hasWhatsApp: false,
            email,
            planKey,
            betaPlan,
            betaStatus,
            betaEntitlementPlan,
            role,
            reason: "no-whatsapp",
          });
          safePush(withReturnTo("/app/connect-whatsapp"));
          return;
        }

        safeSet({
          loading: false,
          userId,
          tenantId,
          hasWhatsApp,
          email,
          planKey,
          betaPlan,
          betaStatus,
          betaEntitlementPlan,
          role,
          reason: null,
        });
      } catch {
        safeSet({ loading: false, reason: "error" });
        safePush("/login");
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, pathname, requireWhatsApp]);

  return state;
}