import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

type PlanKey = "starter" | "pro";

function getPriceId(plan: PlanKey) {
  if (plan === "starter") return process.env.STRIPE_PRICE_STARTER || null;
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO || null;
  return null;
}

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function normalizePhone(raw: string) {
  // basic normalize (keeps +). Good enough for “linking”; backend can enforce stricter later.
  return raw.trim().replace(/[^\d+]/g, "");
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { ok: false, message: "Missing STRIPE_SECRET_KEY." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const body = await req.json().catch(() => ({}));
    const plan = (body?.plan as PlanKey) || "starter";

    if (plan !== "starter" && plan !== "pro") {
      return NextResponse.json({ ok: false, message: "Invalid plan." }, { status: 400 });
    }

    const priceId = getPriceId(plan);
    if (!priceId) {
      return NextResponse.json(
        { ok: false, message: "Missing STRIPE_PRICE_* env var for this plan." },
        { status: 500 }
      );
    }

    const siteUrl = getSiteUrl();

    const rawPhone = body?.phone ? String(body.phone) : "";
    const phone = rawPhone ? normalizePhone(rawPhone) : "";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/pricing/success?plan=${plan}`,
      cancel_url: `${siteUrl}/pricing?canceled=1&plan=${plan}`,

      // ✅ key piece for backend linking (your backend uses client_reference_id)
      client_reference_id: phone || undefined,

      metadata: {
        plan_key: plan,
        phone: phone || "",
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Checkout error" },
      { status: 500 }
    );
  }
}