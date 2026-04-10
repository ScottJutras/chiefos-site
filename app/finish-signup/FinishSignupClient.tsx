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
  | "load-signup"
  | "resolve-workspace"
  | "create-workspace"
  | "record-agreement"
  | "activate-access"
  | "done";

type PendingSignup = {
  id: string;
  email: string;
  company_name: string | null;
  country: string | null;
  province: string | null;
  signup_mode: string | null;
  requested_plan_key: string | null;

  terms_accepted_at: string | null;
  terms_version: string | null;

  privacy_accepted_at: string | null;
  privacy_version: string | null;

  ai_policy_accepted_at: string | null;
  ai_policy_version: string | null;

  dpa_acknowledged_at: string | null;
  dpa_version: string | null;

  accepted_via: string | null;
};

export default function FinishSignupClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const returnTo = useMemo(() => {
    const raw = sp.get("returnTo") || "";
    // New signups (no explicit returnTo) go to welcome onboarding
    if (!raw.startsWith("/")) return "/app/welcome";
    if (raw.startsWith("//")) return "/app/welcome";
    return raw;
  }, [sp]);

  const [status, setStatus] = useState("Verifying your account…");
  const [activeStep, setActiveStep] = useState<StepKey>("verify-account");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function getPendingSignup(): Promise<PendingSignup | null> {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) return null;

      const res = await fetch("/api/auth/pending-signup", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load pending signup.");
      return j?.pendingSignup || null;
    }

    async function consumePendingSignup() {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) return;

      const res = await fetch("/api/auth/pending-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: "consume" }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to consume pending signup.");
    }

    async function writeLegalAcceptance(pending: PendingSignup | null) {
      if (!pending) return;

      if (
        !pending.terms_accepted_at ||
        !pending.privacy_accepted_at ||
        !pending.ai_policy_accepted_at ||
        !pending.dpa_acknowledged_at ||
        !pending.terms_version ||
        !pending.privacy_version ||
        !pending.ai_policy_version ||
        !pending.dpa_version
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
          termsAcceptedAt: pending.terms_accepted_at,
          privacyAcceptedAt: pending.privacy_accepted_at,
          aiPolicyAcceptedAt: pending.ai_policy_accepted_at,
          dpaAcknowledgedAt: pending.dpa_acknowledged_at,
          termsVersion: pending.terms_version,
          privacyVersion: pending.privacy_version,
          aiPolicyVersion: pending.ai_policy_version,
          dpaVersion: pending.dpa_version,
          acceptedVia: pending.accepted_via || (pending.signup_mode === "tester" ? "tester_signup" : "signup"),
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || "Failed to record legal acceptance.");
      }
    }

    async function setTenantMeta() {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;
      if (!accessToken) return;

      await fetch("/api/auth/pending-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: "set-tenant-meta" }),
      });
      // Non-fatal: if this fails we continue anyway
    }

    async function maybeActivateTester(pending: PendingSignup | null) {
      if (!pending || pending.signup_mode !== "tester") return;

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

        setActiveStep("load-signup");
        setStatus("Loading your signup details…");
        const pending = await getPendingSignup();

        setActiveStep("resolve-workspace");
        setStatus("Resolving your workspace…");

        const { data: existing, error: exErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (exErr) throw exErr;

        if (!existing?.tenant_id) {
          setActiveStep("create-workspace");
          setStatus("Creating your workspace…");

          const { error: rpcErr } = await supabase.rpc("chiefos_finish_signup", {
            company_name: pending?.company_name || null,
          });

          if (rpcErr) throw rpcErr;

          // Push country + province to the newly created tenant (non-fatal)
          await setTenantMeta();
        }

        setActiveStep("record-agreement");
        setStatus("Recording your agreement…");
        await writeLegalAcceptance(pending);

        setActiveStep("activate-access");
        setStatus(pending?.signup_mode === "tester" ? "Activating tester access…" : "Preparing ChiefOS…");
        await maybeActivateTester(pending);

        await consumePendingSignup();

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
          key: "load-signup",
          label: "Load signup details",
          description: "Recover your setup details even if you confirmed on another device.",
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