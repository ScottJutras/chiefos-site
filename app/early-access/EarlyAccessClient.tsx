// app/early-access/EarlyAccessClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import TurnstileBox from "@/app/components/TurnstileBox";

type Plan = "free" | "starter" | "pro";

function normalizePlan(v: string | null): Plan | null {
  if (!v) return null;
  const s = v.toLowerCase().trim();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return null;
}

function setPlanEverywhere(plan: Plan) {
  if (typeof window !== "undefined") {
    localStorage.setItem("chiefos_selected_plan", plan);
  }
}

function planLabel(plan: Plan) {
  if (plan === "free") return "Free — Field Capture";
  if (plan === "starter") return "Starter — Owner Mode";
  return "Pro — Crew + Control";
}

function planAccent(_plan: Plan) {
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
  const router = useRouter();
  const params = useSearchParams();

  const planFromUrl = useMemo(() => normalizePlan(params.get("plan")), [params]);

  // ✅ Always have a plan (default starter)
  const [selectedPlan, setSelectedPlan] = useState<Plan>("starter");

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

  // plan selection memory (URL → localStorage → default)
  useEffect(() => {
    const fromStorage =
      typeof window !== "undefined"
        ? normalizePlan(localStorage.getItem("chiefos_selected_plan"))
        : null;

    const plan = planFromUrl || fromStorage || ("starter" as Plan);
    setSelectedPlan(plan);
    setPlanEverywhere(plan);
  }, [planFromUrl]);

  // tracking: view (track the effective plan)
  useEffect(() => {
    track("early_access_view", {
      plan: selectedPlan,
      path: "/early-access",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan]);

  const header = useMemo(() => {
    if (selectedPlan === "starter") {
      return {
        title: "Request Starter access",
        sub: "Starter Owner Mode gives you: OCR (Images) + Voice Logs + Ask Chief (AI reasoning over your submitted data).",
      };
    }
    if (selectedPlan === "pro") {
      return {
        title: "Request Pro access",
        sub: "Crew + Control: self-logging crew, approvals, audit depth, and board roles.",
      };
    }
    return {
      title: "Start Free",
      sub: "Field Capture: build the habit, then upgrade when you want faster capture, exports, and deeper answers.",
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
          plan: selectedPlan, // ✅ always defined
          turnstileToken,
          source: "pricing_or_site",
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Request failed.");

      // ✅ Option A UX: go to success page + prefill signup CTA
      const qp = new URLSearchParams();
      qp.set("plan", selectedPlan);
      qp.set("email", email.trim());
      if (name.trim()) qp.set("name", name.trim());

      router.push(`/early-access/success?${qp.toString()}`);
    } catch (e: any) {
      const msg = e?.message ?? "Request failed.";
      setErr(msg);

      // bot-ish errors should reset widget; other errors can keep it
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
      <SiteHeader rightLabel="Early Access Login" rightHref="/login" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{header.title}</h1>
            <p className="mt-2 text-gray-600">{header.sub}</p>
          </div>
        </div>

        {/* Selected plan pill + inline selection */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                planAccent(selectedPlan),
              ].join(" ")}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Selected: {planLabel(selectedPlan)}
            </div>

            <a className="text-xs text-gray-600 underline hover:text-gray-900" href="/pricing#plans">
              View pricing
            </a>
          </div>

          {/* Plan picker */}
          <div className="grid grid-cols-3 gap-2">
            {(["free", "starter", "pro"] as Plan[]).map((p) => {
              const active = selectedPlan === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSelectedPlan(p);
                    setPlanEverywhere(p);
                  }}
                  className={[
                    "rounded-xl border px-3 py-2 text-left text-xs transition",
                    active ? "border-black bg-black text-white" : "border-black/10 bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="font-semibold">{planLabel(p).split(" — ")[0]}</div>
                  <div className={active ? "text-white/80" : "text-gray-600"}>{planLabel(p).split(" — ")[1]}</div>
                </button>
              );
            })}
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
            <TurnstileBox resetKey={turnstileResetKey} onToken={(t) => setTurnstileToken(t)} />
          </div>

          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
          )}

          <button
            className="w-full rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-gray-800 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Submitting..." : selectedPlan === "free" ? "Start free" : "Request access"}
          </button>

          <p className="text-xs text-gray-500">By submitting, you agree to be contacted about early access.</p>
        </form>
      </div>
    </main>
  );
}