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
    const params = await context.params;

    console.info("[INTAKE_ITEM_DELETE_ROUTE_HIT]", {
      url: req.url,
      itemIdFromParams: params?.id || null,
    });

    const ctx = await getPortalContext(req);
    if (!ctx.ok) {
      console.warn("[INTAKE_ITEM_DELETE_UNAUTHORIZED]", {
        url: req.url,
        error: ctx.error,
      });
      return json(401, { ok: false, error: ctx.error });
    }

    if (!(ctx.role === "owner" || ctx.role === "admin" || ctx.role === "board")) {
      console.warn("[INTAKE_ITEM_DELETE_FORBIDDEN]", {
        url: req.url,
        role: ctx.role,
      });
      return json(403, {
        ok: false,
        error: "Owner-only or approver-only action.",
        code: "PERMISSION_DENIED",
      });
    }

    const itemId = String(params?.id || "").trim();
    if (!itemId) return json(400, { ok: false, error: "Missing item id." });

    const body = await req.json().catch(() => ({}));
    const comment =
      String(body?.comment || "").trim() ||
      "Upload removed from active queue by portal user.";

    const { data: itemAnyTenant, error: itemAnyTenantErr } = await ctx.admin
      .from("intake_items")
      .select("id, tenant_id, owner_id, status, batch_id, storage_bucket, storage_path, source_filename")
      .eq("id", itemId)
      .maybeSingle();

    if (itemAnyTenantErr) {
      console.error("[INTAKE_ITEM_DELETE_LOOKUP_ERR]", {
        itemId,
        tenantId: ctx.tenantId,
        error: itemAnyTenantErr.message || "Failed to load intake item.",
      });
      return json(500, {
        ok: false,
        error: itemAnyTenantErr.message || "Failed to load intake item.",
      });
    }

    if (!itemAnyTenant) {
      console.warn("[INTAKE_ITEM_DELETE_NOT_FOUND]", {
        itemId,
        tenantId: ctx.tenantId,
      });
      return json(404, {
        ok: false,
        error: "Intake item not found.",
        code: "ITEM_NOT_FOUND",
        itemId,
      });
    }

    if (String(itemAnyTenant.tenant_id || "") !== ctx.tenantId) {
      console.warn("[INTAKE_ITEM_DELETE_TENANT_MISMATCH]", {
        itemId,
        tenantId: ctx.tenantId,
        itemTenantId: String(itemAnyTenant.tenant_id || ""),
      });
      return json(403, {
        ok: false,
        error: "Item exists but does not belong to this tenant context.",
        code: "TENANT_MISMATCH",
        itemId,
        tenantId: ctx.tenantId,
        itemTenantId: String(itemAnyTenant.tenant_id || ""),
      });
    }

    const item = itemAnyTenant;

    // Use a schema-safe terminal status that already exists in intake_items_status_check.
    // This removes the item from the active queue without requiring a DB constraint change.
    const REMOVED_STATUS = "skipped";

    if (String(item.status || "") === REMOVED_STATUS) {
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
        status: REMOVED_STATUS,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId);

    if (updateErr) {
      console.error("[INTAKE_ITEM_DELETE_UPDATE_ERR]", {
        itemId,
        tenantId: ctx.tenantId,
        error: updateErr.message || "Failed to delete intake item.",
      });
      return json(500, { ok: false, error: updateErr.message || "Failed to delete intake item." });
    }

    const { error: reviewErr } = await ctx.admin
      .from("intake_item_reviews")
      .insert({
        intake_item_id: itemId,
        tenant_id: ctx.tenantId,
        owner_id: ctx.ownerId,
        reviewed_by_auth_user_id: ctx.authUserId,
        action: "skip",
        before_payload: {
          prior_status: item.status || null,
          storage_bucket: item.storage_bucket || null,
          storage_path: item.storage_path || null,
          source_filename: item.source_filename || null,
        },
        after_payload: {
          status: REMOVED_STATUS,
        },
        comment,
      });

    if (reviewErr) {
      console.error("[INTAKE_ITEM_DELETE_AUDIT_ERR]", {
        itemId,
        tenantId: ctx.tenantId,
        error: reviewErr.message || "Failed to write delete audit row.",
      });
      return json(500, { ok: false, error: reviewErr.message || "Failed to write delete audit row." });
    }

    console.info("[INTAKE_ITEM_DELETE_OK]", {
      itemId,
      tenantId: ctx.tenantId,
      status: REMOVED_STATUS,
    });

    return json(200, {
      ok: true,
      itemId,
      message: "Upload removed from the active queue.",
    });
  } catch (e: any) {
    console.error("[INTAKE_ITEM_DELETE_FATAL]", {
      message: e?.message || "Delete failed.",
    });
    return json(500, { ok: false, error: e?.message || "Delete failed." });
  }
}