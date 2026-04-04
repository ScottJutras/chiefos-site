// app/api/settings/email-capture/route.ts
// GET  → { capture_address, token, monthly_used, monthly_cap }
// POST → generate / rotate capture token (owner only)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const revalidate = 0;

const EMAIL_CAPTURE_DOMAIN =
  process.env.EMAIL_CAPTURE_DOMAIN || "mail.usechiefos.com";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getPortalContext(req: Request) {
  const raw   = req.headers.get("authorization") || "";
  const token = raw.toLowerCase().startsWith("bearer ")
    ? raw.slice(7).trim()
    : "";
  if (!token) return { ok: false as const, error: "Missing bearer token." };

  const admin = adminClient();
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user?.id)
    return { ok: false as const, error: "Invalid session." };

  const authUserId = String(authData.user.id);
  const { data: pu, error: puErr } = await admin
    .from("chiefos_portal_users")
    .select("tenant_id, role")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (puErr || !pu?.tenant_id)
    return { ok: false as const, error: puErr?.message || "Missing tenant." };

  const { data: tenant, error: tenantErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id, plan, email_capture_token")
    .eq("id", pu.tenant_id)
    .single();

  if (tenantErr || !tenant?.owner_id)
    return { ok: false as const, error: "Missing owner context." };

  return {
    ok:        true as const,
    admin,
    authUserId,
    tenantId:  String(pu.tenant_id),
    ownerId:   String(tenant.owner_id),
    role:      String(pu.role || ""),
    plan:      String(tenant.plan || "free").toLowerCase(),
    token:     (tenant.email_capture_token as string | null) ?? null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthlyCap(plan: string): number | null {
  if (plan === "pro")     return null;  // unlimited
  if (plan === "starter") return 30;
  return 0; // free: disabled
}

async function getMonthlyUsed(
  admin: ReturnType<typeof adminClient>,
  tenantId: string
): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const { count } = await admin
    .from("email_ingest_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", start.toISOString())
    .then((r) => ({ count: (r.count ?? 0) as number }));

  return count;
}

/** Generate a random 16-char hex token. */
function randomHexToken(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const ctx = await getPortalContext(req);
  if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

  const { admin, tenantId, plan } = ctx;
  let captureToken = ctx.token;

  // Auto-generate if missing (shouldn't happen after migration backfill)
  if (!captureToken) {
    captureToken = randomHexToken();
    await admin
      .from("chiefos_tenants")
      .update({ email_capture_token: captureToken })
      .eq("id", tenantId);
  }

  const cap        = monthlyCap(plan);
  const monthlyUsed = await getMonthlyUsed(admin, tenantId);

  return json(200, {
    ok:              true,
    capture_address: `${captureToken}@${EMAIL_CAPTURE_DOMAIN}`,
    token:           captureToken,
    monthly_used:    monthlyUsed,
    monthly_cap:     cap,
    plan,
  });
}

// ─── POST (rotate) ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const ctx = await getPortalContext(req);
  if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

  if (ctx.role !== "owner") {
    return json(403, { ok: false, error: "Only the owner can rotate the capture address." });
  }

  const { admin, tenantId, plan } = ctx;
  const newToken = randomHexToken();

  const { error } = await admin
    .from("chiefos_tenants")
    .update({ email_capture_token: newToken })
    .eq("id", tenantId);

  if (error) {
    return json(500, { ok: false, error: "Failed to rotate token." });
  }

  const cap         = monthlyCap(plan);
  const monthlyUsed = await getMonthlyUsed(admin, tenantId);

  return json(200, {
    ok:              true,
    capture_address: `${newToken}@${EMAIL_CAPTURE_DOMAIN}`,
    token:           newToken,
    monthly_used:    monthlyUsed,
    monthly_cap:     cap,
    plan,
  });
}
