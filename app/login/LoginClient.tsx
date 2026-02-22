// app/login/LoginClient.tsx
"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import SiteHeader from "@/app/components/SiteHeader";
import { normalizeAuthMessage } from "@/lib/authErrors";

async function track(event: string, payload: Record<string, any> = {}) {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
    });
  } catch {
    // never block UX
  }
}

export default function LoginClient() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  // keep options stable to avoid re-render loops
  const turnstileOptions = useMemo(() => {
    return { appearance: "always" as const };
  }, []);

  function resetTurnstile() {
    setTurnstileToken(null);
    setTurnstileKey((k) => k + 1);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!siteKey) throw new Error("Bot check is not configured.");
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      await track("login_submit", {});

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Some email-confirm setups can produce no session yet.
      if (!data?.session) {
        setErr("Verify your email. Click the link we sent, then sign in again.");
        return;
      }

      await track("login_success", {});
      router.push("/app");
    } catch (e: any) {
      const friendly = normalizeAuthMessage(e);
      const msg = String(friendly || e?.message || "").trim();

      setErr(msg || "Something went wrong.");

      // Only reset Turnstile on actual bot/token failures
      const lower = msg.toLowerCase();
      const looksLikeBot =
        lower.includes("bot") ||
        lower.includes("turnstile") ||
        lower.includes("captcha") ||
        lower.includes("complete the check");

      if (looksLikeBot) resetTurnstile();

      await track("login_error", { message: msg || "login failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-white text-gray-900"
      style={{ paddingTop: "var(--early-access-banner-h)" }}
    >
      <SiteHeader rightLabel="Create account" rightHref="/signup" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-black/70">
          <span className="h-2 w-2 rounded-full bg-black/50" />
          Early access portal
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">Log in</h1>
        <p className="mt-2 text-gray-600">
          Private, secure access for owners. If you don’t have an account yet, create one.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="pt-2">
            {!siteKey ? (
              <div className="text-xs text-red-700">
                Turnstile misconfigured: missing NEXT_PUBLIC_TURNSTILE_SITE_KEY
              </div>
            ) : (
              <Turnstile
                key={turnstileKey}
                siteKey={siteKey}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => resetTurnstile()}
                onError={() => resetTurnstile()}
                options={turnstileOptions}
              />
            )}
          </div>

          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            className="w-full rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-gray-900 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Signing in..." : "Log in"}
          </button>

          <p className="text-sm text-gray-600">
            New here?{" "}
            <a className="underline" href="/signup">
              Create an account
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}