// app/login/LoginClient.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import SiteHeader from "@/app/components/SiteHeader";

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
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      await track("login_submit", { hasEmail: Boolean(email.trim()) });

      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Login failed.");

      const { error: setErr2 } = await supabase.auth.setSession({
        access_token: j.session.access_token,
        refresh_token: j.session.refresh_token,
      });
      if (setErr2) throw setErr2;

      await track("login_success", {});
      router.push("/app");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed.");
      setTurnstileToken(null);
      await track("login_error", { message: e?.message ?? "Login failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
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
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              options={{ appearance: "always" }}
            />
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
