// chiefos-site/lib/apiFetch.ts
import { supabase } from "@/lib/supabase";

/**
 * Tenant-safe API fetch helper.
 * Always attaches Supabase access_token as Bearer for backend API.
 * Fail-closed: throws on missing session.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    // Fail closed — forces UI to re-auth
    throw new Error("AUTH_REQUIRED");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${session.access_token}`);

  // Preserve caller content-type if set; otherwise default JSON for POSTs
  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  const r = await fetch(path, { ...init, headers });

  // Try to parse JSON consistently
  const text = await r.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!r.ok) {
    const code = json?.code || json?.error || "API_ERROR";
    const message = json?.message || json?.error_description || "Request failed";
    const e = new Error(`${code}: ${message}`);
    // @ts-ignore
    e.status = r.status;
    // @ts-ignore
    e.body = json;
    throw e;
  }

  return json;
}