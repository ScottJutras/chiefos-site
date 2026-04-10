"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthProgressShell from "@/app/components/AuthProgressShell";
import { fetchWhoami } from "@/lib/whoami";

type StepKey =
  | "verify-account"
  | "resolve-workspace"
  | "secure-tenant"
  | "prepare-chiefos"
  | "done";

function safeReturnTo(raw: string | null | undefined) {
  const s = String(raw || "").trim();
  if (!s) return "/app";
  if (!s.startsWith("/")) return "/app";
  if (s.startsWith("//")) return "/app";
  return s;
}

function AuthTransitionInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const returnTo = useMemo(() => safeReturnTo(sp.get("returnTo")), [sp]);
  const from = useMemo(() => String(sp.get("from") || "").trim().toLowerCase(), [sp]);

  const [status, setStatus] = useState("Verifying your account…");
  const [activeStep, setActiveStep] = useState<StepKey>("verify-account");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setIsError(false);
        setActiveStep("verify-account");
        setStatus(from === "callback" ? "Verifying your confirmation link…" : "Verifying your account…");

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token || "";

        if (!accessToken) {
          router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        if (cancelled) return;

        setActiveStep("resolve-workspace");
        setStatus("Resolving your workspace…");

        const who = await fetchWhoami();

        if (!who?.ok) {
          if (who?.error === "no-session-token") {
            router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
            return;
          }

          router.replace(`/finish-signup?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        if (cancelled) return;

        setActiveStep("secure-tenant");
        setStatus("Securing tenant context…");

        if (!who.userId) {
          router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        if (!who.tenantId) {
          router.replace(`/finish-signup?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        if (cancelled) return;

        setActiveStep("prepare-chiefos");
        setStatus("Preparing ChiefOS…");

        window.setTimeout(() => {
          if (cancelled) return;
          setActiveStep("done");
          setStatus("Taking you in…");
          router.replace(returnTo || "/app");
        }, 450);
      } catch {
        if (cancelled) return;
        setIsError(true);
        setActiveStep("resolve-workspace");
        setStatus("We couldn’t finish the sign-in handoff.");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router, returnTo, from]);

  return (
    <AuthProgressShell
      eyebrow="Secure sign-in"
      title="Getting ChiefOS ready"
      status={status}
      activeStepKey={activeStep}
      isError={isError}
      steps={[
        {
          key: "verify-account",
          label: "Verify account",
          description: "Confirm your session before entering the app.",
        },
        {
          key: "resolve-workspace",
          label: "Resolve workspace",
          description: "Find the correct workspace for this user.",
        },
        {
          key: "secure-tenant",
          label: "Secure tenant context",
          description: "Preserve the correct tenant boundary before loading.",
        },
        {
          key: "prepare-chiefos",
          label: "Prepare ChiefOS",
          description: "Load the operating center for this session.",
        },
      ]}
      errorActions={
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex items-center justify-center rounded-[2px] bg-[#D4A853] px-5 py-3 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition"
          >
            Back to login
          </a>
          <a
            href="/signup"
            className="inline-flex items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] px-5 py-3 text-sm font-semibold text-[#A8A090] hover:text-[#D4A853] hover:border-[rgba(212,168,83,0.5)] transition"
          >
            Create account again
          </a>
        </div>
      }
    />
  );
}

export default function AuthTransitionPage() {
  return (
    <Suspense fallback={null}>
      <AuthTransitionInner />
    </Suspense>
  );
}