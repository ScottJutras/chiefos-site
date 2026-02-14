// app/signup/SignupClient.tsx
"use client";

import { useState } from "react";
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

export default function SignupClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      await track("signup_submit", {
        hasCompanyName: Boolean(companyName.trim()),
      });

      const origin = window.location.origin;

      if (companyName.trim()) localStorage.setItem("chiefos_company_name", companyName.trim());
      else localStorage.removeItem("chiefos_company_name");

      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          turnstileToken,
          emailRedirectTo: `${origin}/auth/callback`,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Signup failed.");

      setSent(true);
      await track("signup_success", {});
    } catch (e: any) {
      setErr(e?.message ?? "Signup failed.");
      setTurnstileToken(null);
      await track("signup_error", { message: e?.message ?? "Signup failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
  className="min-h-screen bg-white text-gray-900"
  style={{ paddingTop: "var(--early-access-banner-h)" }}
>

      <SiteHeader rightLabel="Log in" rightHref="/login" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-black/70">
          <span className="h-2 w-2 rounded-full bg-black/50" />
          Owner account
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-gray-600">
          This creates the owner login for early access. Crew accounts are added later inside ChiefOS.
        </p>

        {sent ? (
          <div className="mt-8 rounded-2xl border bg-gray-50 p-4">
            <p className="font-medium">Check your email</p>
            <p className="mt-2 text-sm text-gray-600">
              We sent you a confirmation link. Click it to finish creating your account.
            </p>
            <p className="mt-4 text-sm text-gray-600">
              Already confirmed?{" "}
              <a className="underline" href="/login">
                Log in
              </a>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium">Company name</label>
              <input
                className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Mission Exteriors (or your company)"
                autoComplete="organization"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
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
                autoComplete="new-password"
              />
              <p className="mt-2 text-xs text-gray-500">
                Use a strong password. You’ll be storing job-level records and receipts.
              </p>
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
              {loading ? "Sending link..." : "Sign up"}
            </button>

            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <a className="underline" href="/login">
                Log in
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
