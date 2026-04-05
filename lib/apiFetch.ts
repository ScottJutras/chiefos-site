// chiefos-site/lib/apiFetch.ts
import { supabase } from "@/lib/supabase";

/**
 * Polls getSession() until a token is available or timeout expires.
 * Needed because the Supabase client hydrates from localStorage async
 * on first render — a single getSession() call can return null even
 * when the user is fully logged in.
 */
async function getAccessToken(timeoutMs = 3000, intervalMs = 150): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      if (token) return token;
    } catch {
      // ignore transient errors
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return "";
}

/**
 * Tenant-safe API fetch helper.
 * Always attaches Supabase access_token as Bearer for backend API.
 * Fail-closed: throws on missing session.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("AUTH_REQUIRED: Missing session. Please log in again.");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  const r = await fetch(path, { ...init, headers });

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
