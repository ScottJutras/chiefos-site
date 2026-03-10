import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function bearerFromReq(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

function clean(x: any) {
  return String(x || "").trim();
}

function adminClient() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getAuthedUser(req: Request) {
  const accessToken = bearerFromReq(req);
  if (!accessToken) return { error: "Missing session.", status: 401, user: null as any };

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(accessToken);

  if (error || !data?.user?.id || !data?.user?.email) {
    return { error: "Invalid session.", status: 401, user: null as any };
  }

  return { error: null, status: 200, user: data.user };
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if (auth.error) return json(auth.status, { ok: false, error: auth.error });

    const admin = adminClient();
    const email = clean(auth.user.email).toLowerCase();

    const { data, error } = await admin
      .from("chiefos_pending_signups")
      .select(`
        id,
        email,
        company_name,
        signup_mode,
        requested_plan_key,
        terms_accepted_at,
        terms_version,
        privacy_accepted_at,
        privacy_version,
        ai_policy_accepted_at,
        ai_policy_version,
        dpa_acknowledged_at,
        dpa_version,
        accepted_via,
        consumed_at,
        created_at,
        updated_at
      `)
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return json(500, { ok: false, error: error.message || "Failed to load pending signup." });
    }

    return json(200, {
      ok: true,
      pendingSignup: data || null,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Pending signup lookup failed." });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if (auth.error) return json(auth.status, { ok: false, error: auth.error });

    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action);

    if (action !== "consume") {
      return json(400, { ok: false, error: "Unsupported action." });
    }

    const admin = adminClient();
    const email = clean(auth.user.email).toLowerCase();

    const { data, error } = await admin
      .from("chiefos_pending_signups")
      .update({
        consumed_at: new Date().toISOString(),
        auth_user_id: auth.user.id,
      })
      .eq("email", email)
      .is("consumed_at", null)
      .select("id, email, consumed_at")
      .maybeSingle();

    if (error) {
      return json(500, { ok: false, error: error.message || "Failed to consume pending signup." });
    }

    return json(200, {
      ok: true,
      consumed: data || null,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Pending signup consume failed." });
  }
}