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

function getClientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

export async function POST(req: Request) {
  try {
    const accessToken = bearerFromReq(req);
    if (!accessToken) {
      return json(401, { ok: false, error: "Missing session." });
    }

    const body = await req.json().catch(() => ({}));

    const termsAcceptedAt = clean(body?.termsAcceptedAt);
    const privacyAcceptedAt = clean(body?.privacyAcceptedAt);
    const aiPolicyAcceptedAt = clean(body?.aiPolicyAcceptedAt);
    const dpaAcknowledgedAt = clean(body?.dpaAcknowledgedAt);

    const termsVersion = clean(body?.termsVersion);
    const privacyVersion = clean(body?.privacyVersion);
    const aiPolicyVersion = clean(body?.aiPolicyVersion);
    const dpaVersion = clean(body?.dpaVersion);

    const acceptedVia = clean(body?.acceptedVia) || "signup";

    if (
      !termsAcceptedAt ||
      !privacyAcceptedAt ||
      !aiPolicyAcceptedAt ||
      !dpaAcknowledgedAt ||
      !termsVersion ||
      !privacyVersion ||
      !aiPolicyVersion ||
      !dpaVersion
    ) {
      return json(400, { ok: false, error: "Missing legal acceptance fields." });
    }

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
    const serviceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authErr } = await admin.auth.getUser(accessToken);
    if (authErr || !authData?.user?.id) {
      return json(401, { ok: false, error: "Invalid session." });
    }

    const authUserId = String(authData.user.id);

    const { data: portalUser, error: portalErr } = await admin
      .from("chiefos_portal_users")
      .select("tenant_id")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (portalErr) {
      return json(500, {
        ok: false,
        error: portalErr.message || "Failed to resolve portal membership.",
      });
    }

    const tenantId = String(portalUser?.tenant_id || "").trim();
    if (!tenantId) {
      return json(400, { ok: false, error: "Missing tenant context." });
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || null;

    const { error: upsertErr } = await admin
  .from("chiefos_legal_acceptances")
  .upsert(
    {
      tenant_id: tenantId,
      auth_user_id: authUserId,

      accepted_at: new Date().toISOString(),

      terms_accepted_at: termsAcceptedAt,
      terms_version: termsVersion,

      privacy_accepted_at: privacyAcceptedAt,
      privacy_version: privacyVersion,

      ai_policy_accepted_at: aiPolicyAcceptedAt,
      ai_policy_version: aiPolicyVersion,

      dpa_acknowledged_at: dpaAcknowledgedAt,
      dpa_version: dpaVersion,

      accepted_via: acceptedVia,
      ip_address: ipAddress,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,auth_user_id" }
  );

    if (upsertErr) {
      return json(500, { ok: false, error: upsertErr.message || "Failed to store legal acceptance." });
    }

    return json(200, {
      ok: true,
      tenantId,
      authUserId,
      termsVersion,
      privacyVersion,
      aiPolicyVersion,
      dpaVersion,
      acceptedVia,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Legal acceptance error." });
  }
}