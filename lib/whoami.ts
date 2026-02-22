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

export async function fetchWhoami(): Promise<{
  ok: boolean;
  userId?: string;
  tenantId?: string;
  hasWhatsApp?: boolean;
  error?: string;
}> {
  // ✅ allow brief hydration time after login + navigation
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

  // 2) If 401, try a single refresh (covers token drift / stale session)
  if (r.status === 401) {
    try {
      const refreshed = await supabase.auth.refreshSession();
      const freshToken = refreshed?.data?.session?.access_token || "";
      if (freshToken) {
        token = freshToken;
        ({ r, j } = await callWhoami(token));
      }
    } catch {
      // ignore, fall through to normalized error
    }
  }

  // ✅ normalize server error shapes:
  if (!r.ok || !j?.ok) {
    const msg =
      j?.message ||
      j?.error ||
      (j?.code ? `${j.code}` : "") ||
      `whoami_${r.status}`;
    return { ok: false, error: msg };
  }

  return j;
}