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
      current_period_start?: number | null;
      current_period_end?: number | null;
      stripe_customer_id?: string | null;
    };

const STATUS_URL = "/app/settings/billing/status";
const CHECKOUT_URL = "/app/settings/billing/checkout";
const PORTAL_URL = "/app/settings/billing/portal";

const C = {
  gold: "#D4A853",
  goldFaint: "rgba(212,168,83,0.08)",
  goldBorder: "rgba(212,168,83,0.25)",
  goldBorderStrong: "rgba(212,168,83,0.5)",
  bg: "#0C0B0A",
  bgCard: "#0F0E0C",
  bgCardAlt: "#111009",
  text: "#E8E2D8",
  textMuted: "#A8A090",
  textFaint: "#706A60",
  border: "rgba(212,168,83,0.15)",
};

const PLAN_UI = {
  free: {
    label: "Free",
    badge: "Field Capture",
    price: "$0",
    period: "forever",
    highlights: [
      "Web & WhatsApp portals",
      "Conversational logging: text only",
      "Ask Chief: 10 questions / month",
      "Up to 3 active jobs · 3 employees",
      "Expense & revenue logging",
      "Time clock & labour hours",
      "Tasks, reminders & mileage",
      "CSV export · 90-day history",
    ],
  },
  starter: {
    label: "Starter",
    badge: "Owner Mode",
    price: "$59",
    period: "per month",
    highlights: [
      "Web & WhatsApp portals",
      "Conversational logging: text & audio",
      "Ask Chief: 250 questions / month",
      "Up to 25 active jobs · 10 employees",
      "Everything in Free, plus:",
      "Receipt scanner (OCR)",
      "Documents builder — quotes, contracts, invoices & more",
      "Job site photo storage & notes",
      "Bulk imports",
      "Exports: PDF, CSV, XLS · 3-year history",
    ],
  },
  pro: {
    label: "Pro",
    badge: "Crew + Control",
    price: "$149",
    period: "per month",
    highlights: [
      "Web & WhatsApp portals",
      "Conversational logging: text & audio",
      "Ask Chief: 2,000 questions / month",
      "Unlimited jobs · 50 employees · 5 board members",
      "Everything in Starter, plus:",
      "Bulk imports (unlimited)",
      "Crew self-logging via WhatsApp",
      "Forecasting · time approvals",
      "Exports: PDF, CSV, XLS · 7-year history",
    ],
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
    } catch {}
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
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!resp.ok) {
    const raw = json?.error ?? json?.message ?? null;
    const msg = typeof raw === "string" ? raw : raw ? JSON.stringify(raw) : `Request failed (${resp.status})`;
    throw new Error(msg);
  }
  return json as T;
}

