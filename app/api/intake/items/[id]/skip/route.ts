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
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

async function getPortalContext(req: Request) {
  const token = bearerFromReq(req);
  if (!token) return { ok: false as const, error: "Missing bearer token." };

  const admin = adminClient();
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user?.id) return { ok: false as const, error: "Invalid session." };

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

function toNullableText(x: any) {
  const s = String(x ?? "").trim();
  return s ? s : null;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPortalContext(req);
    if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

    const admin = ctx.admin;

    if (!(ctx.role === "owner" || ctx.role === "admin" || ctx.role === "board")) {
      return json(403, { ok: false, error: "Owner-only or approver-only action." });
    }

    const params = await context.params;
    const itemId = String(params.id || "").trim();
    if (!itemId) return json(400, { ok: false, error: "Missing item id." });

    const body = await req.json().catch(() => ({}));
    const comment = toNullableText(body?.comment);

    const { data: item, error: itemErr } = await admin
      .from("intake_items")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId)
      .single();

    if (itemErr || !item) {
      return json(404, { ok: false, error: itemErr?.message || "Intake item not found." });
    }

    const currentStatus = String(item.status || "").trim();
    if (["persisted", "confirmed"].includes(currentStatus)) {
      return json(409, {
        ok: false,
        error: "This intake item has already been confirmed and cannot be skipped.",
      });
    }

    if (currentStatus === "skipped") {
      return json(200, {
        ok: true,
        intakeItemId: itemId,
        status: "skipped",
      });
    }

    if (currentStatus === "duplicate") {
      return json(409, {
        ok: false,
        error: "This intake item is already marked duplicate and cannot also be skipped.",
      });
    }

    const { data: existingDraft, error: existingDraftErr } = await admin
      .from("intake_item_drafts")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("intake_item_id", itemId)
      .limit(1)
      .maybeSingle();

    if (existingDraftErr) {
      return json(500, {
        ok: false,
        error: existingDraftErr.message || "Failed to load draft.",
      });
    }

    const beforePayload = {
      item,
      draft: existingDraft || null,
    };

    const { error: updErr } = await admin
      .from("intake_items")
      .update({
        status: "skipped",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId);

    if (updErr) {
      return json(500, { ok: false, error: updErr.message || "Failed to skip item." });
    }

    const { error: reviewErr } = await admin
      .from("intake_item_reviews")
      .insert({
        intake_item_id: itemId,
        tenant_id: ctx.tenantId,
        owner_id: ctx.ownerId,
        reviewed_by_auth_user_id: ctx.authUserId,
        action: "skip",
        before_payload: beforePayload,
        after_payload: { status: "skipped" },
        comment,
        created_at: new Date().toISOString(),
      });

    if (reviewErr) {
      return json(500, { ok: false, error: reviewErr.message || "Failed to create review log." });
    }

    if (item.batch_id) {
      const { data: batchItems, error: batchItemsErr } = await admin
        .from("intake_items")
        .select("id,status")
        .eq("tenant_id", ctx.tenantId)
        .eq("batch_id", item.batch_id);

      if (batchItemsErr) {
        return json(500, {
          ok: false,
          error: batchItemsErr.message || "Failed to update batch progress.",
        });
      }

      const confirmedItems = (batchItems || []).filter((r) =>
        ["confirmed", "persisted"].includes(String(r.status || ""))
      ).length;
      const skippedItems = (batchItems || []).filter((r) => String(r.status || "") === "skipped").length;
      const duplicateItems = (batchItems || []).filter((r) => String(r.status || "") === "duplicate").length;

      const batchComplete =
        (batchItems || []).length > 0 &&
        (batchItems || []).every((r) =>
          ["persisted", "skipped", "duplicate", "failed"].includes(String(r.status || ""))
        );

      const { error: batchUpdErr } = await admin
        .from("intake_batches")
        .update({
          confirmed_items: confirmedItems,
          skipped_items: skippedItems,
          duplicate_items: duplicateItems,
          status: batchComplete ? "completed" : "pending_review",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", ctx.tenantId)
        .eq("id", item.batch_id);

      if (batchUpdErr) {
        return json(500, {
          ok: false,
          error: batchUpdErr.message || "Failed to update intake batch.",
        });
      }
    }

    return json(200, {
      ok: true,
      intakeItemId: itemId,
      status: "skipped",
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Skip failed." });
  }
}