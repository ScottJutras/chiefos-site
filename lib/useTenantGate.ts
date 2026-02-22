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

// NOTE: We intentionally support a fallback path:
// - primary: chiefos_portal_users (portal membership)
// - fallback: chiefos_user_identities (whatsapp identity mapping)
// This prevents the portal from bricking during migration / partial onboarding.

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

    function safeSet(next: Partial<GateState>) {
      if (cancelled) return;
      setState((s) => ({ ...s, ...next }));
    }

    async function resolveTenantId(userId: string): Promise<string | null> {
      // 1) Preferred: portal membership table
      const { data: pu, error: puErr } = await supabase
        .from("chiefos_portal_users")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!puErr && pu?.tenant_id) return String(pu.tenant_id);

      // 2) Fallback: identity table (your SQL shows this exists)
      // Uses: public.chiefos_user_identities (tenant_id, user_id, kind, identifier)
      const { data: idRows, error: idErr } = await supabase
        .from("chiefos_user_identities")
        .select("tenant_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (idErr) return null;
      const tenantId = idRows?.[0]?.tenant_id ?? null;
      return tenantId ? String(tenantId) : null;
    }

    async function checkWhatsApp(tenantId: string): Promise<boolean> {
      // You used chiefos_identity_map in the old code.
      // Your actual table (from your SQL) is chiefos_user_identities.
      // We'll check both safely.

      // A) preferred: chiefos_user_identities(kind='whatsapp')
      const { data: wRows, error: wErr } = await supabase
        .from("chiefos_user_identities")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("kind", "whatsapp")
        .limit(1);

      if (!wErr && wRows && wRows.length > 0) return true;

      // B) fallback (if you still have this older view/table)
      const { data: mapRows, error: mapErr } = await supabase
        .from("chiefos_identity_map")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("kind", "whatsapp")
        .limit(1);

      if (!mapErr && mapRows && mapRows.length > 0) return true;

      return false;
    }

    async function run() {
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        if (!auth.user) {
          safeSet({ loading: false, reason: "no-auth" });
          router.push("/login");
          return;
        }

        const userId = auth.user.id;

        const tenantId = await resolveTenantId(userId);
        if (!tenantId) {
          safeSet({ loading: false, userId, tenantId: null, reason: "no-tenant" });
          router.push("/finish-signup");
          return;
        }

        let hasWhatsApp = false;
        if (requireWhatsApp) {
          hasWhatsApp = await checkWhatsApp(tenantId);
          if (!hasWhatsApp) {
            safeSet({ loading: false, userId, tenantId, hasWhatsApp: false, reason: "no-whatsapp" });
            router.push("/app/connect-whatsapp");
            return;
          }
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