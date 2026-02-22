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
      // ignore
    }
    await sleep(intervalMs);
  }
  return "";
}

export async function fetchRevenueList(): Promise<{
  ok: boolean;
  tenantId?: string;
  rows?: any[];
  error?: string;
}> {
  const token = await getAccessTokenWithRetry();
  if (!token) return { ok: false, error: "no-session-token" };

  const r = await fetch("/api/revenue/list", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) {
    return { ok: false, error: j?.error || j?.message || `revenue_${r.status}` };
  }
  return j;
}