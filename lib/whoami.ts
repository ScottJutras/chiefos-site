// lib/whoami.ts
import { supabase } from "@/lib/supabase";

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
      // ignore and retry
    }
    await sleep(intervalMs);
  }

  return "";
}

export type BetaPlan = "free" | "starter" | "pro";
export type BetaStatus = "requested" | "approved" | "denied";

export type WhoamiOk = {
  ok: true;
  userId: string;
  tenantId: string | null;
  hasWhatsApp: boolean;
  email: string | null;

  // canonical paid plan
  planKey: BetaPlan | null;

  // beta-compatible fields
  betaPlan: BetaPlan | null;
  betaStatus: BetaStatus | null;
  betaEntitlementPlan: BetaPlan | null;
};

export async function fetchWhoami(): Promise<WhoamiOk | { ok: false; error: string; status?: number; }> {
  let token = await getAccessTokenWithRetry({ timeoutMs: 2500, intervalMs: 150 });
  if (!token) return { ok: false, error: "no-session-token" };

  async function callWhoami(t: string) {
    const r = await fetch("/api/whoami", {
      method: "GET",
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const j: any = await r.json().catch(() => ({}));
    return { r, j };
  }

  // 1) First attempt
  let { r, j } = await callWhoami(token);

  // 2) If 401, try a single refresh
  if (r.status === 401) {
    try {
      const refreshed = await supabase.auth.refreshSession();
      const freshToken = refreshed?.data?.session?.access_token || "";
      if (freshToken) {
        token = freshToken;
        ({ r, j } = await callWhoami(token));
      }
    } catch {
      // ignore
    }
  }

  if (!r.ok || !j?.ok) {
    const code = j?.code ? String(j.code) : "";
    const message = j?.message ? String(j.message) : "";
    const fallback = j?.error ? String(j.error) : `whoami_${r.status}`;
    return { ok: false, error: code || message || fallback, status: r.status, };
  }

  // ✅ IMPORTANT: return the full contract (do not “pick” fields)
  return {
    ok: true,
    userId: String(j.userId || ""),
    tenantId: j.tenantId ? String(j.tenantId) : null,
    hasWhatsApp: !!j.hasWhatsApp,
    email: j.email ?? null,

    planKey: j.planKey ?? null,

    betaPlan: j.betaPlan ?? null,
    betaStatus: j.betaStatus ?? null,
    betaEntitlementPlan: j.betaEntitlementPlan ?? null,
  };
}