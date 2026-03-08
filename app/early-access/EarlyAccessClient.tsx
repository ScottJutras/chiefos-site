// app/early-access/EarlyAccessClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import TurnstileBox from "@/app/components/TurnstileBox";

type Plan = "free" | "starter" | "pro";

// Tester flow is intentionally fixed to Starter.
// Do not trust URL plan switching for tester access.
const TESTER_PLAN: Plan = "starter";

function setPlanEverywhere(plan: Plan) {
  if (typeof window !== "undefined") {
    localStorage.setItem("chiefos_selected_plan", plan);
  }
}

async function track(event: string, payload: Record<string, any> = {}) {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
    });
  } catch {
    // never block UX
  }
}

export default function EarlyAccessClient() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function resetTurnstile() {
    setTurnstileToken(null);
    setTurnstileResetKey((k) => k + 1);
  }

  useEffect(() => {
    setPlanEverywhere(TESTER_PLAN);
  }, []);

  useEffect(() => {
    track("tester_access_view", {
      plan: TESTER_PLAN,
      path: "/early-access",
      source: "tester_portal",
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim();

      await track("tester_access_submit", {
        plan: TESTER_PLAN,
        hasPhone: Boolean(cleanPhone),
        source: "tester_portal",
      });

      const r = await fetch("/api/tester-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone || null,
          plan: TESTER_PLAN,
          turnstileToken,
          source: "tester_portal",
          mode: "tester_self_serve",
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error || "Unable to start tester access.");
      }

      const qp = new URLSearchParams();
      qp.set("plan", TESTER_PLAN);
      qp.set("email", cleanEmail);
      qp.set("mode", "tester");
      if (cleanName) qp.set("name", cleanName);

      router.push(`/early-access/success?${qp.toString()}`);
    } catch (e: any) {
      const msg = e?.message ?? "Unable to start tester access.";
      setErr(msg);

      const lower = String(msg).toLowerCase();
      const looksLikeBot =
        lower.includes("bot") ||
        lower.includes("turnstile") ||
        lower.includes("captcha") ||
        lower.includes("complete the check");

      if (looksLikeBot) resetTurnstile();
      else setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <SiteHeader rightLabel="Sign in" rightHref="/login" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-medium text-black">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Starter Tester Access
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              Start Testing ChiefOS
            </h1>

            <p className="mt-2 text-gray-600">
              Create your tester account and jump in right away. No approval needed.
            </p>

            <p className="mt-3 text-sm text-gray-500">
              You’ll get Starter tester access for beta testing.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium">Name *</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
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
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Phone (optional)</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 555 5555"
              autoComplete="tel"
            />
          </div>

          <div className="pt-2">
            <TurnstileBox
              resetKey={turnstileResetKey}
              onToken={(t) => setTurnstileToken(t)}
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
            {loading ? "Starting tester access..." : "Get Tester Access"}
          </button>

          <p className="text-xs text-gray-500">
            By continuing, you’re starting self-serve tester access to ChiefOS.
          </p>
        </form>
      </div>
    </main>
  );
}