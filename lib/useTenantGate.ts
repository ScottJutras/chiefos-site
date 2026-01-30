"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type GateState = {
  loading: boolean;
  userId: string | null;
  tenantId: string | null;
  hasWhatsApp: boolean;
};

export function useTenantGate(opts?: { requireWhatsApp?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({
    loading: true,
    userId: null,
    tenantId: null,
    hasWhatsApp: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        if (!auth.user) {
          router.push("/login");
          return;
        }

        const userId = auth.user.id;

        const { data: pu, error: puErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (puErr) throw puErr;

        if (!pu?.tenant_id) {
          router.push("/finish-signup");
          return;
        }

        let hasWhatsApp = false;

        if (opts?.requireWhatsApp) {
          const { data: mapRows, error: mapErr } = await supabase
            .from("chiefos_identity_map")
            .select("id")
            .eq("tenant_id", pu.tenant_id)
            .eq("kind", "whatsapp")
            .limit(1);

          if (mapErr) throw mapErr;
          hasWhatsApp = !!(mapRows && mapRows.length > 0);

          if (!hasWhatsApp) {
            router.push("/app/connect-whatsapp");
            return;
          }
        }

        if (!cancelled) {
          setState({ loading: false, userId, tenantId: pu.tenant_id, hasWhatsApp });
        }
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
        router.push("/login");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, opts?.requireWhatsApp]);

  return state;
}
