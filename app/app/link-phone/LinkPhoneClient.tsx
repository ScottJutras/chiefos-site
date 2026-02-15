// chiefos-site/app/app/link-phone/LinkPhoneClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function DIGITS(x: unknown) {
  return String(x ?? "").replace(/\D/g, "");
}

const WHATSAPP_NUMBER = "12316802664"; // no +, no whatsapp: prefix
const WA_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("LINK")}`;

async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

async function apiFetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  if (init?.body && !headers.get("Content-Type")) headers.set("Content-Type", "application/json");

  // ✅ hard timeout so UI never hangs forever
  const controller = new AbortController();
  const timeoutMs = 12_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await resp.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}

    if (!resp.ok) {
      const msg = json?.error || json?.message || `Request failed (${resp.status})`;
      throw new Error(msg);
    }

    return json as T;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Verify timed out. The server didn’t respond. Check Vercel logs for /api/link-phone/verify.");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}


export default function LinkPhoneClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextUrl = useMemo(() => sp.get("next") || "/app/settings/billing", [sp]);

  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"enter_phone" | "enter_otp">("enter_phone");

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ✅ new: user confirmation they opened WhatsApp + sent LINK
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getSupabaseAccessToken();
      setAuthed(!!token);
      setLoading(false);
    })();
  }, []);

  async function startOtp() {
    setErr(null);
    setMsg(null);

    if (!linkSent) {
      setErr('Before sending OTP, open WhatsApp and send "LINK" to ChiefOS (Step 1).');
      return;
    }

    const phoneDigits = DIGITS(phone);
    if (!phoneDigits || phoneDigits.length < 10) {
      setErr("Please enter a valid phone number (include country code digits).");
      return;
    }

    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) {
      setErr("You must be logged in to link your phone.");
      return;
    }

    // ✅ Explicit Step 2 message (right before API call)
    setMsg('Step 2 — Sending OTP. If you didn’t send "LINK" in WhatsApp first, delivery will fail.');

    await apiFetchJSON<{ ok: true }>("/api/link-phone/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ownerPhone: phoneDigits }),
    });

    setStage("enter_otp");
    setMsg("OTP sent. Check your WhatsApp messages.");
  }

  async function verifyOtp() {
    setErr(null);
    setMsg(null);

    const phoneDigits = DIGITS(phone);
    const otpDigits = DIGITS(otp);

    if (!phoneDigits || phoneDigits.length < 10) {
      setErr("Please enter a valid phone number (include country code digits).");
      return;
    }
    if (!otpDigits || otpDigits.length !== 6) {
      setErr("Please enter the 6-digit OTP.");
      return;
    }

    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) {
      setErr("You must be logged in to verify OTP.");
      return;
    }

    setMsg("Verifying…");

    await apiFetchJSON<{ ok: true; linked: true; owner_id: string }>("/api/link-phone/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ownerPhone: phoneDigits, otp: otpDigits }),
    });

    setMsg("Linked. Redirecting…");
    router.replace(nextUrl);
  }

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
          <p className="mt-3 text-sm text-white/70">
            You must be logged in to link your phone to an owner account.
          </p>
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Link your phone</h1>
        <p className="mt-2 text-sm text-white/70">
          This links your portal user to your WhatsApp owner record so Billing and Settings work.
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

        {/* Step 1 */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-medium">Step 1 — Open WhatsApp</div>
          <p className="mt-2 text-sm text-white/70">
            To allow OTP delivery, you must send{" "}
            <span className="text-white/90 font-medium">LINK</span> to ChiefOS (opens a 24-hour WhatsApp window).
          </p>

          <a
            href={WA_LINK}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
          >
            Open WhatsApp &amp; send “LINK”
          </a>

          {/* ✅ Step 1 confirmation gate */}
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <input
              type="checkbox"
              checked={linkSent}
              onChange={(e) => setLinkSent(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <div>
              <div className="text-sm font-medium text-white/90">I sent “LINK” in WhatsApp</div>
              <div className="text-xs text-white/60">
                Required so we can message you the OTP without templates.
              </div>
            </div>
          </label>
        </div>

        {/* Step 2 */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <label className="block text-sm text-white/70">Owner phone (digits)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="19053279955"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />

          {stage === "enter_otp" && (
            <>
              <label className="mt-4 block text-sm text-white/70">OTP (6 digits)</label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              />
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {stage === "enter_phone" ? (
              <button
                onClick={startOtp}
                disabled={!linkSent}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-medium",
                  linkSent ? "bg-white text-black hover:bg-white/90" : "cursor-not-allowed bg-white/10 text-white/50",
                ].join(" ")}
                title={linkSent ? "Send OTP" : 'Send "LINK" in WhatsApp first'}
              >
                Send OTP
              </button>
            ) : (
              <>
                <button
                  onClick={verifyOtp}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                >
                  Verify &amp; Link
                </button>

                <button
                  onClick={() => {
                    setStage("enter_phone");
                    setOtp("");
                    setMsg(null);
                    setErr(null);
                  }}
                  className="rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
                >
                  Start over
                </button>
              </>
            )}

            <a
              href={nextUrl}
              className="rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
            >
              Back
            </a>
          </div>

          <div className="mt-4 text-xs text-white/50">
            Note: WhatsApp OTP requires you to send LINK first (24-hour window). Templates are not enabled yet.
          </div>
        </div>
      </div>
    </div>
  );
}
