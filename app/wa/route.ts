// app/wa/route.ts
import { NextResponse } from "next/server";

function pickMessage(tag: string | null) {
  switch ((tag || "").toLowerCase()) {
    case "hero":
      return "I want to try ChiefOS";
    case "header":
      return "Try ChiefOS on WhatsApp";
    case "mobile":
      return "Try ChiefOS on WhatsApp";
    case "footer":
      return "I want early access to ChiefOS";
    default:
      return "I want to try ChiefOS";
  }
}

export function GET(req: Request) {
  const num = process.env.WHATSAPP_NUMBER;

  if (!num) {
    return NextResponse.redirect(new URL("/", "https://app.usechiefos.com"), 302);
  }

  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  const text = encodeURIComponent(pickMessage(t));

  const res = NextResponse.redirect(`https://wa.me/${num}?text=${text}`, 302);

  // ✅ Prevent caching of redirects (safer for tracking + avoids weird CDN behavior)
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
