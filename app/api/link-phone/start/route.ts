// chiefos-site/app/api/link-phone/start/route.ts
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

function genOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function isProd() {
  return process.env.NODE_ENV === "production";
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

async function upsertOtpRow(authUserId: string, phoneDigits: string, otpHash: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const payload = {
    auth_user_id: authUserId,
    phone_digits: phoneDigits,
    otp_hash: otpHash,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
    created_at: new Date().toISOString(),
  };

  const r = await fetch(`${supabaseUrl}/rest/v1/portal_phone_link_otp`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`otp_upsert_failed: ${t}`);
  }
}

async function sendOtp(phoneDigits: string, otp: string) {
  // Dev: log OTP for quick testing
  if (process.env.NODE_ENV !== "production") {
    console.log("[LINK_PHONE_OTP_DEV]", { phoneDigits, otp });
    return;
  }

  // Prod: WhatsApp via Twilio
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  if (!sid || !token || !from) {
    throw new Error("OTP delivery not configured (missing TWILIO_* env vars).");
  }

  // Your owner phone digits should include country code (you’re using 1905... already)
  const toDigits = phoneDigits.startsWith("+") ? phoneDigits : `+${phoneDigits}`;
  const to = `whatsapp:${toDigits}`;

  const body = `ChiefOS link code: ${otp} (expires in 10 minutes)`;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams();
  form.set("From", from); // must be "whatsapp:+1..."
  form.set("To", to);     // "whatsapp:+1..."
  form.set("Body", body);

  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`twilio_whatsapp_send_failed: ${t}`);
  }
}


export async function POST(req: Request) {
  try {
    const { ownerPhone } = await req.json().catch(() => ({}));
    const phoneDigits = DIGITS(ownerPhone);

    if (!phoneDigits || phoneDigits.length < 10) {
      return NextResponse.json({ error: "Valid phone required." }, { status: 400 });
    }

    const authUser = await getAuthUserFromBearer(req);
    if (!authUser) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const otp = genOtp6();
    await upsertOtpRow(authUser.id, phoneDigits, sha256(otp));
    await sendOtp(phoneDigits, otp);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "link_phone_start_failed" }, { status: 500 });
  }
}
