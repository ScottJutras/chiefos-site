import { supabase } from "@/lib/supabase";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAccessTokenWithRetry(opts?: { timeoutMs?: number; intervalMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 2000;
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
  // ✅ Key fix: allow brief hydration time after setSession + navigation
  const token = await getAccessTokenWithRetry({ timeoutMs: 2500, intervalMs: 150 });

  if (!token) return { ok: false, error: "no-session-token" };

  const r = await fetch("/api/whoami", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: j?.error || `whoami_${r.status}` };

  return j;
}