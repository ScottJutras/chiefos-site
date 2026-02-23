// app/api/contact/route.ts
import { NextResponse } from "next/server";
import postmark from "postmark";

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

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

    const safeName = String(name || "").trim();
    const safeEmail = String(email || "").trim();
    const safeMessage = String(message || "").trim();

    if (!safeEmail || !safeMessage) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const serverToken = process.env.POSTMARK_SERVER_TOKEN;
    const from = process.env.POSTMARK_FROM; // e.g. hello@usechiefos.com
    const to = "hello@usechiefos.com";

    if (!serverToken) throw new Error("Missing POSTMARK_SERVER_TOKEN");
    if (!from) throw new Error("Missing POSTMARK_FROM");

    const client = new postmark.ServerClient(serverToken);

    const subject = `ChiefOS Contact: ${safeName || "Someone"} (${safeEmail})`;

    const htmlBody = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system; line-height: 1.5;">
        <h2 style="margin: 0 0 12px 0;">New Contact Message</h2>
        <p style="margin: 0 0 6px 0;"><strong>Name:</strong> ${escapeHtml(safeName || "-")}</p>
        <p style="margin: 0 0 6px 0;"><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
        <p style="margin: 12px 0 6px 0;"><strong>Message:</strong></p>
        <pre style="white-space: pre-wrap; background: #f6f6f6; padding: 12px; border-radius: 10px;">${escapeHtml(
          safeMessage
        )}</pre>
      </div>
    `;

    await client.sendEmail({
      From: from,
      To: to,
      ReplyTo: safeEmail, // ✅ hit reply, it replies to them
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `Name: ${safeName || "-"}\nEmail: ${safeEmail}\n\n${safeMessage}`,
      // If you don't use message streams, delete the next line:
      MessageStream: "outbound",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed." }, { status: 500 });
  }
}