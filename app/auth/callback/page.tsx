"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type OtpType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    async function run() {
      try {
        // 0) If we already have a session, go finish signup
        const { data: existingAuth } = await supabase.auth.getUser();
        if (existingAuth.user) {
          router.replace("/finish-signup");
          return;
        }

        // 1) Read URL params directly (avoids useSearchParams + Suspense requirement)
        const url = new URL(window.location.href);
        const qs = url.searchParams;

        // 2) Handle hash-based session redirects:
        // /auth/callback#access_token=...&refresh_token=...&type=signup
        const hash = window.location.hash?.startsWith("#")
          ? window.location.hash.slice(1)
          : "";
        const hs = new URLSearchParams(hash);

        const access_token = hs.get("access_token");
        const refresh_token = hs.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          router.replace("/finish-signup");
          return;
        }

        // 3) Handle PKCE code flow:
        // /auth/callback?code=...
        const code = qs.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          router.replace("/finish-signup");
          return;
        }

        // 4) Handle OTP verify flow:
        // /auth/callback?token_hash=...&type=signup
        const token_hash = qs.get("token_hash");
        const type = qs.get("type") as OtpType | null;

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (error) throw error;

          router.replace("/finish-signup");
          return;
        }

        // 5) Nothing we can do
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
