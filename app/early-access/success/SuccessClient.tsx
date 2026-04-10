// app/early-access/success/SuccessClient.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";

function cleanPlan(x: string | null): "free" | "starter" | "pro" | null {
  const s = String(x || "").trim().toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return null;
}

export default function SuccessClient() {
  const sp = useSearchParams();

  const plan = useMemo(() => cleanPlan(sp.get("plan")), [sp]);
  const email = useMemo(() => (sp.get("email") || "").trim(), [sp]);
  const name = useMemo(() => (sp.get("name") || "").trim(), [sp]);
  const mode = useMemo(() => (sp.get("mode") || "").trim().toLowerCase(), [sp]);

  const signupHref = useMemo(() => {
    const qp = new URLSearchParams();
    if (plan) qp.set("plan", plan);
    if (email) qp.set("email", email);
    if (name) qp.set("name", name);
    if (mode) qp.set("mode", mode);
    const qs = qp.toString();
    return qs ? `/signup?${qs}` : "/signup";
  }, [plan, email, name, mode]);

  return (
    <main
      className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]"
      style={{ paddingTop: "var(--early-access-banner-h)" }}
    >
      <SiteHeader rightLabel="Log in" rightHref="/login" />

      <div className="max-w-xl mx-auto px-6 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-1 text-xs text-[#D4A853]">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Starter tester access
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#E8E2D8]">
          You’re almost in.
        </h1>

        <p className="mt-3 text-[#A8A090]">
          Create your owner account to continue with Starter tester access.
        </p>

        <div className="mt-6 rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-5">
          <div className="text-sm font-semibold text-[#E8E2D8]">Next step</div>
          <p className="mt-2 text-sm text-[#A8A090]">
            Create your owner account, then confirm your email to finish setup.
          </p>

          {email ? (
            <div className="mt-3 text-xs text-[#706A60]">
              We’ll prefill: <b className="text-[#A8A090]">{email}</b>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <a
              href={signupHref}
              className="inline-flex items-center justify-center rounded-[2px] bg-[#D4A853] px-5 py-3 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition"
            >
              Create owner account
            </a>

            <a
              href="/pricing"
              className="inline-flex items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-transparent px-5 py-3 text-sm font-semibold text-[#D4A853] hover:bg-[rgba(212,168,83,0.08)] transition"
            >
              Back to pricing
            </a>
          </div>

          <p className="mt-4 text-[12px] text-[#706A60]">
            After confirming your email, you’ll be signed in and your workspace will finish setting up.
          </p>
        </div>
      </div>
    </main>
  );
}