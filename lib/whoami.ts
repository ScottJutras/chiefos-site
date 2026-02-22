import { supabase } from "@/lib/supabase";

export async function fetchWhoami(): Promise<{
  ok: boolean;
  userId?: string;
  tenantId?: string;
  hasWhatsApp?: boolean;
  error?: string;
}> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token || "";

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