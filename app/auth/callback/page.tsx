"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    async function run() {
      try {
        // 0) If we already have a user session, go finish signup
        const { data: existingAuth } = await supabase.auth.getUser();
        if (existingAuth.user) {
          router.replace("/finish-signup");
          return;
        }

        // 1) Try PKCE code flow
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          router.replace("/finish-signup");
          return;
        }

        // 2) Try OTP verify flow
        const token_hash = searchParams.get("token_hash");
        const type = searchParams.get("type") as
          | "signup"
          | "invite"
          | "magiclink"
          | "recovery"
          | "email_change"
          | null;

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (error) throw error;
          router.replace("/finish-signup");
          return;
        }

        // 3) Nothing we can do
        setMsg("Missing callback parameters. Please log in.");
        router.replace("/login");
      } catch (e: any) {
        setMsg(`Callback error: ${e?.message ?? "Unknown error"}`);
        router.replace("/login");
      }
    }

    run();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-xl mx-auto px-6 py-20">
        <h1 className="text-2xl font-bold">ChiefOS</h1>
        <p className="mt-4 text-gray-600">{msg}</p>
      </div>
    </main>
  );
}
