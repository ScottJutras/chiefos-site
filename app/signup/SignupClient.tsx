"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import TurnstileBox from "@/app/components/TurnstileBox";
import { normalizeAuthMessage } from "@/lib/authErrors";

type Plan = "free" | "starter" | "pro";
function cleanPlan(x: string | null): Plan | null {
  const s = String(x || "").trim().toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return null;
}

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
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
      <path d="M9.88 5.47A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a17.4 17.4 0 0 1-4.27 5.01" />
      <path d="M6.61 6.61A17.4 17.4 0 0 0 2 12s3 7 10 7a10.8 10.8 0 0 0 4.12-.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function passwordChecks(pw: string) {
  const s = pw || "";
  return {
    len: s.length >= 10,
    upper: /[A-Z]/.test(s),
    lower: /[a-z]/.test(s),
    num: /\d/.test(s),
    sym: /[^A-Za-z0-9]/.test(s),
  };
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={["h-2 w-2 rounded-full", ok ? "bg-emerald-500" : "bg-gray-300"].join(" ")} />
      <span className={ok ? "text-gray-800" : "text-gray-500"}>{label}</span>
    </div>
  );
}

export default function SignupClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const prefillEmail = useMemo(() => (sp.get("email") || "").trim(), [sp]);
  const prefillName = useMemo(() => (sp.get("name") || "").trim(), [sp]);
  const prefillPlan = useMemo(() => cleanPlan(sp.get("plan")), [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // Prefill once (URL-driven)
    if (prefillEmail) setEmail((cur) => cur || prefillEmail);
    if (prefillName) setCompanyName((cur) => cur || prefillName);

    if (prefillPlan && typeof window !== "undefined") {
      localStorage.setItem("chiefos_selected_plan", prefillPlan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillEmail, prefillName, prefillPlan]);

  function resetTurnstile() {
    setTurnstileToken(null);
    setTurnstileResetKey((k) => k + 1);
  }

  const checks = useMemo(() => passwordChecks(password), [password]);
  const pwOk = useMemo(() => Object.values(checks).every(Boolean), [checks]);
  const matchOk = useMemo(() => password.length > 0 && password === confirmPassword, [password, confirmPassword]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!turnstileToken) throw new Error("Please complete the bot check.");
      if (!pwOk) throw new Error("Password does not meet the requirements below.");
      if (!matchOk) throw new Error("Passwords do not match.");

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
          Create the owner login for early access. After you confirm your email, you can log in.
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

              <div className="mt-2 grid grid-cols-2 gap-2">
                <CheckRow ok={checks.len} label="10+ characters" />
                <CheckRow ok={checks.num} label="A number" />
                <CheckRow ok={checks.upper} label="An uppercase" />
                <CheckRow ok={checks.lower} label="A lowercase" />
                <CheckRow ok={checks.sym} label="A symbol" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Confirm password</label>
              <div className="relative mt-1">
                <input
                  className="w-full rounded-md border border-black/10 bg-white px-3 py-2 pr-11 outline-none focus:ring-2 focus:ring-black/10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-black/60 hover:text-black hover:bg-black/5 transition"
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirm ? <EyeIcon off /> : <EyeIcon />}
                </button>
              </div>

              {confirmPassword.length > 0 && !matchOk ? (
                <div className="mt-2 text-xs text-red-700">Passwords don’t match.</div>
              ) : null}
            </div>

            <div className="pt-2">
              <TurnstileBox resetKey={turnstileResetKey} onToken={(t) => setTurnstileToken(t)} />
            </div>

            {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            <button
              className="w-full rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-gray-900 disabled:opacity-60"
              disabled={loading || !turnstileToken}
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