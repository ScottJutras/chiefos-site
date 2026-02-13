// app/contact/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import SiteHeader from "@/app/components/marketing/SiteHeader";
import SiteFooter from "@/app/components/marketing/SiteFooter";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  // Keep options stable (avoid re-render loops)
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
    setStatus("sending");

    try {
      if (!siteKey) throw new Error("Bot check misconfigured (missing site key).");
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, turnstileToken }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Message failed.");

      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
      resetTurnstile();
    } catch (e: any) {
      setStatus("error");
      setErr(e?.message ?? "Message failed.");
      resetTurnstile();
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <div className="mx-auto max-w-2xl px-6 pt-28 pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
          We reply fast. No spam.
        </div>

        <h1 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight">Contact</h1>
        <p className="mt-3 text-white/70">
          Send a note. If it’s urgent, start on WhatsApp — that’s where ChiefOS lives.
        </p>

        {status === "sent" ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-white/90">Message received.</div>
            <p className="mt-2 text-sm text-white/70">We’ll get back to you soon.</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Back to home
              </a>
              <a
                href="/wa?t=support"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
              >
                Open WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {/* Honeypot */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />

            <div>
              <label className="block text-sm text-white/70">Name</label>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70">Email *</label>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-white/70">Message *</label>
              <textarea
                className="mt-1 w-full min-h-[140px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                required
              />
            </div>

            <div className="pt-2">
              {!siteKey ? (
                <div className="text-xs text-red-200">
                  Turnstile misconfigured: missing NEXT_PUBLIC_TURNSTILE_SITE_KEY
                </div>
              ) : (
                <div className="inline-block">
                  <Turnstile
                    key={turnstileKey}
                    siteKey={siteKey}
                    options={turnstileOptions}
                    onSuccess={(token) => setTurnstileToken(token)}
                    onExpire={() => resetTurnstile()}
                    onError={() => resetTurnstile()}
                  />
                </div>
              )}
            </div>

            {err && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {err}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-60"
                disabled={status === "sending"}
                type="submit"
              >
                {status === "sending" ? "Sending..." : "Send message"}
              </button>

              <a
                href="/wa?t=support"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Prefer WhatsApp
              </a>
            </div>

            <p className="text-xs text-white/45">We’ll only use your email to respond.</p>
          </form>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
