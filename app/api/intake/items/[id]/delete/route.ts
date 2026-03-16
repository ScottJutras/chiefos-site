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
  const raw = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
}

function adminClient() {
  return createClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getPortalContext(req: Request) {
  const token = bearerFromReq(req);
  if (!token) return { ok: false as const, error: "Missing bearer token." };

  const admin = adminClient();

  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user?.id) {
    return { ok: false as const, error: "Invalid session." };
  }

  const authUserId = String(authData.user.id);

  const { data: pu, error: puErr } = await admin
    .from("chiefos_portal_users")
    .select("tenant_id, role, created_at")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (puErr) return { ok: false as const, error: puErr.message || "Failed to resolve membership." };
  if (!pu?.tenant_id) return { ok: false as const, error: "Missing tenant context." };

  const tenantId = String(pu.tenant_id);
  const role = String(pu.role || "");

  const { data: tenant, error: tenantErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantErr || !tenant?.owner_id) {
    return { ok: false as const, error: tenantErr?.message || "Missing owner context." };
  }

  return {
    ok: true as const,
    admin,
    authUserId,
    tenantId,
    ownerId: String(tenant.owner_id),
    role,
  };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPortalContext(req);
    if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

    if (!(ctx.role === "owner" || ctx.role === "admin" || ctx.role === "board")) {
      return json(403, {
        ok: false,
        error: "Owner-only or approver-only action.",
        code: "PERMISSION_DENIED",
      });
    }

    const params = await context.params;
    const itemId = String(params.id || "").trim();
    if (!itemId) return json(400, { ok: false, error: "Missing item id." });

    const body = await req.json().catch(() => ({}));
    const comment = String(body?.comment || "").trim() || "Upload removed from active queue by portal user.";

    const { data: item, error: itemErr } = await ctx.admin
      .from("intake_items")
      .select("id, tenant_id, owner_id, status, batch_id, storage_bucket, storage_path, source_filename")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId)
      .maybeSingle();

    if (itemErr) {
      return json(500, { ok: false, error: itemErr.message || "Failed to load intake item." });
    }

    if (!item) {
      return json(404, { ok: false, error: "Intake item not found." });
    }

    if (String(item.status || "") === "deleted") {
      return json(200, {
        ok: true,
        alreadyDeleted: true,
        itemId,
        message: "Upload was already removed from the active queue.",
      });
    }

    const { error: updateErr } = await ctx.admin
      .from("intake_items")
      .update({
        status: "deleted",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId);

    if (updateErr) {
      return json(500, { ok: false, error: updateErr.message || "Failed to delete intake item." });
    }

    const { error: reviewErr } = await ctx.admin
      .from("intake_item_reviews")
      .insert({
        intake_item_id: itemId,
        tenant_id: ctx.tenantId,
        owner_id: ctx.ownerId,
        reviewed_by_auth_user_id: ctx.authUserId,
        action: "delete",
        before_payload: {
          prior_status: item.status || null,
          storage_bucket: item.storage_bucket || null,
          storage_path: item.storage_path || null,
          source_filename: item.source_filename || null,
        },
        after_payload: {
          status: "deleted",
        },
        comment,
      });

    if (reviewErr) {
      return json(500, { ok: false, error: reviewErr.message || "Failed to write delete audit row." });
    }

    return json(200, {
      ok: true,
      itemId,
      message: "Upload removed from the active queue.",
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Delete failed." });
  }
}