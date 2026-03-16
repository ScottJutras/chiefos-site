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
    .single();

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
      return json(403, { ok: false, error: "Owner-only or approver-only action." });
    }

    const params = await context.params;
    const itemId = String(params.id || "").trim();
    if (!itemId) {
      return json(400, { ok: false, error: "Missing intake item id." });
    }

    const body = await req.json().catch(() => ({}));
    const comment = String(body?.comment || "").trim() || "Deleted from intake queue.";

    const { data: item, error: itemErr } = await ctx.admin
      .from("intake_items")
      .select("id, batch_id, storage_bucket, storage_path, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId)
      .maybeSingle();

    if (itemErr) {
      return json(500, { ok: false, error: itemErr.message || "Failed to load intake item." });
    }

    if (!item?.id) {
      return json(404, { ok: false, error: "Intake item not found." });
    }

    if (item.storage_bucket && item.storage_path) {
      const storageResult = await ctx.admin.storage
        .from(String(item.storage_bucket))
        .remove([String(item.storage_path)]);

      if (storageResult.error) {
        console.warn("[INTAKE_DELETE] storage remove failed:", storageResult.error.message);
      }
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
        },
        after_payload: {
          deleted: true,
        },
        comment,
      });

    if (reviewErr) {
      return json(500, { ok: false, error: reviewErr.message || "Failed to write delete review history." });
    }

    const { error: draftDeleteErr } = await ctx.admin
      .from("intake_item_drafts")
      .delete()
      .eq("tenant_id", ctx.tenantId)
      .eq("intake_item_id", itemId);

    if (draftDeleteErr) {
      return json(500, { ok: false, error: draftDeleteErr.message || "Failed to delete intake draft." });
    }

    const { error: itemDeleteErr } = await ctx.admin
      .from("intake_items")
      .delete()
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId);

    if (itemDeleteErr) {
      return json(500, { ok: false, error: itemDeleteErr.message || "Failed to delete intake item." });
    }

    if (item.batch_id) {
      const { count: remainingCount } = await ctx.admin
        .from("intake_items")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId)
        .eq("batch_id", String(item.batch_id));

      await ctx.admin
        .from("intake_batches")
        .update({
          total_items: Number(remainingCount || 0),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", ctx.tenantId)
        .eq("id", String(item.batch_id));
    }

    return json(200, {
      ok: true,
      deletedItemId: itemId,
      message: "Upload deleted successfully.",
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Delete failed." });
  }
}