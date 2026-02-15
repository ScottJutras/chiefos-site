// chiefos-site/app/app/link-phone/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function DIGITS(x: unknown) {
  return String(x ?? "").replace(/\D/g, "");
}

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

  const resp = await fetch(url, { ...init, headers, cache: "no-store" });
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
}

export default function LinkPhonePage() {
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

    const phoneDigits = DIGITS(phone);
    if (!phoneDigits || phoneDigits.length < 10) {
      setErr("Please enter a valid phone number.");
      return;
    }

    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) {
      setErr("You must be logged in to link your phone.");
      return;
    }

    setMsg("Sending OTP…");

    await apiFetchJSON<{ ok: true }>("/api/link-phone/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ownerPhone: phoneDigits }),
    });

    setStage("enter_otp");
    setMsg("OTP sent. Check your phone.");
  }

  async function verifyOtp() {
    setErr(null);
    setMsg(null);

    const phoneDigits = DIGITS(phone);
    const otpDigits = DIGITS(otp);

    if (!phoneDigits || phoneDigits.length < 10) {
      setErr("Please enter a valid phone number.");
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

    // verify sets HttpOnly cookie chiefos_dashboard_token
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
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
              >
                Send OTP
              </button>
            ) : (
              <>
                <button
                  onClick={verifyOtp}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                >
                  Verify & Link
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
            Production note: OTP must be delivered (Twilio SMS/WhatsApp). Logging OTP is dev-only.
          </div>
        </div>
      </div>
    </div>
  );
}
