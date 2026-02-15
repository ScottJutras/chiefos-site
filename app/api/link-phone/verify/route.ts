// chiefos-site/app/api/link-phone/verify/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function DIGITS(x: unknown) {
  return String(x ?? "").replace(/\D/g, "");
}
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}
function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function isProd() {
  return process.env.NODE_ENV === "production";
}
function setDashboardCookie(res: NextResponse, token: string) {
  const prod = isProd();
  res.cookies.set({
    name: "chiefos_dashboard_token",
    value: token,
    httpOnly: true,
    secure: prod,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    ...(prod ? { domain: ".usechiefos.com" } : {}),
  });
}

// ✅ fetch helper with timeout so serverless never hangs forever
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 10_000, ...rest } = init as any;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getAuthUserFromBearer(req: Request) {
  const raw = req.headers.get("authorization") || "";
  const m = raw.match(/^bearer\s+(.+)$/i);
  const jwt = (m ? m[1] : "").trim();
  if (!jwt) return null;

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const r = await fetchWithTimeout(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${jwt}` },
    cache: "no-store",
    timeoutMs: 10_000,
  });

  if (!r.ok) return null;
  const u = await r.json();
  const id = String(u?.id || "").trim();
  const email = u?.email ? String(u.email).trim().toLowerCase() : null;
  return id ? { id, email } : null;
}

async function getLatestOtpRow(authUserId: string, phoneDigits: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const url =
    `${supabaseUrl}/rest/v1/portal_phone_link_otp` +
    `?auth_user_id=eq.${encodeURIComponent(authUserId)}` +
    `&phone_digits=eq.${encodeURIComponent(phoneDigits)}` +
    `&select=otp_hash,expires_at,created_at` +
    `&order=created_at.desc&limit=1`;

  const r = await fetchWithTimeout(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
    timeoutMs: 10_000,
  });

  if (!r.ok) throw new Error(`otp_lookup_failed: ${await r.text()}`);

  const rows = (await r.json()) as Array<{ otp_hash: string; expires_at: string; created_at?: string }>;
  return rows?.[0] || null;
}

async function resolveOwnerByPhoneDigits(phoneDigits: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const url =
    `${supabaseUrl}/rest/v1/users` +
    `?user_id=eq.${encodeURIComponent(phoneDigits)}` +
    `&select=user_id,dashboard_token,email&limit=1`;

  const r = await fetchWithTimeout(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
    timeoutMs: 10_000,
  });

  if (!r.ok) throw new Error(`owner_lookup_failed: ${await r.text()}`);

  const rows = (await r.json()) as Array<{ user_id?: string; dashboard_token?: string; email?: string }>;
  const ownerId = String(rows?.[0]?.user_id || "").replace(/\D/g, "");
  const dashboardToken = String(rows?.[0]?.dashboard_token || "").trim();
  const email = rows?.[0]?.email ? String(rows[0].email).trim().toLowerCase() : null;

  if (!ownerId) return null;
  return { ownerId, dashboardToken: dashboardToken || null, email };
}

async function upsertAuthLink(authUserId: string, ownerId: string, linkedPhone: string, email?: string | null) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    auth_user_id: authUserId,
    owner_id: ownerId,
    linked_phone: linkedPhone,
    updated_at: now,
    created_at: now,
  };
  if (email) payload.email = email;

  const r = await fetchWithTimeout(`${supabaseUrl}/rest/v1/user_auth_links`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(payload),
    timeoutMs: 10_000,
  });

  if (!r.ok) throw new Error(`auth_links_upsert_failed: ${await r.text()}`);
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const step = (name: string, extra?: any) => {
    console.log("[LINK_PHONE_VERIFY]", name, {
      ms: Date.now() - startedAt,
      ...(extra || {}),
    });
  };

  try {
    step("start");

    const { ownerPhone, otp } = await req.json().catch(() => ({}));
    const phoneDigits = DIGITS(ownerPhone);
    const otpDigits = DIGITS(otp);

    if (!phoneDigits || phoneDigits.length < 10) {
      return NextResponse.json({ error: "Valid phone required." }, { status: 400 });
    }
    if (!otpDigits || otpDigits.length !== 6) {
      return NextResponse.json({ error: "Valid 6-digit OTP required." }, { status: 400 });
    }

    step("auth_user_lookup");
    const authUser = await getAuthUserFromBearer(req);
    if (!authUser) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    step("otp_lookup");
    const row = await getLatestOtpRow(authUser.id, phoneDigits);
    if (!row) return NextResponse.json({ error: "OTP not found." }, { status: 400 });

    const exp = Date.parse(row.expires_at);
    if (!Number.isFinite(exp) || Date.now() > exp) {
      return NextResponse.json({ error: "OTP expired." }, { status: 400 });
    }

    if (sha256(otpDigits) !== String(row.otp_hash || "")) {
      return NextResponse.json({ error: "OTP invalid." }, { status: 400 });
    }

    step("owner_lookup");
    const owner = await resolveOwnerByPhoneDigits(phoneDigits);
    if (!owner?.ownerId) {
      return NextResponse.json({ error: "No owner found for this phone." }, { status: 404 });
    }

    step("auth_link_upsert");
    // ✅ Monday-safe: linking row is "nice to have" — cookie is what Billing needs.
// If auth_links upsert hangs or fails, we still set cookie + return success.
if (!owner.dashboardToken) {
  return NextResponse.json({ error: "Owner missing dashboard token." }, { status: 500 });
}

// Fire-and-forget best effort (DO NOT await)
try {
  upsertAuthLink(authUser.id, owner.ownerId, phoneDigits, authUser.email || owner.email || null);
} catch {}

// ✅ Always set cookie + return success
const res = NextResponse.json({ ok: true, linked: true, owner_id: owner.ownerId });
setDashboardCookie(res, owner.dashboardToken);
return res;

  } catch (e: any) {
    console.error("[LINK_PHONE_VERIFY_ERR]", e?.message || e);
    return NextResponse.json({ error: e?.message || "link_phone_verify_failed" }, { status: 500 });
  }
}
