// app/early-access/EarlyAccessClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";

type Plan = "free" | "starter" | "pro";

function normalizePlan(v: string | null): Plan | null {
  if (!v) return null;
  const s = v.toLowerCase().trim();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return null;
}

function planLabel(plan: Plan) {
  if (plan === "free") return "Free — Field Capture";
  if (plan === "starter") return "Starter — Owner Mode";
  return "Pro — Crew + Control";
}

function planAccent(plan: Plan) {
  // premium on white, subtle
  if (plan === "starter") return "border-black/10 bg-black/5 text-black";
  if (plan === "pro") return "border-black/10 bg-black/5 text-black";
  return "border-black/10 bg-black/5 text-black";
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
  const params = useSearchParams();

  const planFromUrl = useMemo(() => normalizePlan(params.get("plan")), [params]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // plan selection memory (URL → localStorage fallback)
  useEffect(() => {
    const fromStorage =
      typeof window !== "undefined"
        ? normalizePlan(localStorage.getItem("chiefos_selected_plan"))
        : null;

    const plan = planFromUrl || fromStorage;
    setSelectedPlan(plan);

    if (typeof window !== "undefined" && planFromUrl) {
      localStorage.setItem("chiefos_selected_plan", planFromUrl);
    }
  }, [planFromUrl]);

  // tracking: view (✅ guard localStorage access)
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? normalizePlan(localStorage.getItem("chiefos_selected_plan"))
        : null;

    track("early_access_view", {
      plan: planFromUrl || stored,
      path: "/early-access",
    });
  }, [planFromUrl]);

  const header = useMemo(() => {
    if (selectedPlan === "starter") {
      return {
        title: "Request Starter access",
        sub: "Owner Mode for job truth: OCR + voice + Ask Chief (owner-only).",
      };
    }
    if (selectedPlan === "pro") {
      return {
        title: "Request Pro access",
        sub: "Crew + Control: self-logging crew, approvals, audit depth, and board roles.",
      };
    }
    if (selectedPlan === "free") {
      return {
        title: "Start Free",
        sub: "Field Capture: build the habit, then upgrade when you want faster capture, exports, and deeper answers.",
      };
    }
    return {
      title: "Request early access",
      sub: "Leave your details and I’ll reach out when your spot is ready.",
    };
  }, [selectedPlan]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!turnstileToken) throw new Error("Please complete the bot check.");

      await track("early_access_submit", {
        plan: selectedPlan,
        hasPhone: Boolean(phone.trim()),
      });

      const r = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          plan: selectedPlan,
          turnstileToken,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Request failed.");

      setOk(true);
    } catch (e: any) {
      setErr(e?.message ?? "Request failed.");
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <SiteHeader rightLabel="Early Access Login" rightHref="/login" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{header.title}</h1>
            <p className="mt-2 text-gray-600">{header.sub}</p>
          </div>
        </div>

        {/* Selected plan pill + quick switch */}
        {selectedPlan && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <div
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                planAccent(selectedPlan),
              ].join(" ")}
            >
              <span className="h-2 w-2 rounded-full bg-black/60" />
              Selected: {planLabel(selectedPlan)}
            </div>

            <a className="text-xs text-gray-600 underline hover:text-gray-900" href="/pricing#plans">
              Change plan
            </a>
          </div>
        )}

        {ok ? (
          <div className="mt-8 rounded-2xl border bg-gray-50 p-4">
            <p className="font-medium">Got it.</p>
            <p className="mt-2 text-sm text-gray-600">
              You’re on the list{selectedPlan ? ` for ${planLabel(selectedPlan)}` : ""}. Watch your inbox.
            </p>
            <div className="mt-4 flex gap-4">
              <a className="underline text-sm" href="/">
                Back to home
              </a>
              <a className="underline text-sm" href="/pricing">
                View pricing
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium">Name *</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Phone (optional)</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 555 5555"
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
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}

            <button
              className="w-full rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-gray-800 disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Submitting..." : selectedPlan === "free" ? "Start free" : "Request access"}
            </button>

            <p className="text-xs text-gray-500">
              By submitting, you agree to be contacted about early access.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
