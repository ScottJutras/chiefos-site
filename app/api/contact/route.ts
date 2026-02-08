import { NextResponse } from "next/server";

async function verifyTurnstile(token: string, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("Missing TURNSTILE_SECRET_KEY");

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  const j = await r.json();
  return !!j?.success;
}

export async function POST(req: Request) {
  try {
    const { name, email, message, turnstileToken } = await req.json();

    if (!turnstileToken) {
      return NextResponse.json({ error: "Bot check missing." }, { status: 400 });
    }

    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");
    const ok = await verifyTurnstile(turnstileToken, ip);
    if (!ok) return NextResponse.json({ error: "Bot check failed." }, { status: 400 });

    // ✅ TODO: deliver message somewhere:
    // - send email via SMTP (nodemailer) OR
    // - send via Resend/Postmark API OR
    // - store in Supabase table "contact_messages"
    //
    // For now, just acknowledge:
    console.log("CONTACT MESSAGE:", { name, email, message });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed." }, { status: 500 });
  }
}
