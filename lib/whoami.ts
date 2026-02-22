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
  // ✅ allow brief hydration time after setSession + navigation
  const token = await getAccessTokenWithRetry({ timeoutMs: 2500, intervalMs: 150 });

  if (!token) return { ok: false, error: "no-session-token" };

  const r = await fetch("/api/whoami", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const j: any = await r.json().catch(() => ({}));

  // ✅ normalize server error shapes:
  // - old: { error: "..." }
  // - new: { ok:false, code:"...", message:"..." }
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