// app/api/wa-link/route.ts
import { NextResponse } from "next/server";

type Plan = "free" | "starter" | "pro";

function normalizePlan(plan: string | null): Plan | null {
  const p = (plan || "").toLowerCase().trim();
  if (p === "free" || p === "starter" || p === "pro") return p;
  return null;
}

function pickMessage(tag: string | null, plan: string | null) {
  const p = normalizePlan(plan);
  const planPhrase = p ? ` (plan: ${p})` : "";

  switch ((tag || "").toLowerCase().trim()) {
    case "hero":
      return `I want to try ChiefOS${planPhrase}`;
    case "header":
    case "mobile":
      return `Try ChiefOS on WhatsApp${planPhrase}`;
    case "pricing":
      return `I want to start on WhatsApp${planPhrase}`;
    case "cta":
      return `I want to log my first receipt${planPhrase}`;
    case "support":
      return `I need help with ChiefOS${planPhrase}`;
    default:
      return `I want to try ChiefOS${planPhrase}`;
  }
}

function isAllowedWhatsAppUrl(url: string) {
  // Allow only WhatsApp official patterns
  return (
    url.startsWith("https://wa.me/") ||
    url.startsWith("https://api.whatsapp.com/")
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { turnstileToken, t, plan } = body || {};

    // Basic validation
    if (!turnstileToken) {
      return NextResponse.json(
        { error: "Missing bot-check token." },
        { status: 400 }
      );
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json(
        { error: "Turnstile misconfigured (missing secret)." },
        { status: 500 }
      );
    }

    // Verify Turnstile server-side
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", String(turnstileToken));

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";

    if (ip) form.append("remoteip", ip);

    // Optional (recommended): action + cdata
    // Action helps Turnstile classify what the challenge was for.
    form.append("action", "wa_link");
    // cdata can be any string you want returned in the verdict (not required)
    form.append("cdata", `t=${String(t || "")}&plan=${String(plan || "")}`);

    const verify = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form }
    );

    const verdict = (await verify.json().catch(() => null)) as any;

    if (!verdict?.success) {
      return NextResponse.json(
        { error: "Bot check failed. Please try again." },
        { status: 403 }
      );
    }

    const message = pickMessage(t ?? null, plan ?? null);

    // ✅ Preferred: WhatsApp Business Short Link (no phone number exposure)
    const shortLink = (process.env.WHATSAPP_SHORT_LINK || "").trim();
    if (shortLink) {
      if (!isAllowedWhatsAppUrl(shortLink)) {
        return NextResponse.json(
          { error: "WhatsApp short link is invalid or not allowed." },
          { status: 500 }
        );
      }

      // Short links often don’t accept ?text= reliably.
      // UI will show “Copy starter message” + “Open WhatsApp”.
      const res = NextResponse.json({ url: shortLink, message }, { status: 200 });
      res.headers.set("Cache-Control", "no-store, max-age=0");
      return res;
    }

    // Fallback: direct click-to-chat (redirect exposes number)
    const num = (process.env.WHATSAPP_NUMBER || "").trim();
    if (!num) {
      return NextResponse.json(
        { error: "WhatsApp link not configured." },
        { status: 500 }
      );
    }

    const text = encodeURIComponent(message);
    const url = `https://wa.me/${num}?text=${text}`;

    const res = NextResponse.json({ url, message }, { status: 200 });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to create WhatsApp link." },
      { status: 500 }
    );
  }
}