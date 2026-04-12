"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type BillingStatus =
  | { linked: false }
  | {
      linked?: true;
      plan_key: "free" | "starter" | "pro" | string | null;
      sub_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | string
        | null;
      effective_plan: "free" | "starter" | "pro" | string;
      cancel_at_period_end?: boolean | null;
      current_period_start?: number | null; // unix seconds (or null)
      current_period_end?: number | null; // unix seconds (or null)
      stripe_customer_id?: string | null; // ✅ was boolean (typo), should be string|null
    };

const STATUS_URL = "/app/settings/billing/status";
const CHECKOUT_URL = "/app/settings/billing/checkout";
const PORTAL_URL = "/app/settings/billing/portal";

const PLAN_UI = {
  free: {
    label: "Free",
    badge: "Field Capture",
    price: "$0",
    highlights: ["Text logging via WhatsApp", "Up to 3 jobs · 3 employees", "Ask Chief: 3 questions/month", "CSV export · 90-day history"],
  },
  starter: {
    label: "Starter",
    badge: "Owner Mode",
    price: "$59/mo",
    highlights: ["Text & audio logging", "Receipt scanner (OCR) · documents builder", "Ask Chief: 250 questions/month", "Up to 25 jobs · 10 employees", "PDF, CSV & XLS exports · 3-year history"],
  },
  pro: {
    label: "Pro",
    badge: "Crew + Control",
    price: "$149/mo",
    highlights: ["Crew self-logging via WhatsApp", "Ask Chief: 2,000 questions/month", "Unlimited jobs · 50 employees · 5 board members", "Forecasting · time approvals", "7-year history"],
  },
} as const;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAccessTokenWithRetry(opts?: { timeoutMs?: number; intervalMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 2500;
  const intervalMs = opts?.intervalMs ?? 150;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      if (token) return token;
    } catch {
      // ignore
    }
    await sleep(intervalMs);
  }

  return "";
}

function fmtDateFromUnixSeconds(sec?: number | null) {
  if (!sec || !Number.isFinite(sec)) return null;
  try {
    return new Date(sec * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

function normalizePlanKey(x: unknown): "free" | "starter" | "pro" {
  const s = String(x ?? "").toLowerCase().trim();
  if (s === "pro") return "pro";
  if (s === "starter") return "starter";
  return "free";
}

async function apiFetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAccessTokenWithRetry({ timeoutMs: 2500, intervalMs: 150 });
  if (!token) throw new Error("Missing session. Please log in again.");

  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.get("Content-Type")) headers.set("Content-Type", "application/json");

  const resp = await fetch(url, { ...init, headers, cache: "no-store" });

  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!resp.ok) {
    const raw = json?.error ?? json?.message ?? null;
    const msg =
      typeof raw === "string"
        ? raw
        : raw
          ? JSON.stringify(raw)
          : `Request failed (${resp.status})`;
    throw new Error(msg);
  }

  return json as T;
}

