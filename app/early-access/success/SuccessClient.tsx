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

  const signupHref = useMemo(() => {
    const qp = new URLSearchParams();
    if (plan) qp.set("plan", plan);
    if (email) qp.set("email", email);
    if (name) qp.set("name", name);
    const qs = qp.toString();
    return qs ? `/signup?${qs}` : "/signup";
  }, [plan, email, name]);

  return (
    <main className="min-h-screen bg-white text-gray-900" style={{ paddingTop: "var(--early-access-banner-h)" }}>
      <SiteHeader rightLabel="Create account" rightHref={signupHref} />

      <div className="max-w-xl mx-auto px-6 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-black/70">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Request received
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">You’re in the queue.</h1>

        <p className="mt-3 text-gray-700">
          We received your early access request{plan ? (
            <>
              {" "}
              for <b>{plan.toUpperCase()}</b>
            </>
          ) : null}
          .
        </p>

        <div className="mt-6 rounded-2xl border border-black/10 bg-gray-50 p-5">
          <div className="text-sm font-semibold">Next step</div>
          <p className="mt-2 text-sm text-gray-700">
            Create your <b>owner account</b> so we can attach approval to the right login.
          </p>

          {email ? (
            <div className="mt-3 text-xs text-gray-600">
              We’ll prefill: <b>{email}</b>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <a
              href={signupHref}
              className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-900 transition"
            >
              Create owner account
            </a>

            <a
              href="/pricing"
              className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-black/[0.03] transition"
            >
              Back to pricing
            </a>
          </div>

          <p className="mt-4 text-[12px] text-gray-600">
            After you create your account, check your email to confirm, then log in.
          </p>
        </div>
      </div>
    </main>
  );
}