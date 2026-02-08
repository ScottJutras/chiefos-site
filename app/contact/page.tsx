"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import SiteHeader from "@/app/components/marketing/SiteHeader";
import SiteFooter from "@/app/components/marketing/SiteFooter";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setStatus("sending");

    try {
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, turnstileToken }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Message failed.");

      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
      setTurnstileToken(null);
    } catch (e: any) {
      setStatus("error");
      setErr(e?.message ?? "Message failed.");
      setTurnstileToken(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <div className="mx-auto max-w-2xl px-6 pt-28 pb-16">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Contact</h1>
        <p className="mt-3 text-white/70">
          Send a note — we’ll get back to you.
        </p>

        {status === "sent" ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
            Message sent. We’ll reply soon.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {/* Honeypot (simple bot trap) */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
            />

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
              <label className="block text-sm text-white/70">Email</label>
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
              <label className="block text-sm text-white/70">Message</label>
              <textarea
                className="mt-1 w-full min-h-[140px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
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
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {err}
              </div>
            )}

            <button
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-60"
              disabled={status === "sending"}
              type="submit"
            >
              {status === "sending" ? "Sending..." : "Send message"}
            </button>
          </form>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
