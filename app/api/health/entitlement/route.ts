import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type BetaStatus = "requested" | "approved" | "denied";
type BetaPlan = "free" | "starter" | "pro";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
}

async function getSupabaseUser(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const r = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!r.ok) return null;

  const j = await r.json().catch(() => null);
  if (!j?.id) return null;

  return {
    id: String(j.id),
    email: j.email ? String(j.email).trim().toLowerCase() : null,
  };
}

function normalizePlan(v: any): BetaPlan | null {
  const s = String(v || "").trim().toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const accessToken = getBearer(req);
    if (!accessToken) {
      return json(401, { ok: false, code: "AUTH_REQUIRED" });
    }

    const user = await getSupabaseUser(accessToken);
    if (!user?.id) {
      return json(401, { ok: false, code: "INVALID_SESSION" });
    }

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!service) {
      return json(500, { ok: false, code: "SERVICE_ROLE_MISSING" });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const cleanEmail = user.email;

    if (!cleanEmail) {
      return json(200, {
        ok: true,
        userId: user.id,
        email: null,
        entitlement: {
          status: null,
          plan: null,
          source: "no-email",
        },
      });
    }

    const q = new URLSearchParams();
    q.set("select", "status,entitlement_plan,plan,approved_at,email");
    q.set("email", `ilike.${cleanEmail}`);
    q.set("limit", "1");

    const endpoint = `${url.replace(/\/$/, "")}/rest/v1/chiefos_beta_signups?${q.toString()}`;

    const headers = new Headers();
    headers.set("apikey", service);
    headers.set("Authorization", `Bearer ${service}`);
    headers.set("Accept", "application/json");

    const r = await fetch(endpoint, { headers, cache: "no-store" });
    const rows = await r.json().catch(() => []);

    const row = Array.isArray(rows) ? rows[0] : null;

    const status: BetaStatus | null =
      row?.status === "approved" ||
      row?.status === "requested" ||
      row?.status === "denied"
        ? row.status
        : null;

    const entitlementPlan = normalizePlan(row?.entitlement_plan || row?.plan);
    const finalPlan =
      status === "approved" ? entitlementPlan : null;

    return json(200, {
      ok: true,
      userId: user.id,
      email: cleanEmail,
      entitlement: {
        status,
        entitlementPlan,
        activePlan: finalPlan,
        approvedAt: row?.approved_at || null,
        source: "chiefos_beta_signups",
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      code: "ENTITLEMENT_CHECK_FAILED",
      message: e?.message || "Unknown error",
    });
  }
}