"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

type OtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change";

function canonicalizeToAppDomain() {
  const targetBase = (process.env.NEXT_PUBLIC_APP_BASE_URL || "https://app.usechiefos.com").replace(/\/$/, "");
  try {
    const u = new URL(window.location.href);
    const targetHost = new URL(targetBase).host;

    if (u.host === targetHost) return false;

    if (u.host === "www.usechiefos.com" || u.host === "usechiefos.com") {
      const newUrl = `${targetBase}${u.pathname}${u.search}${u.hash}`;
      window.location.replace(newUrl);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function safeReturnTo(raw: string | null | undefined) {
  const s = String(raw || "").trim();
  if (!s) return "/app";
  if (!s.startsWith("/")) return "/app";
  if (s.startsWith("//")) return "/app";
  return s;
}

function AuthCallbackInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    async function run() {
      try {
        if (canonicalizeToAppDomain()) return;

        const returnTo = safeReturnTo(sp.get("returnTo"));

        const { data: existingAuth } = await supabase.auth.getUser();
        if (existingAuth.user) {
          router.replace(`/auth/transition?from=callback&returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        const url = new URL(window.location.href);
        const qs = url.searchParams;

        const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
        const hs = new URLSearchParams(hash);

        const access_token = hs.get("access_token");
        const refresh_token = hs.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;

          router.replace(`/auth/transition?from=callback&returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        const code = qs.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          router.replace(`/auth/transition?from=callback&returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        const token_hash = qs.get("token_hash");
        const type = qs.get("type") as OtpType | null;

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (error) throw error;

          router.replace(`/auth/transition?from=callback&returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }

        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      } catch {
        const returnTo = safeReturnTo(sp.get("returnTo"));
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      }
    }

    run();
  }, [router, sp]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackInner />
    </Suspense>
  );
}