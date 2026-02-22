"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type GateState = {
  loading: boolean;
  userId: string | null;
  tenantId: string | null;
  hasWhatsApp: boolean;
  role?: string | null;
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

    // ✅ Prevent redirect ping-pong:
    // Do not redirect if we're already on the target page.
    function safePush(target: string) {
      if (!target) return;
      if (pathname === target) return;
      router.push(target);
    }

    async function run() {
      try {
        const res = await fetch("/api/whoami", {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (res.status === 401) {
          safeSet({ loading: false, reason: "no-auth" });
          safePush("/login");
          return;
        }

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          safeSet({ loading: false, reason: json?.reason || "error" });
          // If server says finish-signup, respect it
          if (json?.redirect) safePush(String(json.redirect));
          else safePush("/login");
          return;
        }

        const userId = String(json.userId || "");
        const tenantId = json.tenantId ? String(json.tenantId) : null;
        const hasWhatsApp = !!json.hasWhatsApp;
        const role = json.role ? String(json.role) : null;

        if (!tenantId) {
          safeSet({ loading: false, userId, tenantId: null, hasWhatsApp, role, reason: "no-tenant" });
          safePush("/finish-signup");
          return;
        }

        if (requireWhatsApp && !hasWhatsApp) {
          safeSet({ loading: false, userId, tenantId, hasWhatsApp: false, role, reason: "no-whatsapp" });
          safePush("/app/connect-whatsapp");
          return;
        }

        safeSet({
          loading: false,
          userId,
          tenantId,
          hasWhatsApp,
          role,
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