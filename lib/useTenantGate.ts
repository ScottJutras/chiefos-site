"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchWhoami } from "@/lib/whoami";
import { supabase } from "@/lib/supabase";

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
    let attempts = 0;

    function safeSet(next: Partial<GateState>) {
      if (cancelled) return;
      setState((s) => ({ ...s, ...next }));
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

    async function verifyWhatsAppLink(tenantId: string) {
      // tenant-scoped check (should be allowed by RLS)
      const { data, error } = await supabase
        .from("chiefos_identity_map")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("kind", "whatsapp")
        .limit(1);

      if (error) throw error;
      return Array.isArray(data) && data.length > 0;
    }

    async function run() {
      try {
        const w = await fetchWhoami();

        if (!w?.ok) {
          // hydration/login race (session cookie not ready yet)
          if (w?.error === "no-session-token") {
            safeSet({ loading: true, reason: "waiting-session" });

            attempts++;
            if (attempts > 6) {
              safeSet({ loading: false, reason: "no-session-token" });
              safePush("/login");
              return;
            }

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
        let hasWhatsApp = !!w.hasWhatsApp;

        if (!userId) {
          safeSet({ loading: false, reason: "no-auth" });
          safePush("/login");
          return;
        }

        if (!tenantId) {
          safeSet({ loading: false, userId, tenantId: null, hasWhatsApp, reason: "no-tenant" });
          safePush(withReturnTo("/finish-signup"));
          return;
        }

        // ✅ Self-heal mismatch:
        // If whoami says "not linked" but identity_map shows linked, trust identity_map.
        if (requireWhatsApp && !hasWhatsApp) {
          try {
            const linked = await verifyWhatsAppLink(tenantId);
            if (linked) {
              hasWhatsApp = true;
            }
          } catch {
            // ignore; we'll fall back to redirect below
          }
        }

        if (requireWhatsApp && !hasWhatsApp) {
          safeSet({ loading: false, userId, tenantId, hasWhatsApp: false, reason: "no-whatsapp" });
          safePush(withReturnTo("/app/connect-whatsapp"));
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