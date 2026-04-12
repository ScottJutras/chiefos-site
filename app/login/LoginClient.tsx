"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import TurnstileBox from "@/app/components/TurnstileBox";
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

function safeReturnTo(raw: string | null | undefined) {
  const s = String(raw || "").trim();
  if (!s) return "/app";
  if (!s.startsWith("/")) return "/app";
  if (s.startsWith("//")) return "/app";
  return s;
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const returnTo = safeReturnTo(sp.get("returnTo"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetTurnstile() {
    setTurnstileToken(null);
    setTurnstileResetKey((k) => k + 1);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      await track("login_submit", {});

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!data?.session) {
        setErr("Verify your email. Click the confirmation link we sent, then sign in again.");
        return;
      }

      await track("login_success", {});

      router.push(`/auth/transition?from=login&returnTo=${encodeURIComponent(returnTo)}`);
    } catch (e: any) {
      const friendly = normalizeAuthMessage(e);
      let message = friendly || e?.message || "Something went wrong.";

      const lower = String(message).toLowerCase();

      if (lower.includes("invalid login credentials")) {
        message =
          "That email/password didn’t match. If you’re not sure, use “Forgot password” to reset it. Also make sure you confirmed your email first.";
      }

      setErr(message);
      await track("login_error", { message });

      const looksLikeBot =
        lower.includes("bot") ||
        lower.includes("turnstile") ||
        lower.includes("captcha") ||
        lower.includes("complete the check");

      if (looksLikeBot) resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]" style={{ paddingTop: "var(--early-access-banner-h)" }}>
      <div className="max-w-md mx-auto px-6 pt-10 pb-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-1 text-xs text-[#D4A853]">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Early access portal
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#E8E2D8]">Sign in</h1>
        <p className="mt-2 text-[#A8A090]">If you just signed up, confirm your email first, then sign in.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A8A090]">Email</label>
            <input
              className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A8A090]">Password</label>

            <div className="relative mt-1">
              <input
                className="w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 pr-11 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#706A60] hover:text-[#D4A853] transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeIcon off /> : <EyeIcon />}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <a className="text-xs underline text-[#A8A090] hover:text-[#D4A853]" href="/reset-password">
                Forgot password?
              </a>
              <a className="text-xs underline text-[#A8A090] hover:text-[#D4A853]" href="/signup">
                Create account
              </a>
            </div>
          </div>

          <div className="pt-2">
            <TurnstileBox resetKey={turnstileResetKey} onToken={(t) => setTurnstileToken(t)} />
          </div>

          {err && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</div>}

          <button
            className="w-full rounded-[2px] bg-[#D4A853] px-4 py-2 text-[#0C0B0A] font-semibold hover:bg-[#C49843] disabled:opacity-60 transition"
            disabled={loading}
            type="submit"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}