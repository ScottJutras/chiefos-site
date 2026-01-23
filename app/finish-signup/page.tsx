"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function FinishSignupPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Finishing signup…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // 1) Ensure logged in
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData.user;
        if (!user) {
          router.replace("/login");
          return;
        }

        // 2) If they already have a tenant, go to app
        const { data: existing, error: exErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (exErr) throw exErr;

        if (existing?.tenant_id) {
          router.replace("/app/expenses");
          return;
        }

        // 3) Call RPC to create tenant + attach to portal user
        if (!cancelled) setStatus("Creating your workspace…");

        const companyName =
          (typeof window !== "undefined"
            ? localStorage.getItem("chiefos_company_name")
            : null) || null;

        const { data: tenantId, error: rpcErr } = await supabase.rpc(
          "chiefos_finish_signup",
          { company_name: companyName }
        );

        if (rpcErr) throw rpcErr;

        // 4) Done → go to expenses (guard will send to connect-whatsapp if needed)
        if (!cancelled) setStatus("Done. Redirecting…");
        router.replace("/app/expenses");
      } catch (e: any) {
        const msg = e?.message || "Unknown error";
        if (!cancelled) setStatus(`Finish signup error: ${msg}`);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-xl mx-auto px-6 py-20">
        <h1 className="text-2xl font-bold">ChiefOS</h1>
        <p className="mt-4 text-gray-600">{status}</p>
      </div>
    </main>
  );
}
