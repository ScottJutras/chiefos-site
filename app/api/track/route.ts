// app/api/track/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Keep it simple: log server-side (visible in Vercel logs)
    console.log("[track]", {
      event: body?.event,
      payload: body?.payload,
      ua: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for"),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
