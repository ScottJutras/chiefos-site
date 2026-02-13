// app/finish-signup/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";

export default function FinishSignupPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Finishing signup…");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setIsError(false);

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData.user;
        if (!user) {
          router.replace("/login");
          return;
        }

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

        if (!cancelled) setStatus("Creating your workspace…");

        const companyName =
          (typeof window !== "undefined" ? localStorage.getItem("chiefos_company_name") : null) || null;

        const { error: rpcErr } = await supabase.rpc("chiefos_finish_signup", {
          company_name: companyName,
        });

        if (rpcErr) throw rpcErr;

        if (!cancelled) setStatus("Done. Redirecting…");
        router.replace("/app/expenses");
      } catch (e: any) {
        const msg = e?.message || "Unknown error";
        if (!cancelled) {
          setIsError(true);
          setStatus(`Couldn’t finish signup: ${msg}`);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <SiteHeader rightLabel="Log in" rightHref="/login" />

      <div className="max-w-xl mx-auto px-6 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-black/70">
          <span className={["h-2 w-2 rounded-full", isError ? "bg-red-600/70" : "bg-black/50"].join(" ")} />
          Workspace setup
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">Finishing signup</h1>
        <p className="mt-3 text-gray-600">{status}</p>

        {isError && (
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-900 transition"
            >
              Back to login
            </a>
            <a
              href="/signup"
              className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-black/[0.03] transition"
            >
              Create account again
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
