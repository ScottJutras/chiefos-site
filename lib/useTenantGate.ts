"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type GateState = {
  loading: boolean;
  userId: string | null;
  tenantId: string | null;
  hasWhatsApp: boolean;
  reason?: string | null;
};

export function useTenantGate(opts?: { requireWhatsApp?: boolean }) {
  const router = useRouter();
  const requireWhatsApp = !!opts?.requireWhatsApp;

  const [state, setState] = useState<GateState>({
    loading: true,
    userId: null,
    tenantId: null,
    hasWhatsApp: false,
    reason: null,
  });

  useEffect(() => {
    let cancelled = false;
    const safeSet = (next: Partial<GateState>) => {
      if (cancelled) return;
      setState((s) => ({ ...s, ...next }));
    };

    async function run() {
      try {
        const { data: s } = await supabase.auth.getSession();
        const token = s?.session?.access_token || null;

        if (!token) {
          safeSet({ loading: false, reason: "no-session" });
          router.push("/login");
          return;
        }

        const r = await fetch("/api/whoami", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          safeSet({ loading: false, reason: j?.error || "gate-failed" });
          router.push(r.status === 401 ? "/login" : "/finish-signup");
          return;
        }

        const userId = String(j?.userId || "");
        const tenantId = String(j?.tenantId || "");
        const hasWhatsApp = !!j?.hasWhatsApp;

        if (!userId || !tenantId) {
          safeSet({ loading: false, reason: "missing-identity" });
          router.push("/finish-signup");
          return;
        }

        if (requireWhatsApp && !hasWhatsApp) {
          safeSet({ loading: false, userId, tenantId, hasWhatsApp: false, reason: "no-whatsapp" });
          router.push("/app/connect-whatsapp");
          return;
        }

        safeSet({ loading: false, userId, tenantId, hasWhatsApp, reason: null });
      } catch {
        safeSet({ loading: false, reason: "error" });
        router.push("/login");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, requireWhatsApp]);

  return state;
}