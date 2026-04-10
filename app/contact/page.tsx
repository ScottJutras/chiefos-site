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

    // ✅ Hard guard to prevent double submits
    if (status === "sending") return;

    setErr(null);
    setStatus("sending");

    try {
      if (!siteKey) throw new Error("Bot check misconfigured (missing site key).");
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      const payload = {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        turnstileToken,
      };

      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      <SiteHeader />

      <div className="mx-auto max-w-2xl px-6 pt-28 pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-1 text-xs text-[#D4A853]">
          Contact ChiefOS.
        </div>

        <h1 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight text-[#E8E2D8]">Contact ChiefOS</h1>

        <p className="mt-3 text-[#A8A090] leading-relaxed">
          Please fill out the form, verify then press Send message and we’ll get back to you as soon as possible.
        </p>

        {status === "sent" ? (
          <div className="mt-8 rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-6">
            <div className="text-sm font-semibold text-[#E8E2D8]">Message Delivered.</div>
            <p className="mt-2 text-sm text-[#A8A090]">We’ll reply as soon as we can. Until then, try adding Chief to WhatsApp and say "Hi". For further instructions go to Request Early Access.</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-transparent px-5 py-3 text-sm font-semibold text-[#D4A853] hover:bg-[rgba(212,168,83,0.08)] transition"
              >
                Back to home
              </a>
              <a
                href="/wa?t=support"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-[2px] bg-[#D4A853] px-5 py-3 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition"
              >
                 WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {/* Honeypot */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />

            <div>
              <label className="block text-sm text-[#A8A090]">Name *</label>
              <input
                className="mt-1 w-full rounded-xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[#A8A090]">Email *</label>
              <input
                className="mt-1 w-full rounded-xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[#A8A090]">Message *</label>
              <textarea
                className="mt-1 w-full min-h-[140px] rounded-xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What do you need help with? (Plans, setup, logging, exports, crew access, etc.)"
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
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {err}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="inline-flex items-center justify-center rounded-[2px] bg-[#D4A853] px-5 py-3 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition disabled:opacity-60"
                disabled={status === "sending"}
                type="submit"
              >
                {status === "sending" ? "Sending..." : "Send message"}
              </button>
            </div>

            <p className="text-xs text-[#706A60]">We only use your email to reply. No lists. No marketing blasts.</p>
          </form>
        )}
      </div>

      <SiteFooter
        brandLine="Stop stacking apps. Start running a system."
        subLine="Capture once. Structure automatically. Ask anything."
      />
    </main>
  );
}