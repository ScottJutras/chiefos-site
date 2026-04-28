"use client";

import { useTenantGate } from "@/lib/useTenantGate";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { fetchWhoami } from "@/lib/whoami";

// R2.5: code generation moved to /api/link-phone/start (backend portal_phone_link_otp flow).
// The stored OTP row expires in 10 minutes; regenerate via the same endpoint.
type GeneratedCode = {
  code: string;
  expiresAt: string;
};

function fmtTime(ts: string | null) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function digitsOnly(code: string | null | undefined) {
  return String(code || "").replace(/\D/g, "");
}

async function getBearerToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

function safeReturnTo(input: string | null | undefined) {
  const s = String(input || "").trim();
  if (!s) return "/app/dashboard";
  if (!s.startsWith("/")) return "/app/dashboard";
  if (s.startsWith("//")) return "/app/dashboard";
  if (s.toLowerCase().startsWith("/api")) return "/app/dashboard";
  return s;
}

export default function ConnectWhatsAppPage() {
  const router = useRouter();

  const { loading: gateLoading, userId, tenantId } = useTenantGate({ requireWhatsApp: false });

  const [returnTo, setReturnTo] = useState<string>("/app/dashboard");
  const [pageLoading, setPageLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [copied, setCopied] = useState(false);

  // null = unknown, true = linked, false = not linked
  const [isLinked, setIsLinked] = useState<boolean | null>(null);

  const codeDigits = useMemo(() => digitsOnly(generatedCode?.code), [generatedCode?.code]);
  const has6Digits = codeDigits.length === 6;

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setReturnTo(safeReturnTo(sp.get("returnTo")));
    } catch {
      setReturnTo("/app/dashboard");
    }
  }, []);

  async function checkLinkStatus(): Promise<boolean> {
    const w: any = await fetchWhoami();
    if (!w?.ok) return false;
    return !!w.hasWhatsApp;
  }

  async function createNewCode() {
    setError(null);
    setCreating(true);
    setCopied(false);

    try {
      const phoneDigits = digitsOnly(phoneInput);
      if (phoneDigits.length < 7) {
        setError("Enter your WhatsApp phone number (digits only, include country code).");
        return;
      }

      const token = await getBearerToken();
      if (!token) {
        setError("Session expired. Please sign in again.");
        return;
      }

      const resp = await fetch("/api/link-phone/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneDigits }),
      });

      const payload = await resp.json().catch(() => null);
      if (!resp.ok || !payload?.ok || !payload?.code) {
        setError(payload?.error?.message || payload?.message || "Unable to generate a code right now.");
        return;
      }

      setGeneratedCode({ code: String(payload.code), expiresAt: String(payload.expiresAt || "") });
    } catch (e: any) {
      setError(e?.message ?? "Unknown error creating link code.");
    } finally {
      setCreating(false);
    }
  }

  async function load() {
    setPageLoading(true);
    setError(null);
    setCopied(false);

    try {
      if (!userId || !tenantId) return;

      const linked = await checkLinkStatus();
      setIsLinked(linked);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error loading connect page.");
    } finally {
      setPageLoading(false);
    }
  }

  async function handleCheckNow() {
    setError(null);
    setChecking(true);

    try {
      if (!userId || !tenantId) return;
      const linked = await checkLinkStatus();
      setIsLinked(linked);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error checking link status.");
    } finally {
      setChecking(false);
    }
  }

  // Load on gate ready
  useEffect(() => {
    if (gateLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateLoading, userId, tenantId]);

  // Poll every 3s to detect link status changes in either direction
  useEffect(() => {
    if (gateLoading || pageLoading) return;
    if (!userId || !tenantId) return;

    const t = setInterval(async () => {
      if (pollingActive) return;
      setPollingActive(true);
      try {
        const linked = await checkLinkStatus();
        setIsLinked(linked);
      } catch {
        // silent
      } finally {
        setPollingActive(false);
      }
    }, 3000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateLoading, pageLoading, userId, tenantId]);

  // Reset "Copied!" after a moment
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  if (gateLoading) return <div className="p-8 text-[var(--text-muted)]">Loading…</div>;
  if (pageLoading) return <div className="p-8 text-[var(--text-muted)]">Loading…</div>;

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-[var(--text-faint)]">Settings</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
          Connect WhatsApp
        </h1>
        <div className="mt-3 text-sm text-[var(--text-muted)] leading-relaxed max-w-xl">
          Link your portal account to the phone number you use in WhatsApp so expenses, revenue, and time entries flow in automatically.
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {/* LINKED STATE */}
      {isLinked ? (
        <div className="rounded-[28px] border border-emerald-500/30 bg-emerald-500/10 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-lg">
              ✓
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-300">WhatsApp linked</div>
              <div className="text-xs text-emerald-500/70 mt-0.5">
                This page will notify you if your link is ever lost.
              </div>
            </div>
          </div>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            You can now send expenses, revenue, and time entries to Chief on WhatsApp at{" "}
            <span className="font-mono font-semibold text-[var(--text-primary)]">+1 (231) 680-2664</span>.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => router.push(returnTo)}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-5 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25 transition"
            >
              Continue →
            </button>
            <a
              href="https://wa.me/12316802664"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.12)] px-4 py-2 text-sm font-semibold text-[#D4A853] hover:bg-[rgba(212,168,83,0.18)] transition inline-flex items-center"
            >
              Open WhatsApp
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Step 1 — Add Chief */}
          <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Step 1 — Add Chief on WhatsApp</div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Save this number in your phone contacts, then open a WhatsApp chat with Chief:
            </p>
            <div className="rounded-2xl border border-[var(--gold-border-strong)] bg-[var(--gold-dim)] px-6 py-4 text-center">
              <div className="font-mono text-2xl tracking-widest text-[var(--gold)]">+1 (231) 680-2664</div>
              <div className="mt-1 text-xs text-[var(--text-faint)]">Save as "Chief" in your contacts</div>
            </div>
          </div>

          {/* Step 2 — Enter phone + generate code */}
          <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6 space-y-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Step 2 — Send your link code</div>

            <div>
              <label className="block text-xs text-[var(--text-faint)] mb-2">Your WhatsApp number (digits only, include country code)</label>
              <input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="19053279955"
                inputMode="numeric"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Send <span className="font-semibold text-[var(--text-primary)]">only this 6-digit code</span> as a message to Chief on WhatsApp from the phone above:
            </p>

            <div className="rounded-2xl border border-[var(--gold-border-strong)] bg-[var(--gold-dim)] px-6 py-5 font-mono text-3xl tracking-[0.35em] text-[var(--gold)] text-center">
              {has6Digits ? codeDigits : <span className="text-[var(--text-faint)] text-base tracking-normal">No code yet</span>}
            </div>

            {generatedCode?.expiresAt ? (
              <div className="text-xs text-[var(--text-faint)]">Expires at {fmtTime(generatedCode.expiresAt)} — this page checks automatically.</div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={createNewCode}
                disabled={creating}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-white/[0.09] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Generating…" : "Get a new code"}
              </button>

              <button
                onClick={handleCheckNow}
                disabled={checking}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-white/[0.09] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checking ? "Checking…" : "Check now"}
              </button>

              <button
                onClick={async () => {
                  if (!has6Digits) return;
                  try {
                    await navigator.clipboard.writeText(codeDigits);
                    setCopied(true);
                  } catch {
                    // ignore
                  }
                }}
                disabled={!has6Digits}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-white/[0.09] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? "Copied!" : "Copy code"}
              </button>

              <a
                href={has6Digits ? `https://wa.me/12316802664?text=${encodeURIComponent(codeDigits)}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-xl border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.12)] px-4 py-2 text-sm font-semibold text-[#D4A853] hover:bg-[rgba(212,168,83,0.18)] transition inline-flex items-center ${
                  !has6Digits ? "pointer-events-none opacity-40" : ""
                }`}
              >
                Open WhatsApp
              </a>
            </div>

            <p className="text-xs text-[var(--text-faint)]">
              Once you send the code, this page detects the link automatically.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
