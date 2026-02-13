// app/wa/route.ts
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
      return `Try ChiefOS on WhatsApp${planPhrase}`;
    case "mobile":
      return `Try ChiefOS on WhatsApp${planPhrase}`;
    case "footer":
      return `I want early access to ChiefOS${planPhrase}`;
    case "pricing":
      return `I want to start on WhatsApp${planPhrase}`;
    case "cta":
      return `I want to log my first receipt${planPhrase}`;
    case "connect":
      return `I want to connect my WhatsApp${planPhrase}`;
    case "support":
      return `I need help with ChiefOS${planPhrase}`;
    default:
      return `I want to try ChiefOS${planPhrase}`;
  }
}

export function GET(req: Request) {
  const num = process.env.WHATSAPP_NUMBER;

  // If env missing, send users somewhere safe and real.
  if (!num) {
    return NextResponse.redirect(new URL("/", "https://app.usechiefos.com"), 302);
  }

  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  const plan = url.searchParams.get("plan");

  const text = encodeURIComponent(pickMessage(t, plan));
  const res = NextResponse.redirect(`https://wa.me/${num}?text=${text}`, 302);

  // Prevent caching of redirects (safer for tracking + avoids weird CDN behavior)
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
