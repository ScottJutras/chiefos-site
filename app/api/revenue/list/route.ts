import { NextResponse } from "next/server";

/**
 * Portal API rule:
 * - Auth comes from Supabase JWT in Authorization header
 * - Tenant is resolved server-side from chiefos_portal_users membership
 * - tenantId is OPTIONAL and only used to disambiguate if user has multiple tenants
 */

async function getSupabaseUserId(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.id ?? null;
}

type PortalMembership = { user_id: string; tenant_id: string; role?: string };

async function getTenantsForUser(userId: string): Promise<PortalMembership[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(
    `${url}/rest/v1/chiefos_portal_users?select=user_id,tenant_id,role&user_id=eq.${encodeURIComponent(
      userId
    )}&order=created_at.asc`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
  );
  if (!r.ok) return [];
  const rows = await r.json();
  return Array.isArray(rows) ? (rows as PortalMembership[]) : [];
}

async function tenantToOwnerId(tenantId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(
    `${url}/rest/v1/chiefos_tenants?select=owner_id&id=eq.${encodeURIComponent(
      tenantId
    )}&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  const ownerId = rows?.[0]?.owner_id ?? null;
  return ownerId ? String(ownerId) : null;
}

function extractBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

export async function GET(req: Request) {
  try {
    const accessToken = extractBearerToken(req);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const userId = await getSupabaseUserId(accessToken);
    if (!userId) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const memberships = await getTenantsForUser(userId);
    if (memberships.length === 0) {
      return NextResponse.json(
        {
          error:
            "No tenant membership found for this user (chiefos_portal_users).",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedTenantId = String(searchParams.get("tenantId") || "").trim();

    // Resolve tenant:
    // - if user has 1 membership, use it (ignore tenantId)
    // - if user has multiple, tenantId is required (or we can error with list)
    let tenantId: string | null = null;

    if (memberships.length === 1) {
      tenantId = memberships[0].tenant_id;
    } else {
      if (!requestedTenantId) {
        return NextResponse.json(
          {
            error:
              "Multiple tenants available for this user. Provide tenantId.",
            tenants: memberships.map((m) => ({ tenant_id: m.tenant_id, role: m.role })),
          },
          { status: 400 }
        );
      }
      const ok = memberships.some((m) => m.tenant_id === requestedTenantId);
      if (!ok) {
        return NextResponse.json(
          { error: "Not allowed for this tenant." },
          { status: 403 }
        );
      }
      tenantId = requestedTenantId;
    }

    const ownerId = await tenantToOwnerId(tenantId);
    if (!ownerId) {
      return NextResponse.json(
        { error: "Tenant is not linked to an owner_id yet (chiefos_tenants)." },
        { status: 500 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const r = await fetch(
      `${url}/rest/v1/transactions?select=id,date,amount,amount_cents,source,description,job,job_name,created_at,kind,category&owner_id=eq.${encodeURIComponent(
        ownerId
      )}&kind=eq.revenue&order=date.desc,created_at.desc&limit=200`,
      { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
    );

    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Supabase read failed: ${t}`);
    }

    const rows = await r.json();
    return NextResponse.json({ ok: true, tenantId, ownerId, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error." }, { status: 500 });
  }
}