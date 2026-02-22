"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";

type GateState = {
  loading: boolean;
  userId: string | null;
  tenantId: string | null;
  hasWhatsApp: boolean;
  reason?: string | null;
};

export function useTenantGate(opts?: { requireWhatsApp?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const requireWhatsApp = !!opts?.requireWhatsApp;

  const redirectedRef = useRef<string | null>(null); // prevents bounce loops
  const inFlightRef = useRef(false);

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

    const safePush = (to: string) => {
      // ✅ Don’t push to the page you’re already on
      if (pathname === to) return;

      // ✅ Don’t push the same redirect repeatedly (loop breaker)
      if (redirectedRef.current === to) return;
      redirectedRef.current = to;

      router.push(to);
    };

    async function run() {
      if (inFlightRef.current) return; // avoid double-run races
      inFlightRef.current = true;

      try {
        // ✅ Wait for session (don’t redirect prematurely during hydration)
        const { data: s } = await supabase.auth.getSession();
        const token = s?.session?.access_token || null;

        if (!token) {
          safeSet({ loading: false, reason: "no-session" });
          safePush("/login");
          return;
        }

        const r = await fetch("/api/whoami", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
          const msg = String(j?.error || "gate-failed");
          safeSet({ loading: false, reason: msg });

          // ✅ IMPORTANT: if we’re already on finish-signup, DON’T keep pushing.
          if (r.status === 401) safePush("/login");
          else safePush("/finish-signup");
          return;
        }

        const userId = j?.userId ? String(j.userId) : "";
        const tenantId = j?.tenantId ? String(j.tenantId) : "";
        const hasWhatsApp = !!j?.hasWhatsApp;

        if (!userId || !tenantId) {
          safeSet({ loading: false, reason: "missing-identity" });
          safePush("/finish-signup");
          return;
        }

        if (requireWhatsApp && !hasWhatsApp) {
          safeSet({
            loading: false,
            userId,
            tenantId,
            hasWhatsApp: false,
            reason: "no-whatsapp",
          });
          safePush("/app/connect-whatsapp");
          return;
        }

        // ✅ Success: clear redirect lock so future navigations are allowed
        redirectedRef.current = null;

        safeSet({ loading: false, userId, tenantId, hasWhatsApp, reason: null });
      } catch (e: any) {
        safeSet({ loading: false, reason: e?.message || "error" });

        // ✅ Don’t bounce: only send to login if not already on a “setup” page
        if (!pathname.startsWith("/finish-signup")) safePush("/login");
      } finally {
        inFlightRef.current = false;
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, requireWhatsApp]);

  return state;
}