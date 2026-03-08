// app/api/tester-access/activate/route.ts
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

function cleanEmail(x: any) {
  return String(x || "").trim().toLowerCase();
}

function isAllowedPlan(x: any): x is "free" | "starter" | "pro" {
  return x === "free" || x === "starter" || x === "pro";
}

export async function POST(req: Request) {
  try {
    const accessToken = bearerFromReq(req);
    if (!accessToken) {
      return json(401, { ok: false, error: "Missing session." });
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

    const authUser = authData.user;
    const authUserId = String(authUser.id);
    const email = cleanEmail(authUser.email);

    if (!email) {
      return json(400, { ok: false, error: "Authenticated user is missing email." });
    }

    // Find latest matching beta signup row by normalized email.
    const { data: betaRows, error: betaErr } = await admin
      .from("chiefos_beta_signups")
      .select("id, email, entitlement_plan, status, approved_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(5);

    if (betaErr) {
      return json(500, { ok: false, error: betaErr.message || "Failed to read beta signup." });
    }

    const beta = (betaRows || []).find((row: any) => cleanEmail(row.email) === email) || null;

    if (!beta) {
      // Safe no-op: signup can still proceed, but no tester entitlement exists.
      return json(200, {
        ok: true,
        activated: false,
        reason: "NO_BETA_SIGNUP_MATCH",
        canonicalApplied: false,
        plan: "free",
      });
    }

    const entitlementPlan = cleanEmail(beta.entitlement_plan);
    const plan = isAllowedPlan(entitlementPlan) ? entitlementPlan : "free";

    // Mark beta row activated without assuming extra columns exist.
    // Only touch status so this remains compatible with your shown schema.
    const nextStatus =
      String(beta.status || "").toLowerCase() === "activated" ? "activated" : "activated";

    const { error: betaUpdateErr } = await admin
      .from("chiefos_beta_signups")
      .update({ status: nextStatus })
      .eq("id", beta.id);

    if (betaUpdateErr) {
      return json(500, { ok: false, error: betaUpdateErr.message || "Failed to update beta signup." });
    }

    // Resolve owner mapping if it already exists.
    // IMPORTANT: do not invent owner identity here.
    const { data: linkRow, error: linkErr } = await admin
      .from("user_auth_links")
      .select("owner_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (linkErr) {
      return json(500, { ok: false, error: linkErr.message || "Failed to resolve owner link." });
    }

    const ownerId = String(linkRow?.owner_id || "").trim();
    if (!ownerId) {
      // Safe outcome: tester row is activated, but canonical owner-scoped plan
      // cannot be written yet because owner_id is unresolved.
      return json(200, {
        ok: true,
        activated: true,
        canonicalApplied: false,
        ownerLinked: false,
        plan,
      });
    }

    // Canonical plan authority is owner-scoped.
    // Apply plan only when owner link exists.
    const { error: userUpdateErr } = await admin
      .from("users")
      .update({
        plan_key: plan,
        subscription_tier: plan,
        paid_tier: plan,
      })
      .eq("owner_id", ownerId);

    if (userUpdateErr) {
      return json(500, { ok: false, error: userUpdateErr.message || "Failed to apply owner plan." });
    }

    return json(200, {
      ok: true,
      activated: true,
      canonicalApplied: true,
      ownerLinked: true,
      ownerId,
      plan,
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: e?.message || "Tester activation error.",
    });
  }
}