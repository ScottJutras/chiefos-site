"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function FinishSignupPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Finishing signup…");

  useEffect(() => {
    async function run() {
      // 1) Ensure logged in
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        setStatus(`Auth error: ${authErr.message}`);
        return;
      }

      const user = authData.user;
      if (!user) {
        router.push("/login");
        return;
      }

      // 2) If they already have a portal row, done
      const { data: existing, error: exErr } = await supabase
        .from("chiefos_portal_users")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (exErr) {
        setStatus(`Error: ${exErr.message}`);
        return;
      }

      if (existing?.tenant_id) {
        router.push("/app/expenses");
        return;
      }

      // 3) Create tenant
      setStatus("Creating your tenant…");
      const companyName =
        (typeof window !== "undefined"
          ? localStorage.getItem("chiefos_company_name")
          : null) || "My Business";

      const { data: tenant, error: tErr } = await supabase
        .from("chiefos_tenants")
        .insert({ name: companyName })
        .select("id")
        .single();

      if (tErr) {
        setStatus(`Tenant error: ${tErr.message}`);
        return;
      }

      // 4) Create portal user mapping as owner
      setStatus("Creating your owner profile…");
      const { error: puErr } = await supabase.from("chiefos_portal_users").insert({
        user_id: user.id,
        tenant_id: tenant.id,
        role: "owner",
      });

      if (puErr) {
        setStatus(`Portal user error: ${puErr.message}`);
        return;
      }

      router.push("/app/expenses");
    }

    run();
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