function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-200 border-amber-500/20"
        : tone === "bad"
          ? "bg-rose-500/10 text-rose-200 border-rose-500/20"
          : "bg-white/5 text-white/80 border-white/10";

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${cls}`}>{label}</span>;
}

export default function BillingClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const preferredPlan = useMemo(() => {
    const q = (sp.get("plan") || "").toLowerCase().trim();
    if (q === "pro") return "pro";
    if (q === "starter") return "starter";
    return null;
  }, [sp]);

  const hasSessionId = useMemo(() => !!sp.get("session_id"), [sp]);

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [activating, setActivating] = useState(false);
  const [activationTarget, setActivationTarget] = useState<"starter" | "pro" | null>(null);

  const pollingRef = useRef<{ stop: () => void } | null>(null);

  const linked = useMemo(() => {
    if (!status) return null;
    if ("linked" in status && status.linked === false) return false;
    return true;
  }, [status]);

  const effectivePlan = useMemo(() => {
    if (!status) return "free";
    if ("linked" in status && status.linked === false) return "free";
    return normalizePlanKey((status as any).effective_plan);
  }, [status]);

  const planKey = useMemo(() => {
    if (!status) return "free";
    if ("linked" in status && status.linked === false) return "free";
    const s = status as Exclude<BillingStatus, { linked: false }>;
    return normalizePlanKey(s.plan_key || s.effective_plan);
  }, [status]);

  const subStatus = useMemo(() => {
    if (!status) return null;
    if ("linked" in status && status.linked === false) return null;
    const s = status as Exclude<BillingStatus, { linked: false }>;
    return s.sub_status ? String(s.sub_status).toLowerCase() : null;
  }, [status]);

  const periodEnd = useMemo(() => {
    if (!status) return null;
    if ("linked" in status && status.linked === false) return null;
    const s = status as Exclude<BillingStatus, { linked: false }>;
    return fmtDateFromUnixSeconds(s.current_period_end);
  }, [status]);

  const billingIssue = useMemo(() => subStatus === "past_due", [subStatus]);

  function stopPolling() {
    pollingRef.current?.stop?.();
    pollingRef.current = null;
  }

  // ✅ FIX: central “clear activating” (used for back/bfcache + timeouts)
  function clearActivating() {
    stopPolling();
    setActivating(false);
    setActivationTarget(null);
  }

  async function refreshStatus() {
    setErr(null);
    try {
      const out = await apiFetchJSON<BillingStatus>(STATUS_URL, { method: "GET" });
      setStatus(out);
      return out;
    } catch (e: any) {
      const msg = String(e?.message || "Failed to load billing status");

      // Portal user without WhatsApp linked — redirect to link-phone
      if (
        msg.toLowerCase().includes("not_linked") ||
        msg.toLowerCase().includes("missing dashboard token") ||
        msg.toLowerCase().includes("missing owner context")
      ) {
        router.replace("/app/link-phone?next=/app/settings/billing");
        return null;
      }

      setErr(msg);
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPolling(target: "starter" | "pro") {
    stopPolling();
    setActivating(true);
    setActivationTarget(target);

    const startedAt = Date.now();
    const maxMs = 20_000;
    const intervalMs = 2500;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;

      const out = await refreshStatus();
      if (cancelled) return;

      const eff =
        out && !("linked" in out && out.linked === false)
          ? normalizePlanKey((out as any).effective_plan)
          : "free";

      if (eff === target) {
        // ✅ FIX: success — stop + clear + remove session_id/plan so it won’t retrigger on refresh
        clearActivating();
        router.replace("/app/settings/billing");
        return;
      }

      if (Date.now() - startedAt >= maxMs) {
        clearActivating();
        setErr("Payment received, but plan activation is still propagating. Refresh in a minute or open “Manage billing”.");
      }
    };

    const id = window.setInterval(tick, intervalMs);
    window.setTimeout(tick, 800);

    pollingRef.current = {
      stop: () => {
        cancelled = true;
        window.clearInterval(id);
      },
    };
  }

  // Auto polling when returning from Stripe (session_id in URL)
  useEffect(() => {
    if (!hasSessionId) return;

    const target = (preferredPlan || "starter") as "starter" | "pro";
    startPolling(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSessionId, preferredPlan]);

  // ✅ FIX: if user backed out of Stripe (no session_id), don’t stay “Activating…”
  // This catches bfcache restores + “Back” behavior.
  useEffect(() => {
    if (!activating) return;
    if (hasSessionId) return;

    const t = window.setTimeout(() => {
      // If we’re “activating” but not in the return-from-Stripe state,
      // we should unlock the UI.
      clearActivating();
    }, 350);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activating, hasSessionId]);

  // ✅ FIX: bfcache restore hook (Safari/Chrome can restore state on back)
  useEffect(() => {
    const onPageShow = () => {
      if (!sp.get("session_id")) {
        clearActivating();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout(planKey: "starter" | "pro") {
    setErr(null);

    // Keep the nice UX (“Activating…”), but it will now auto-clear on Back.
    setActivating(true);
    setActivationTarget(planKey);

    try {
      const out = await apiFetchJSON<{ url: string }>(CHECKOUT_URL, {
        method: "POST",
        body: JSON.stringify({ planKey }),
      });

      if (out?.url) window.location.href = out.url;
      else throw new Error("Checkout failed.");
    } catch (e: any) {
      clearActivating();
      setErr(e?.message || "Checkout failed");
    }
  }

  async function openPortal() {
    setErr(null);
    try {
      const out = await apiFetchJSON<{ url: string }>(PORTAL_URL, { method: "POST" });
      if (out?.url) window.location.href = out.url;
      else throw new Error("Failed to open billing portal.");
    } catch (e: any) {
      setErr(e?.message || "Failed to open billing portal");
    }
  }

  const headline = useMemo(() => {
    if (effectivePlan === "pro") return "Pro — Crew + Control";
    if (effectivePlan === "starter") return "Starter — Owner Mode";
    return "Free — Field Capture";
  }, [effectivePlan]);

  const statusTone = useMemo<"neutral" | "good" | "warn" | "bad">(() => {
    if (!subStatus) return "neutral";
    if (subStatus === "active" || subStatus === "trialing") return "good";
    if (subStatus === "past_due") return "warn";
    return "bad";
  }, [subStatus]);

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs text-white/55">Settings</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Plans & Billing</h1>
        <p className="mt-2 text-sm text-white/70">
          Billing controls access — enforcement happens server-side. This page reflects your current system state.
        </p>
      </div>

      {activating && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Activating your plan…</div>
              <div className="mt-1 text-xs text-white/70">This usually takes a few seconds.</div>
            </div>
            <StatusPill label={`Activating → ${activationTarget || "starter"}`} tone="warn" />
          </div>
        </div>
      )}

      {billingIssue && (
        <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-amber-100">
                Payment issue — update billing to restore Starter/Pro features.
              </div>
              <div className="mt-1 text-xs text-amber-100/80">
                While Stripe shows past-due, the effective plan is Free until it becomes active again.
              </div>
            </div>
            <button
              onClick={openPortal}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Manage billing
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
          <div className="text-sm font-medium text-rose-100">Couldn’t complete that action</div>
          <div className="mt-1 text-xs text-rose-100/80">{err}</div>
        </div>
      )}

      {linked === false ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Link required</h2>
          <p className="mt-2 text-sm text-white/70">
            This account isn’t linked to a workspace yet. Link your phone to manage billing.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/app/link-phone?next=/app/settings/billing"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Link phone
            </a>
            <button
              onClick={() => refreshStatus()}
              className="rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">{headline}</h2>
                <StatusPill label={subStatus ? subStatus.toUpperCase() : "—"} tone={statusTone} />
                <StatusPill label={`Effective: ${effectivePlan}`} />
              </div>

              <div className="mt-3 text-sm text-white/70">
                {effectivePlan !== "free" && periodEnd ? (
                  <>
                    Current period ends <span className="text-white/90">{periodEnd}</span>.
                  </>
                ) : (
                  <>You’re in Free mode. Upgrade only when a gate matters.</>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => refreshStatus()}
                  className="rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
                >
                  Refresh
                </button>

                <button
                  onClick={openPortal}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                  title="Opens Stripe billing portal"
                >
                  Manage billing
                </button>
              </div>

              <div className="mt-4 text-xs text-white/50">
                You can always export your records. Paid plans are for speed, answers, and control — not lock-in.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-white/60">Plan details</div>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Plan key</span>
                  <span className="font-medium">{planKey}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Effective</span>
                  <span className="font-medium">{effectivePlan}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {(["free", "starter", "pro"] as const).map((k) => {
              const ui = PLAN_UI[k];
              const isCurrent = effectivePlan === k;
              const isPreferred = preferredPlan === k;

              return (
                <div
                  key={k}
                  className={[
                    "rounded-2xl border p-5",
                    isCurrent ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5",
                    isPreferred && !isCurrent ? "ring-1 ring-white/20" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/70">{ui.badge}</div>
                      <div className="mt-1 text-lg font-semibold">{ui.label}</div>
                    </div>
                    {isCurrent ? <StatusPill label="Current" tone="good" /> : <StatusPill label={ui.price} />}
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-white/75">
                    {ui.highlights.map((h) => (
                      <li key={h} className="flex gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-white/40" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5">
                    {k === "free" ? (
                      isCurrent ? (
                        <button
                          disabled
                          className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/50"
                        >
                          Current
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={openPortal}
                            disabled={activating}
                            className="w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60"
                          >
                            Switch to Free
                          </button>
                          <div className="mt-2 text-xs text-white/50">
                            Free is applied by cancelling/downgrading in Stripe (portal).
                          </div>
                        </>
                      )
                    ) : (
                      <button
                        onClick={() => startCheckout(k)}
                        disabled={isCurrent || activating}
                        className={[
                          "w-full rounded-xl px-4 py-2 text-sm font-medium",
                          isCurrent || activating
                            ? "cursor-not-allowed border border-white/10 bg-white/5 text-white/50"
                            : "bg-white text-black hover:bg-white/90",
                        ].join(" ")}
                      >
                        {k === "starter" ? "Upgrade to Starter" : "Upgrade to Pro"}
                      </button>
                    )}

                    {k !== "free" && (
                      <div className="mt-2 text-xs text-white/50">
                        You’ll see “Activating…” briefly after checkout while the plan updates.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-medium">Notes</div>
            <div className="mt-2 text-sm text-white/70">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  If Stripe shows <span className="text-white/90">past_due</span>, the effective plan becomes{" "}
                  <span className="text-white/90">Free</span> until the subscription is active again.
                </li>
                <li>Enforcement is server-side. This UI reflects your effective plan.</li>
                <li>If “Activating…” persists, click <span className="text-white/90">Manage billing</span> or refresh.</li>
              </ul>
            </div>
          </div>

          {loading && <div className="mt-6 text-sm text-white/60">Loading billing status…</div>}
        </>
      )}
    </div>
  );
}