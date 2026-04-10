"use client";

import { useState } from "react";
import SiteHeader from "@/app/components/SiteHeader";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordClient() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const origin = window.location.origin;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/update-password`,
      });

      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]" style={{ paddingTop: "var(--early-access-banner-h)" }}>
      <SiteHeader rightLabel="Log in" rightHref="/login" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <h1 className="text-3xl font-bold tracking-tight text-[#E8E2D8]">Reset your password</h1>
        <p className="mt-2 text-[#A8A090]">We’ll email you a secure link to set a new password.</p>

        {sent ? (
          <div className="mt-8 rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-4">
            <p className="font-medium text-[#E8E2D8]">Check your email</p>
            <p className="mt-2 text-sm text-[#A8A090]">Open the reset link, then set a new password.</p>
          </div>
        ) : (
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

            {err && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</div>}

            <button
              className="w-full rounded-[2px] bg-[#D4A853] px-4 py-2 text-[#0C0B0A] font-semibold hover:bg-[#C49843] disabled:opacity-60 transition"
              disabled={loading}
              type="submit"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}