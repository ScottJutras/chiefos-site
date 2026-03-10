"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import AuthProgressShell from "@/app/components/AuthProgressShell";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type StepKey =
  | "verify-account"
  | "resolve-workspace"
  | "create-workspace"
  | "record-agreement"
  | "activate-access"
  | "done";

function clearSignupBootstrapState() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("chiefos_company_name");
  localStorage.removeItem("chiefos_signup_mode");
  localStorage.removeItem("chiefos_requested_plan_key");

  localStorage.removeItem("chiefos_terms_accepted");
  localStorage.removeItem("chiefos_terms_accepted_at");
  localStorage.removeItem("chiefos_privacy_accepted_at");
  localStorage.removeItem("chiefos_ai_policy_accepted_at");
  localStorage.removeItem("chiefos_dpa_acknowledged_at");

  localStorage.removeItem("chiefos_terms_version");
  localStorage.removeItem("chiefos_privacy_version");
  localStorage.removeItem("chiefos_ai_policy_version");
  localStorage.removeItem("chiefos_dpa_version");
}

export default function FinishSignupClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const returnTo = useMemo(() => {
    const raw = sp.get("returnTo") || "";
    if (!raw.startsWith("/")) return "/app";
    if (raw.startsWith("//")) return "/app";
    return raw;
  }, [sp]);

  const [status, setStatus] = useState("Verifying your account…");
  const [activeStep, setActiveStep] = useState<StepKey>("verify-account");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function maybeWriteLegalAcceptance(signupMode: string | null) {
      const accepted =
        (typeof window !== "undefined" ? localStorage.getItem("chiefos_terms_accepted") : null) || null;

      if (accepted !== "true") return;

      const termsAcceptedAt =
        (typeof window !== "undefined" ? localStorage.getItem("chiefos_terms_accepted_at") : null) || null;

      const privacyAcceptedAt =
        (typeof window !== "undefined" ? localStorage.getItem("chiefos_privacy_accepted_at") : null) || null;

      const aiPolicyAcceptedAt =
        (typeof window !== "undefined" ? localStorage.getItem("chiefos_ai_policy_accepted_at") : null) || null;

      const dpaAcknowledgedAt =
        (typeof window !== "undefined" ? localStorage.getItem("chiefos_dpa_acknowledged_at") : null) || null;

      const termsVersion =
        (typeof window !== "undefined" ? localStorage.getItem("chiefos_terms_version") : null) || null;

      const privacyVersion =
        (typeof window !== "undefined" ? localStorage.getItem("chiefos_privacy_version") : null) || null;

      const aiPolicyVersion =
        (typeof window !== "undefined" ? localStorage.getItem("chiefos_ai_policy_version") : null) || null;

      const dpaVersion =
        (typeof window !== "undefined" ? localStorage.getItem("chiefos_dpa_version") : null) || null;

      if (
        !termsAcceptedAt ||
        !privacyAcceptedAt ||
        !aiPolicyAcceptedAt ||
        !dpaAcknowledgedAt ||
        !termsVersion ||
        !privacyVersion ||
        !aiPolicyVersion ||
        !dpaVersion
      ) {
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) return;

      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          termsAcceptedAt,
          privacyAcceptedAt,
          aiPolicyAcceptedAt,
          dpaAcknowledgedAt,
          termsVersion,
          privacyVersion,
          aiPolicyVersion,
          dpaVersion,
          acceptedVia: signupMode === "tester" ? "tester_signup" : "signup",
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || "Failed to record legal acceptance.");
      }
    }

    async function maybeActivateTester(signupMode: string | null) {
      if (signupMode !== "tester") return;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;

      if (!accessToken) return;

      const activateRes = await fetch("/api/tester-access/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });

      const activateJson = await activateRes.json().catch(() => ({}));

      if (!activateRes.ok) {
        throw new Error(activateJson?.error || "Tester activation failed.");
      }

      if (typeof window !== "undefined" && activateJson?.plan) {
        localStorage.setItem("chiefos_selected_plan", String(activateJson.plan));
      }
    }

    async function run() {
      try {
        setIsError(false);
        setActiveStep("verify-account");
        setStatus("Verifying your account…");

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

        const signupMode =
          (typeof window !== "undefined" ? localStorage.getItem("chiefos_signup_mode") : null) || null;

        setActiveStep("resolve-workspace");
        setStatus("Resolving your workspace…");

        const { data: existing, error: exErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (exErr) throw exErr;

        if (existing?.tenant_id) {
          setActiveStep("record-agreement");
          setStatus("Recording your agreement…");
          await maybeWriteLegalAcceptance(signupMode);

          setActiveStep("activate-access");
          setStatus(signupMode === "tester" ? "Activating tester access…" : "Preparing ChiefOS…");
          await maybeActivateTester(signupMode);

          clearSignupBootstrapState();

          if (!cancelled) {
            setActiveStep("done");
            setStatus("Taking you in…");
            window.setTimeout(() => {
              if (!cancelled) router.replace(returnTo);
            }, 350);
          }
          return;
        }

        setActiveStep("create-workspace");
        setStatus("Creating your workspace…");

        const companyName =
          (typeof window !== "undefined" ? localStorage.getItem("chiefos_company_name") : null) || null;

        const { error: rpcErr } = await supabase.rpc("chiefos_finish_signup", {
          company_name: companyName,
        });

        if (rpcErr) throw rpcErr;

        setActiveStep("record-agreement");
        setStatus("Recording your agreement…");
        await maybeWriteLegalAcceptance(signupMode);

        setActiveStep("activate-access");
        setStatus(signupMode === "tester" ? "Activating tester access…" : "Preparing ChiefOS…");
        await maybeActivateTester(signupMode);

        clearSignupBootstrapState();

        if (!cancelled) {
          setActiveStep("done");
          setStatus("Taking you in…");
          window.setTimeout(() => {
            if (!cancelled) router.replace(returnTo);
          }, 350);
        }
      } catch (e: any) {
        const msg = e?.message || "Unknown error";
        if (!cancelled) {
          setIsError(true);
          setStatus(`We couldn’t finish setting up your workspace. ${msg}`);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router, returnTo]);

  return (
    <AuthProgressShell
      eyebrow="Workspace setup"
      title={isError ? "We hit a snag" : "Getting ChiefOS ready"}
      status={status}
      activeStepKey={activeStep}
      isError={isError}
      steps={[
        {
          key: "verify-account",
          label: "Verify account",
          description: "Confirm the signed-in user before continuing.",
        },
        {
          key: "resolve-workspace",
          label: "Resolve workspace",
          description: "Check whether a workspace already exists for this account.",
        },
        {
          key: "create-workspace",
          label: "Create workspace",
          description: "Create the workspace safely if it does not exist yet.",
        },
        {
          key: "record-agreement",
          label: "Record agreement",
          description: "Store the accepted legal versions for this workspace.",
        },
        {
          key: "activate-access",
          label: "Activate access",
          description: "Apply tester access when required and prepare the app.",
        },
      ]}
      errorActions={
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
          >
            Back to login
          </a>
          <a
            href="/signup"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Create account again
          </a>
        </div>
      }
    />
  );
}