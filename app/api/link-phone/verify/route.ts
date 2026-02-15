// chiefos-site/app/api/link-phone/verify/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

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

function setDashboardCookie(res: NextResponse, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set({
    name: "chiefos_dashboard_token",
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    ...(isProd ? { domain: ".usechiefos.com" } : {}),
  });
}

function phoneCandidates(phoneDigitsRaw: string) {
  const d = DIGITS(phoneDigitsRaw);
  const out = new Set<string>();
  if (d) out.add(d);

  // If user entered 10 digits, also try leading "1" (North America)
  if (d.length === 10) out.add(`1${d}`);

  // If user entered 11 digits starting with 1, also try without the 1
  if (d.length === 11 && d.startsWith("1")) out.add(d.slice(1));

  return Array.from(out);
}

async function getSupabaseUserFromBearer(req: Request): Promise<{ id: string; email: string | null } | null> {
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

async function lookupAuthLinkOwnerId(authUserId: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const url =
    `${supabaseUrl}/rest/v1/user_auth_links` +
    `?auth_user_id=eq.${encodeURIComponent(authUserId)}` +
    `&select=owner_id,email,linked_phone&limit=1`;

  const r = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`auth_links_lookup_failed: ${await r.text()}`);

  const rows = (await r.json()) as Array<{ owner_id?: string | null }>;
  const ownerId = String(rows?.[0]?.owner_id || "").replace(/\D/g, "");
  return ownerId || null;
}

async function resolveOwnerFromUsersByEmail(authEmail: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const url =
    `${supabaseUrl}/rest/v1/users` +
    `?email=eq.${encodeURIComponent(authEmail)}` +
    `&select=user_id,owner_id,dashboard_token,email&limit=1`;

  const r = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`users_email_lookup_failed: ${await r.text()}`);

  const rows = (await r.json()) as Array<{ user_id?: string; owner_id?: string; dashboard_token?: string }>;
  const row = rows?.[0];
  if (!row) return null;

  const ownerId = String(row.owner_id || row.user_id || "").replace(/\D/g, "");
  const dash = String(row.dashboard_token || "").trim() || null;
  return ownerId ? { ownerId, dashboardToken: dash } : null;
}

async function resolveOwnerFromUsersByPhoneCandidates(cands: string[]) {
  if (!cands.length) return null;

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // Supabase REST supports `or=(...)`
  // Example: or=(user_id.eq.905...,user_id.eq.1905...)
  const or = cands.map((c) => `user_id.eq.${c}`).join(",");
  const url =
    `${supabaseUrl}/rest/v1/users` +
    `?or=(${encodeURIComponent(or)})` +
    `&select=user_id,owner_id,dashboard_token,email&limit=1`;

  const r = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`users_phone_lookup_failed: ${await r.text()}`);

  const rows = (await r.json()) as Array<{ user_id?: string; owner_id?: string; dashboard_token?: string }>;
  const row = rows?.[0];
  if (!row) return null;

  const ownerId = String(row.owner_id || row.user_id || "").replace(/\D/g, "");
  const dash = String(row.dashboard_token || "").trim() || null;
  return ownerId ? { ownerId, dashboardToken: dash } : null;
}

async function upsertAuthLink(authUserId: string, ownerId: string, email: string | null, phoneDigits: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const payload: Record<string, any> = {
    auth_user_id: authUserId,
    owner_id: ownerId,
    linked_phone: phoneDigits,
    updated_at: new Date().toISOString(),
  };
  if (email) payload.email = email;

  const r = await fetch(`${supabaseUrl}/rest/v1/user_auth_links`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) throw new Error(`auth_links_upsert_failed: ${await r.text()}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ownerPhone = body?.ownerPhone ?? body?.phone ?? body?.phoneNumber;
    const otp = body?.otp ?? body?.code;

    const phoneDigits = DIGITS(ownerPhone);
    const otpDigits = DIGITS(otp);

    if (!phoneDigits || phoneDigits.length < 10) {
      return NextResponse.json({ error: "Valid phone required." }, { status: 400 });
    }
    if (!otpDigits || otpDigits.length !== 6) {
      return NextResponse.json({ error: "Valid 6-digit OTP required." }, { status: 400 });
    }

    const supaUser = await getSupabaseUserFromBearer(req);
    if (!supaUser) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const { id: authUserId, email: authEmail } = supaUser;

    // 1) Verify OTP row
    const row = await getLatestOtpRow(authUserId, phoneDigits);
    if (!row) return NextResponse.json({ error: "OTP not found." }, { status: 400 });

    const exp = Date.parse(row.expires_at);
    if (!Number.isFinite(exp) || Date.now() > exp) {
      return NextResponse.json({ error: "OTP expired." }, { status: 400 });
    }
    if (sha256(otpDigits) !== String(row.otp_hash || "")) {
      return NextResponse.json({ error: "OTP invalid." }, { status: 400 });
    }

    // 2) Resolve owner_id (robust)
    let ownerId: string | null = null;
    let dashboardToken: string | null = null;

    // 2a) already linked?
    ownerId = await lookupAuthLinkOwnerId(authUserId);

    // 2b) else try email (strongest)
    if (!ownerId && authEmail) {
      const byEmail = await resolveOwnerFromUsersByEmail(authEmail);
      ownerId = byEmail?.ownerId || null;
      dashboardToken = byEmail?.dashboardToken || null;
    }

    // 2c) else try phone candidates
    if (!ownerId) {
      const cands = phoneCandidates(phoneDigits);
      const byPhone = await resolveOwnerFromUsersByPhoneCandidates(cands);
      ownerId = byPhone?.ownerId || null;
      dashboardToken = byPhone?.dashboardToken || null;
    }

    if (!ownerId) {
      return NextResponse.json(
        {
          error:
            "We verified your phone, but we couldn’t locate a matching owner record. Please contact support or ensure this phone/email matches your ChiefOS owner account.",
        },
        { status: 404 }
      );
    }

    // If dashboard token not loaded yet, fetch by ownerId using users.user_id == ownerId (your DB pattern)
    if (!dashboardToken) {
      const byPhone = await resolveOwnerFromUsersByPhoneCandidates([ownerId]);
      dashboardToken = byPhone?.dashboardToken || null;
    }

    if (!dashboardToken) {
      return NextResponse.json({ error: "Owner missing dashboard token." }, { status: 500 });
    }

    // 3) Persist link so next time is instant
    await upsertAuthLink(authUserId, ownerId, authEmail, phoneDigits);

    // 4) Set cookie
    const res = NextResponse.json({ ok: true, linked: true, owner_id: ownerId });
    setDashboardCookie(res, dashboardToken);
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "link_phone_verify_failed" }, { status: 500 });
  }
}
