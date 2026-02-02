"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import SiteHeader from "@/app/components/SiteHeader";

export default function EarlyAccessPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      const r = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          turnstileToken,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Request failed.");

      setOk(true);
    } catch (e: any) {
      setErr(e?.message ?? "Request failed.");
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <SiteHeader rightLabel="Early Access Login" rightHref="/login" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <h1 className="text-3xl font-bold">Request early access</h1>
        <p className="mt-2 text-gray-600">
          Leave your details and I’ll reach out when your spot is ready.
        </p>

        {ok ? (
          <div className="mt-8 rounded-md border bg-gray-50 p-4">
            <p className="font-medium">Got it.</p>
            <p className="mt-2 text-sm text-gray-600">
              You’re on the early access list. Watch your inbox.
            </p>
            <div className="mt-4">
              <a className="underline text-sm" href="/">
                Back to home
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium">Name *</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Email *</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Phone (optional)</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 555 5555"
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
              {loading ? "Submitting..." : "Request access"}
            </button>

            <p className="text-xs text-gray-500">
              By submitting, you agree to be contacted about early access.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
