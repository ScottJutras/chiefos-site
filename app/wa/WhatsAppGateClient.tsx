"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";

export default function WhatsAppGateClient() {
  const sp = useSearchParams();

  const t = sp.get("t") || "hero";
  const plan = sp.get("plan"); // optional

  const [token, setToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  // ✅ For short-link mode: show copy + open
  const [starterMessage, setStarterMessage] = useState<string>("");
  const [redirectUrl, setRedirectUrl] = useState<string>("");

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const turnstileOptions = useMemo(() => {
    return { appearance: "always" as const };
  }, []);

  function resetTurnstile() {
    setToken(null);
    setTurnstileKey((k) => k + 1);
  }

  function isAllowedWhatsAppUrl(url: string) {
    return (
      url.startsWith("https://wa.me/") ||
      url.startsWith("https://api.whatsapp.com/")
    );
  }

  function isShortLink(url: string) {
    // e.g. https://wa.me/message/XXXXXXXXXXXX
    return url.includes("wa.me/message/");
  }

  async function openWhatsApp() {
    setErr(null);
    setStatus("verifying");

    // clear previous result
    setStarterMessage("");
    setRedirectUrl("");

    try {
      if (!siteKey) throw new Error("Bot check is not configured (missing site key).");
      if (!token) throw new Error("Please complete the bot check.");

      const r = await fetch("/api/wa-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: token, t, plan }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Could not open WhatsApp.");

      const url = String(j?.url || "");
      const msg = String(j?.message || "");

      if (!url || !isAllowedWhatsAppUrl(url)) {
        throw new Error("Invalid WhatsApp redirect URL.");
      }

      // Store for UI
      setRedirectUrl(url);
      setStarterMessage(msg);

      // ✅ Short-link mode: don't auto-redirect (prefill often unreliable)
      if (isShortLink(url)) return;

      // ✅ Direct wa.me/<number>?text=... can auto-open safely
      window.location.assign(url);
    } catch (e: any) {
      setStatus("error");
      setErr(e?.message ?? "Could not open WhatsApp.");
      resetTurnstile();
    } finally {
      setStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      <div className="mx-auto max-w-2xl px-6 pt-28 pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-1 text-xs text-[#D4A853]">
          Quick check → then we open WhatsApp
        </div>

        <h1 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight text-[#E8E2D8]">
          Start on WhatsApp
        </h1>

        <p className="mt-3 text-[#A8A090] leading-relaxed">
          ChiefOS runs on WhatsApp. This quick check prevents bot scraping and spam.
        </p>

        <div className="mt-8 rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-6">
          <div className="text-sm font-semibold text-[#E8E2D8]">One quick step</div>
          <p className="mt-2 text-sm text-[#A8A090]">
            Complete the check below, then we’ll open your chat with Chief.
          </p>

          <div className="mt-5">
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
                  onSuccess={(tok) => setToken(tok)}
                  onExpire={() => resetTurnstile()}
                  onError={() => resetTurnstile()}
                />
              </div>
            )}
          </div>

          {err && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {err}
            </div>
          )}

          {/* Shows after API returns a url/message (especially for short-link mode) */}
          {starterMessage ? (
            <div className="mt-4 rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0C0B0A] p-4">
              <div className="text-sm font-semibold text-[#E8E2D8]">Starter message</div>
              <div className="mt-2 text-sm text-[#A8A090]">
                If WhatsApp doesn’t prefill automatically, copy this:
              </div>

              <div className="mt-3 rounded-xl border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-3 text-sm text-[#E8E2D8]">
                {starterMessage}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(starterMessage);
                    } catch {
                      // no-op
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-transparent px-4 py-3 text-sm font-semibold text-[#D4A853] hover:bg-[rgba(212,168,83,0.08)] transition"
                >
                  Copy message
                </button>

                {redirectUrl ? (
                  <a
                    href={redirectUrl}
                    className="inline-flex items-center justify-center rounded-[2px] bg-[#D4A853] px-4 py-3 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition"
                  >
                    Open WhatsApp
                  </a>
                ) : null}
              </div>

              <div className="mt-2 text-xs text-[#706A60]">
                This flow protects the number from being scraped.
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={openWhatsApp}
              disabled={status === "verifying" || !token}
              className="inline-flex items-center justify-center rounded-[2px] bg-[#D4A853] px-5 py-3 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition disabled:opacity-60"
            >
              {status === "verifying" ? "Opening…" : "Open WhatsApp"}
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-transparent px-5 py-3 text-sm font-semibold text-[#D4A853] hover:bg-[rgba(212,168,83,0.08)] transition"
            >
              Back to home
            </Link>
          </div>

          <p className="mt-4 text-xs text-[#706A60]">
            On desktop, WhatsApp Web will open (or you’ll be prompted).
          </p>
        </div>
      </div>
    </main>
  );
}