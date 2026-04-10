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

      router.push(`/signup?${qp.toString()}`);
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
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      <SiteHeader rightLabel="Sign in" rightHref="/login" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-1 text-xs font-medium text-[#D4A853]">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Starter Tester Access
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#E8E2D8]">
              Start Testing ChiefOS
            </h1>

            <p className="mt-2 text-[#A8A090]">
              Create your tester account and jump in right away. No approval needed.
            </p>

            <p className="mt-3 text-sm text-[#706A60]">
              You’ll get Starter tester access for beta testing.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A8A090]">Name *</label>
            <input
              className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A8A090]">Email *</label>
            <input
              className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A8A090]">Phone (optional)</label>
            <input
              className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
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
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {err}
            </div>
          )}

          <button
            className="w-full rounded-[2px] bg-[#D4A853] px-4 py-2 text-[#0C0B0A] font-semibold hover:bg-[#C49843] disabled:opacity-60 transition"
            disabled={loading}
            type="submit"
          >
            {loading ? "Starting tester access..." : "Get Tester Access"}
          </button>

          <p className="text-xs text-[#706A60]">
            By continuing, you’re starting Tester access to ChiefOS.
          </p>
        </form>
      </div>
    </main>
  );
}