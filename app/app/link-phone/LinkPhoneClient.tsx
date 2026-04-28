// chiefos-site/app/app/link-phone/LinkPhoneClient.tsx
//
// R3 §2.5: rewritten to match the R2.5 code-display OTP flow (consistent with
// /app/app/welcome/WelcomeClient.tsx and /app/app/connect-whatsapp/page.tsx).
// Pre-R3 version used a pull-model "we text you an OTP" UX that was misaligned
// with the push-model ( user texts code FROM WhatsApp TO the bot ) shipped in
// R2.5. The backend endpoints returned shapes the old UI didn't read — the
// "Verify & Link" button redirected unconditionally regardless of actual
// pairing status. Rewrite below uses the real R2.5 contracts.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const WHATSAPP_NUMBER = "12316802664";

function digitsOnly(x: unknown) {
  return String(x ?? "").replace(/\D/g, "");
}

async function getBearerToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export default function LinkPhoneClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextUrl = useMemo(() => sp.get("next") || "/app/settings/billing", [sp]);

  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [paired, setPaired] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getBearerToken();
      setAuthed(!!token);
      setLoading(false);
    })();
  }, []);

  async function generateCode() {
    setErr(null);
    setMsg(null);
    setCode(null);

    const phoneDigits = digitsOnly(phone);
    if (phoneDigits.length < 10) {
      setErr("Enter your WhatsApp phone number with country-code digits.");
      return;
    }

    const token = await getBearerToken();
    if (!token) {
      setErr("Session expired. Please sign in again.");
      return;
    }

    setGenerating(true);
    try {
      const resp = await fetch("/api/link-phone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phoneDigits }),
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok || !payload?.ok || !payload?.code) {
        setErr(payload?.error?.message || payload?.message || "Unable to generate a code right now.");
        return;
      }
      setCode(String(payload.code));
      setMsg("Send this code from your WhatsApp to link your phone.");
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error generating code.");
    } finally {
      setGenerating(false);
    }
  }

  // Poll /api/link-phone/verify for pairing completion.
  useEffect(() => {
    if (!code || paired) return;
    const interval = setInterval(async () => {
      const token = await getBearerToken();
      if (!token) return;
      try {
        const resp = await fetch("/api/link-phone/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const payload = await resp.json().catch(() => null);
        if (payload?.ok && payload?.paired) {
          setPaired(true);
          setMsg("Linked. Redirecting…");
          clearInterval(interval);
          setTimeout(() => router.replace(nextUrl), 600);
        }
      } catch {
        /* silent */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [code, paired, router, nextUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 py-10 text-sm text-white/70">Loading…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 py-10">
          <h1 className="text-2xl font-semibold">Link your phone</h1>
          <p className="mt-3 text-sm text-white/70">You must be signed in to link your phone.</p>
          <div className="mt-6 flex gap-3">
            <a
              href="/login"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  const waLink = code ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(code)}` : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Link your phone</h1>
        <p className="mt-2 text-sm text-white/70">
          Links your portal account to the WhatsApp number you send messages from.
        </p>

        {err && (
          <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {err}
          </div>
        )}
        {msg && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            {msg}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <label className="block text-sm text-white/70">Your WhatsApp number (digits only)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="19053279955"
            inputMode="numeric"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />

          <button
            onClick={generateCode}
            disabled={generating || digitsOnly(phone).length < 10 || paired}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-40"
          >
            {generating ? "Generating…" : code ? "Generate new code" : "Generate code"}
          </button>
        </div>

        {code && !paired && (
          <div className="mt-6 rounded-2xl border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.05)] p-6 space-y-4">
            <div className="text-xs uppercase tracking-[0.14em] text-white/50">
              Send this code via WhatsApp
            </div>
            <div className="rounded-xl border border-[rgba(212,168,83,0.3)] bg-black/30 px-6 py-5 font-mono text-3xl tracking-[0.35em] text-[#D4A853] text-center">
              {code}
            </div>
            <div className="flex flex-wrap gap-2">
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                >
                  Open WhatsApp →
                </a>
              )}
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(code);
                    setMsg("Code copied.");
                  } catch {
                    /* ignore */
                  }
                }}
                className="rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
              >
                Copy code
              </button>
            </div>
            <p className="text-xs text-white/50">
              Page checks automatically every few seconds. Expires in 10 minutes.
            </p>
          </div>
        )}

        <div className="mt-6">
          <a
            href={nextUrl}
            className="rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
          >
            Back
          </a>
        </div>
      </div>
    </div>
  );
}
