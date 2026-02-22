// app/signup/SignupClient.tsx
"use client";

import { useState } from "react";
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
  } catch {}
}

function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    // eye-off
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
      <path d="M9.88 5.47A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a17.4 17.4 0 0 1-4.27 5.01" />
      <path d="M6.61 6.61A17.4 17.4 0 0 0 2 12s3 7 10 7a10.8 10.8 0 0 0 4.12-.8" />
    </svg>
  ) : (
    // eye
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
export default function SignupClient() {
  const router = useRouter();

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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

      await track("signup_submit", { hasCompanyName: Boolean(companyName.trim()) });

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

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Signup failed.");

      setSent(true);
      await track("signup_success", {});
    } catch (e: any) {
      const friendly = normalizeAuthMessage(e);
      const message = friendly || e?.message || "Signup failed.";

      setErr(message);
      await track("signup_error", { message });

      // Only reset Turnstile for bot-ish failures
      const msg = String(message).toLowerCase();
      const looksLikeBot =
        msg.includes("bot") ||
        msg.includes("turnstile") ||
        msg.includes("captcha") ||
        msg.includes("complete the check");

      if (looksLikeBot) resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900" style={{ paddingTop: "var(--early-access-banner-h)" }}>
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

              <div className="relative mt-1">
                <input
                  className="w-full rounded-md border border-black/10 bg-white px-3 py-2 pr-11 outline-none focus:ring-2 focus:ring-black/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-black/60 hover:text-black hover:bg-black/5 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeIcon off /> : <EyeIcon />}
                </button>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                Use a strong password. You’ll be storing job-level records and receipts.
              </p>
            </div>

            <div className="pt-2">
              {!siteKey ? (
                <div className="text-xs text-red-600">Turnstile misconfigured: missing NEXT_PUBLIC_TURNSTILE_SITE_KEY</div>
              ) : (
                <Turnstile
                  key={turnstileKey}
                  siteKey={siteKey}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => resetTurnstile()}
                  onError={() => resetTurnstile()}
                  options={{ appearance: "always" }}
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