function subStatusLabel(s: string | null): string {
  if (!s || s === "free") return "Free";
  if (s === "active") return "Active";
  if (s === "trialing") return "Trial";
  if (s === "past_due") return "Payment issue";
  if (s === "canceled" || s === "cancelled") return "Canceled";
  if (s === "unpaid") return "Unpaid";
  return s.charAt(0).toUpperCase() + s.slice(1);
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
      if (
        msg.toLowerCase().includes("not_linked") ||
        msg.toLowerCase().includes("missing dashboard token") ||
        msg.toLowerCase().includes("missing owner context")
      ) {
        setStatus({ linked: false });
        return { linked: false } as BillingStatus;
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
        clearActivating();
        router.replace("/app/settings/billing");
        return;
      }
      if (Date.now() - startedAt >= maxMs) {
        clearActivating();
        setErr("Payment received, but plan activation is still propagating. Refresh in a moment or open Manage billing.");
      }
    };
    const id = window.setInterval(tick, 2500);
    window.setTimeout(tick, 800);
    pollingRef.current = { stop: () => { cancelled = true; window.clearInterval(id); } };
  }

  useEffect(() => {
    if (!hasSessionId) return;
    const target = (preferredPlan || "starter") as "starter" | "pro";
    startPolling(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSessionId, preferredPlan]);

  useEffect(() => {
    if (!activating) return;
    if (hasSessionId) return;
    const t = window.setTimeout(() => clearActivating(), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activating, hasSessionId]);

  useEffect(() => {
    const onPageShow = () => { if (!sp.get("session_id")) clearActivating(); };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const planUi = PLAN_UI[effectivePlan as keyof typeof PLAN_UI] ?? PLAN_UI.free;

  return (
    <div style={{ color: C.text, fontFamily: "var(--font-dm-sans, sans-serif)" }}>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: C.textFaint, fontFamily: "var(--font-space-mono, monospace)" }}>
          Settings
        </div>
        <h1 style={{ marginTop: 8, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: C.text }}>
          Plans &amp; Billing
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
          Upgrade anytime. Downgrade or cancel through the billing portal. Your data is always yours.
        </p>
      </div>

      {/* Activating banner */}
      {activating && (
        <div style={{ marginBottom: 20, borderRadius: 16, border: `1px solid rgba(212,168,83,0.3)`, background: "rgba(212,168,83,0.07)", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>Activating your plan…</div>
              <div style={{ marginTop: 4, fontSize: 12, color: C.textMuted }}>This usually takes a few seconds after checkout.</div>
            </div>
            <span style={{ borderRadius: 999, border: `1px solid rgba(212,168,83,0.3)`, background: "rgba(212,168,83,0.1)", padding: "4px 12px", fontSize: 11, color: C.gold, letterSpacing: "0.5px" }}>
              {activationTarget ? activationTarget.charAt(0).toUpperCase() + activationTarget.slice(1) : "Starter"}
            </span>
          </div>
        </div>
      )}

      {/* Billing issue banner */}
      {billingIssue && (
        <div style={{ marginBottom: 20, borderRadius: 16, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.08)", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#FCD34D" }}>Payment issue — update your billing to restore access.</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#FDE68A" }}>Your plan is temporarily on Free until the payment is resolved.</div>
            </div>
            <button onClick={openPortal} style={{ borderRadius: 10, background: C.gold, color: C.bg, border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Manage billing
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {err && (
        <div style={{ marginBottom: 20, borderRadius: 16, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", padding: "16px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#FCA5A5" }}>Couldn't complete that action</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#FECACA" }}>{err}</div>
        </div>
      )}

      {/* Not linked */}
      {linked === false && (
        <div style={{ marginBottom: 20, borderRadius: 12, border: C.border, background: C.goldFaint, padding: "12px 16px", fontSize: 13, color: C.textMuted }}>
          Your account isn't linked to a workspace yet — you're on Free.{" "}
          <a href="/app/link-phone?next=/app/settings/billing" style={{ color: C.gold, textDecoration: "underline" }}>
            Link your phone
          </a>{" "}
          after upgrading to activate your plan.
        </div>
      )}

      {/* Current plan summary */}
      <div style={{ marginBottom: 28, borderRadius: 20, border: C.goldBorder, background: C.bgCard, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: C.textFaint, fontFamily: "var(--font-space-mono, monospace)" }}>
              Current plan
            </div>
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700, color: C.text }}>
              {planUi.label} — {planUi.badge}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: C.textMuted }}>
              {effectivePlan !== "free" && periodEnd
                ? <>Current period ends <span style={{ color: C.text }}>{periodEnd}</span>.</>
                : "You're on the free plan. Upgrade when you want more speed, answers, and control."}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {subStatus && subStatus !== "free" && (
              <span style={{
                borderRadius: 999,
                border: subStatus === "active" || subStatus === "trialing"
                  ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(212,168,83,0.25)",
                background: subStatus === "active" || subStatus === "trialing"
                  ? "rgba(52,211,153,0.1)" : C.goldFaint,
                padding: "4px 12px",
                fontSize: 11,
                color: subStatus === "active" || subStatus === "trialing" ? "#6EE7B7" : C.gold,
                letterSpacing: "0.5px",
                fontFamily: "var(--font-space-mono, monospace)",
              }}>
                {subStatusLabel(subStatus)}
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => refreshStatus()}
            style={{ borderRadius: 10, border: C.goldBorder, background: "transparent", color: C.textMuted, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Refresh
          </button>
          <button
            onClick={openPortal}
            style={{ borderRadius: 10, background: C.gold, color: C.bg, border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Manage billing
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: C.textFaint }}>
          Your records are always exportable — paid plans are for speed, answers, and control, not lock-in.
        </div>
      </div>

      {/* Plan tier cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 8 }}>
        {(["free", "starter", "pro"] as const).map((k) => {
          const ui = PLAN_UI[k];
          const isCurrent = effectivePlan === k;
          const isHighlighted = k === "starter" && effectivePlan === "free";

          return (
            <div
              key={k}
              style={{
                borderRadius: 20,
                border: isCurrent
                  ? `1.5px solid ${C.goldBorderStrong}`
                  : isHighlighted
                    ? `1px solid ${C.goldBorder}`
                    : `1px solid ${C.border}`,
                background: isCurrent ? "rgba(212,168,83,0.07)" : C.bgCard,
                padding: 22,
                position: "relative",
                boxShadow: isCurrent ? `0 0 0 1px rgba(212,168,83,0.1) inset` : "none",
              }}
            >
              {isCurrent && (
                <div style={{
                  position: "absolute", top: -12, left: 18,
                  borderRadius: 999, border: `1px solid ${C.goldBorder}`, background: C.bg,
                  padding: "3px 12px", fontSize: 11, color: C.gold, letterSpacing: "0.5px",
                  fontFamily: "var(--font-space-mono, monospace)",
                }}>
                  Current plan
                </div>
              )}

              <div style={{ fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: C.textFaint, fontFamily: "var(--font-space-mono, monospace)" }}>
                {ui.badge}
              </div>
              <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700, color: C.text }}>{ui.label}</div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: isCurrent ? C.gold : C.text }}>{ui.price}</span>
                <span style={{ fontSize: 12, color: C.textFaint }}>{ui.period}</span>
              </div>

              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                {ui.highlights.map((h) => (
                  <div key={h} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{
                      marginTop: 4, flexShrink: 0,
                      width: 6, height: 6, borderRadius: "50%",
                      background: isCurrent ? C.gold : "rgba(212,168,83,0.4)",
                    }} />
                    <span style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{h}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 22 }}>
                {k === "free" ? (
                  isCurrent ? (
                    <button disabled style={{
                      width: "100%", borderRadius: 10, border: C.border,
                      background: "transparent", color: C.textFaint,
                      padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "not-allowed",
                    }}>
                      Current plan
                    </button>
                  ) : (
                    <>
                      <button onClick={openPortal} disabled={activating} style={{
                        width: "100%", borderRadius: 10, border: C.goldBorder,
                        background: C.goldFaint, color: C.gold,
                        padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: activating ? "not-allowed" : "pointer",
                        opacity: activating ? 0.6 : 1,
                      }}>
                        Switch to Free
                      </button>
                      <div style={{ marginTop: 8, fontSize: 11, color: C.textFaint }}>
                        Cancel your subscription through the billing portal.
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <button
                      onClick={() => startCheckout(k)}
                      disabled={isCurrent || activating}
                      style={{
                        width: "100%", borderRadius: 10, border: "none",
                        background: isCurrent || activating ? "rgba(212,168,83,0.12)" : C.gold,
                        color: isCurrent || activating ? C.textFaint : C.bg,
                        padding: "10px 16px", fontSize: 13, fontWeight: 600,
                        cursor: isCurrent || activating ? "not-allowed" : "pointer",
                      }}
                    >
                      {isCurrent ? "Current plan" : k === "starter" ? "Upgrade to Starter" : "Upgrade to Pro"}
                    </button>
                    {!isCurrent && (
                      <div style={{ marginTop: 8, fontSize: 11, color: C.textFaint }}>
                        You'll see a brief "Activating…" notice after checkout.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div style={{ marginTop: 24, fontSize: 13, color: C.textFaint }}>Loading billing status…</div>
      )}
    </div>
  );
}
