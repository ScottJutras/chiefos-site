import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During Vercel build/prerender, env vars can be missing if not configured yet.
  // Don't crash the build. Only require them when the client is actually used.
  if (!url || !anon) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
    );
  }

  _client = createClient(url, anon);
  return _client;
}

// Backwards compat with your existing imports:
// import { supabase } from "@/lib/supabase";
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getSupabaseClient() as any;
    const v = c[prop];
    return typeof v === "function" ? v.bind(c) : v;
  },
});

