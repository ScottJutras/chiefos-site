// app/auth/callback/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type OtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change";

function canonicalizeToAppDomain() {
  const targetBase = (process.env.NEXT_PUBLIC_APP_BASE_URL || "https://app.usechiefos.com").replace(/\/$/, "");
  try {
    const u = new URL(window.location.href);
    const targetHost = new URL(targetBase).host;

    // If already on target host, do nothing
    if (u.host === targetHost) return false;

    // Only rewrite if it's your www/root host (avoid breaking preview domains)
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

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    async function run() {
      try {
        // ✅ Ensure callback resolves on canonical app domain
        if (canonicalizeToAppDomain()) return;

        // 0) If we already have a session, go finish signup
        const { data: existingAuth } = await supabase.auth.getUser();
        if (existingAuth.user) {
          router.replace("/finish-signup");
          return;
        }

        const url = new URL(window.location.href);
        const qs = url.searchParams;

        // Hash-based session redirects:
        const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
        const hs = new URLSearchParams(hash);

        const access_token = hs.get("access_token");
        const refresh_token = hs.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;

          router.replace("/finish-signup");
          return;
        }

        // PKCE code flow:
        const code = qs.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          router.replace("/finish-signup");
          return;
        }

        // OTP verify flow:
        const token_hash = qs.get("token_hash");
        const type = qs.get("type") as OtpType | null;

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (error) throw error;

          router.replace("/finish-signup");
          return;
        }

        setMsg("Missing callback parameters. Please log in.");
        router.replace("/login");
      } catch (e: any) {
        setMsg(`Callback error: ${e?.message ?? "Unknown error"}`);
        router.replace("/login");
      }
    }

    run();
  }, [router]);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-xl mx-auto px-6 py-20">
        <h1 className="text-2xl font-bold">ChiefOS</h1>
        <p className="mt-4 text-gray-600">{msg}</p>
      </div>
    </main>
  );
}