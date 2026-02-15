// chiefos-site/app/app/settings/billing/BillingClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
      stripe_customer_id?: boolean | null;
    };

const STATUS_URL = "/api/billing/status";
const CHECKOUT_URL = "/api/billing/checkout";
const PORTAL_URL = "/api/billing/portal";

const PLAN_UI = {
  free: {
    label: "Free",
    badge: "Field Capture",
    price: "$0",
    highlights: [
      "Jobs: up to 3",
      "Employees: up to 3 (owner-managed)",
      "Exports: allowed with watermark",
      "Crew self-logging: not included",
    ],
  },
  starter: {
    label: "Starter",
    badge: "Owner Mode",
    price: "$59/mo",
    highlights: [
      "Jobs: up to 25",
      "Employees: up to 10 (owner-managed)",
      "Exports: no watermark",
      "Crew self-logging: not included",
    ],
  },
  pro: {
    label: "Pro",
    badge: "Crew + Control",
    price: "$149/mo",
    highlights: [
      "Jobs: unlimited",
      "Employees: up to 25",
      "Exports: no watermark",
      "Crew self-logging: included",
    ],
  },
} as const;

function fmtDateFromUnixSeconds(sec?: number | null) {
  if (!sec || !Number.isFinite(sec)) return null;
  try {
    return new Date(sec * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  if (init?.body && !headers.get("Content-Type")) headers.set("Content-Type", "application/json");

  const resp = await fetch(url, { ...init, headers, cache: "no-store", credentials: "include" });

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

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${cls}`}>
      {label}
    </span>
  );
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

  async function refreshStatus() {
    setErr(null);
    try {
      const out = await apiFetchJSON<BillingStatus>(STATUS_URL, { method: "GET" });
      setStatus(out);
      return out;
    } catch (e: any) {
      const msg = String(e?.message || "Failed to load billing status");
      // ✅ minimal routing behavior (prevents support tickets)
      if (msg.toLowerCase().includes("missing dashboard token")) {
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
        setActivating(false);
        setActivationTarget(null);
        stopPolling();
        return;
      }

      if (Date.now() - startedAt >= maxMs) {
        setActivating(false);
        setActivationTarget(null);
        stopPolling();
        setErr(
          "Payment received, but plan activation is still propagating. If this doesn’t update in a minute, click “Manage Billing” or refresh."
        );
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
    const hasSession = !!sp.get("session_id");
    if (!hasSession) return;

    const target = (preferredPlan || "starter") as "starter" | "pro";
    startPolling(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, preferredPlan]);

  async function startCheckout(planKey: "starter" | "pro") {
    setErr(null);
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
      setActivating(false);
      setActivationTarget(null);
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-2 text-sm text-white/70">
            Plan state is enforced server-side. If Stripe is updating, you’ll see “Activating…” briefly.
          </p>
        </div>

        {activating && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Payment received. Activating your plan…</div>
                <div className="mt-1 text-xs text-white/70">This usually takes ~10 seconds.</div>
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
                  Your effective plan is currently Free until Stripe marks the subscription active again.
                </div>
              </div>
              <button
                onClick={openPortal}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
              >
                Manage Billing
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
              This account isn’t linked to a tenant yet. Link your phone to access billing.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="/app/link-phone?next=/app/settings/billing"
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
              >
                Link Phone
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
                  <StatusPill
                    label={subStatus ? subStatus.toUpperCase() : "—"}
                    tone={
                      subStatus === "active" || subStatus === "trialing"
                        ? "good"
                        : subStatus === "past_due"
                          ? "warn"
                          : subStatus
                            ? "bad"
                            : "neutral"
                    }
                  />
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
                    Manage Billing
                  </button>
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
                        <button
                          onClick={() => startCheckout("starter")}
                          disabled={activating}
                          className="w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60"
                        >
                          Upgrade to Starter
                        </button>
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
                          Webhook is authoritative. You’ll see “Activating…” after checkout.
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
                    If your status is <span className="text-white/90">past_due</span>, your effective plan becomes{" "}
                    <span className="text-white/90">free</span> until Stripe marks the subscription{" "}
                    <span className="text-white/90">active</span> again.
                  </li>
                  <li>All enforcement happens server-side. UI reflects the server’s effective plan.</li>
                  <li>
                    If “Activating…” persists, click <span className="text-white/90">Manage Billing</span> or refresh.
                  </li>
                </ul>
              </div>
            </div>

            {loading && <div className="mt-6 text-sm text-white/60">Loading billing status…</div>}
          </>
        )}
      </div>
    </div>
  );
}
