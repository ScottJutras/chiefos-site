"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";

export default function LoginPage() {
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

      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Login failed.");

      // Set Supabase session client-side
      const { error: setErr2 } = await supabase.auth.setSession({
        access_token: j.session.access_token,
        refresh_token: j.session.refresh_token,
      });
      if (setErr2) throw setErr2;

      router.push("/app/expenses");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed.");
      setTurnstileToken(null); // force re-check on failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-md mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold">Log in</h1>
        <p className="mt-2 text-gray-600">Early access portal.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
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
            className="w-full rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-gray-800 disabled:opacity-60"
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
