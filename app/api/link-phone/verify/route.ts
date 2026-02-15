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

function msSince(t0: number) {
  return Date.now() - t0;
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

async function getAuthUserFromBearer(req: Request) {
  const raw = req.headers.get("authorization") || "";
  const m = raw.match(/^bearer\s+(.+)$/i);
  const jwt = (m ? m[1] : "").trim();
  if (!jwt) return null;

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${jwt}` },
    cache: "no-store",
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

  const r = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`otp_lookup_failed: ${await r.text()}`);

  const rows = (await r.json()) as Array<{ otp_hash: string; expires_at: string }>;
  return rows?.[0] || null;
}

async function resolveOwnerByPhoneDigits(phoneDigits: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const url =
    `${supabaseUrl}/rest/v1/users` +
    `?user_id=eq.${encodeURIComponent(phoneDigits)}` +
    `&select=user_id,dashboard_token,email&limit=1`;

  const r = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`owner_lookup_failed: ${await r.text()}`);

  const rows = (await r.json()) as Array<{ user_id?: string; dashboard_token?: string; email?: string }>;
  const ownerId = String(rows?.[0]?.user_id || "").replace(/\D/g, "");
  const dashboardToken = String(rows?.[0]?.dashboard_token || "").trim();
  const email = rows?.[0]?.email ? String(rows[0].email).trim().toLowerCase() : null;

  if (!ownerId) return null;
  return { ownerId, dashboardToken: dashboardToken || null, email };
}

export async function POST(req: Request) {
  const BUILD =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    "local";

  const t0 = Date.now();

  const reply = (payload: any, status = 200) =>
    NextResponse.json(payload, { status, headers: { "x-chiefos-build": BUILD } });

  try {
    console.info("[LINK_PHONE_VERIFY] build", { BUILD });
    console.info("[LINK_PHONE_VERIFY] start", { ms: msSince(t0) });

    const { ownerPhone, otp } = await req.json().catch(() => ({}));
    const phoneDigits = DIGITS(ownerPhone);
    const otpDigits = DIGITS(otp);

    if (!phoneDigits || phoneDigits.length < 10) return reply({ error: "Valid phone required." }, 400);
    if (!otpDigits || otpDigits.length !== 6) return reply({ error: "Valid 6-digit OTP required." }, 400);

    const authUser = await getAuthUserFromBearer(req);
    console.info("[LINK_PHONE_VERIFY] auth_user_lookup", { ms: msSince(t0) });
    if (!authUser) return reply({ error: "Not logged in." }, 401);

    const row = await getLatestOtpRow(authUser.id, phoneDigits);
    console.info("[LINK_PHONE_VERIFY] otp_lookup", { ms: msSince(t0) });
    if (!row) return reply({ error: "OTP not found." }, 400);

    const exp = Date.parse(row.expires_at);
    if (!Number.isFinite(exp) || Date.now() > exp) return reply({ error: "OTP expired." }, 400);

    if (sha256(otpDigits) !== String(row.otp_hash || "")) return reply({ error: "OTP invalid." }, 400);

    const owner = await resolveOwnerByPhoneDigits(phoneDigits);
    console.info("[LINK_PHONE_VERIFY] owner_lookup", { ms: msSince(t0), owner_found: !!owner });

    // ✅ HARD DEBUG SWITCH: if set, we MUST return right here
    if (process.env.LINK_PHONE_DEBUG_RETURN === "1") {
      return reply({
        ok: true,
        debug: "returned_after_owner_lookup",
        owner_found: !!owner,
        owner_id: owner?.ownerId || null,
        has_dashboard_token: !!owner?.dashboardToken,
      });
    }

    if (!owner?.ownerId) return reply({ error: "No owner found for this phone." }, 404);
    if (!owner.dashboardToken) return reply({ error: "Owner missing dashboard token." }, 500);

    console.info("[LINK_PHONE_VERIFY] pre_cookie", { ms: msSince(t0) });
    const res = NextResponse.json(
      { ok: true, linked: true, owner_id: owner.ownerId },
      { status: 200, headers: { "x-chiefos-build": BUILD } }
    );

    setDashboardCookie(res, owner.dashboardToken);

    console.info("[LINK_PHONE_VERIFY] pre_return", { ms: msSince(t0) });
    return res;
  } catch (e: any) {
    console.error("[LINK_PHONE_VERIFY] error", { ms: msSince(t0), err: e?.message || String(e) });
    return NextResponse.json(
      { error: e?.message || "link_phone_verify_failed" },
      { status: 500, headers: { "x-chiefos-build": BUILD } }
    );
  }
}
