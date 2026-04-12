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

        let who: Awaited<ReturnType<typeof fetchWhoami>>;
        try {
          who = await fetchWhoami();
        } catch {
          // Network or unexpected error — route to finish-signup to recover
          router.replace(`/finish-signup?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

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
        // Unexpected error before we confirmed workspace status — route to finish-signup
        // which handles workspace creation and will surface any real errors there.
        router.replace(`/finish-signup?returnTo=${encodeURIComponent(returnTo)}`);
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