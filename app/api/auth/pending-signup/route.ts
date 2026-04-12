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
        owner_name,
        owner_phone,
        company_name,
        country,
        province,
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

    if (action !== "consume" && action !== "set-tenant-meta") {
      return json(400, { ok: false, error: "Unsupported action." });
    }

    const admin = adminClient();
    const email = clean(auth.user.email).toLowerCase();

    if (action === "set-tenant-meta") {
      // Push country + province from pending signup → chiefos_tenants
      const { data: pending } = await admin
        .from("chiefos_pending_signups")
        .select("country, province, owner_phone, requested_plan_key")
        .eq("email", email)
        .maybeSingle();

      if (!pending?.country && !pending?.province && !pending?.owner_phone) {
        return json(200, { ok: true, skipped: true });
      }

      const { data: pu } = await admin
        .from("chiefos_portal_users")
        .select("tenant_id")
        .eq("user_id", auth.user.id)
        .limit(1)
        .maybeSingle();

      if (!pu?.tenant_id) {
        return json(404, { ok: false, error: "Tenant not found." });
      }

      const update: Record<string, any> = {};
      if (pending.country) update.country = pending.country;
      if (pending.province) update.province = pending.province;
      if (pending.owner_phone) update.owner_id = pending.owner_phone;

      const { error: updErr } = await admin
        .from("chiefos_tenants")
        .update(update)
        .eq("id", pu.tenant_id);

      if (updErr) {
        return json(500, { ok: false, error: updErr.message || "Failed to update tenant meta." });
      }

      // Seed public.users row so the jobs FK constraint is satisfied.
      // Normally created when owner first messages via WhatsApp; portal
      // signups with a phone number need to bootstrap it here instead.
      if (pending.owner_phone) {
        const planKey = clean(pending.requested_plan_key).toLowerCase();
        const normalizedPlan =
          planKey.includes("pro") ? "pro" :
          planKey.includes("starter") ? "starter" : "free";

        await admin.from("users").upsert(
          {
            user_id: pending.owner_phone,
            owner_id: pending.owner_phone,
            plan_key: normalizedPlan,
            country: pending.country ?? null,
            province: pending.province ?? null,
            created_at: new Date().toISOString(),
          },
          { onConflict: "user_id", ignoreDuplicates: true }
        ).then(() => null).catch(() => null); // best-effort — don't block signup on failure
      }

      return json(200, { ok: true });
    }

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