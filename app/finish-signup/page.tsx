// app/finish-signup/FinishSignupClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function FinishSignupClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const returnTo = useMemo(() => {
    const raw = sp.get("returnTo") || "";
    // internal-only safety
    if (!raw.startsWith("/")) return "/app/expenses";
    if (raw.startsWith("//")) return "/app/expenses";
    return raw;
  }, [sp]);

  const [status, setStatus] = useState("Finishing signup…");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setIsError(false);
        setStatus("Finishing signup…");

        // Session hydration retry
        let userId: string | null = null;
        for (let i = 0; i < 6; i++) {
          const { data, error } = await supabase.auth.getUser();
          if (!error && data?.user?.id) {
            userId = data.user.id;
            break;
          }
          await sleep(250);
        }

        if (!userId) {
          router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        const { data: existing, error: exErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (exErr) throw exErr;

        if (existing?.tenant_id) {
          router.replace(returnTo);
          return;
        }

        if (!cancelled) setStatus("Creating your workspace…");

        const companyName =
          (typeof window !== "undefined" ? localStorage.getItem("chiefos_company_name") : null) || null;

        const { error: rpcErr } = await supabase.rpc("chiefos_finish_signup", {
          company_name: companyName,
        });

        if (rpcErr) throw rpcErr;

        try {
          if (typeof window !== "undefined") localStorage.removeItem("chiefos_company_name");
        } catch {}

        if (!cancelled) setStatus("Done. Redirecting…");
        router.replace(returnTo);
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
  }, [router, returnTo]);

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
              href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
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