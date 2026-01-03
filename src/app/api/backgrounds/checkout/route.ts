// src/app/api/backgrounds/checkout/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Create a Stripe Checkout Session.
 * - Uses dynamic import of stripe to avoid build-time TS issues if package missing.
 * - Returns clear error details for easier debugging in dev.
 */
export async function POST(req: Request) {
  // 1) validate env early so we return clear messages
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_BACKGROUND_PRICE_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`;

  if (!stripeSecret) {
    console.error("STRIPE_SECRET_KEY is missing in env");
    return NextResponse.json({ error: "missing_env", message: "STRIPE_SECRET_KEY not set" }, { status: 500 });
  }
  if (!priceId) {
    console.error("STRIPE_BACKGROUND_PRICE_ID is missing in env");
    return NextResponse.json({ error: "missing_env", message: "STRIPE_BACKGROUND_PRICE_ID not set" }, { status: 500 });
  }

  // 2) dynamic import stripe (fail gracefully if package missing)
  const stripePkg: any = await import("stripe").catch((e) => {
    console.error("stripe package import failed:", e);
    return null;
  });
  if (!stripePkg) {
    return NextResponse.json(
      { error: "stripe_missing", message: "Stripe package not installed. Run `npm install stripe`." },
      { status: 500 }
    );
  }
  const Stripe = stripePkg.default || stripePkg;
  const stripe = new Stripe(stripeSecret, { apiVersion: "2022-11-15" } as any);

  try {
    const body = await req.json();
    const email = body?.email;
    const file = body?.file;

    if (!email || !file) {
      return NextResponse.json({ error: "bad_request", message: "email & file required" }, { status: 400 });
    }

    // 3) create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { email, file },
      success_url: `${baseUrl}/home?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/home?checkout=cancel`,
    });

    // session.url should be present for a Checkout hosted page
    if (!session.url) {
      console.warn("Stripe created session but session.url is empty. Full session object:", session);
      return NextResponse.json({ error: "no_session_url", session }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err: any) {
    // Log full error server-side
    console.error("/api/backgrounds/checkout stripe error:", err);

    // If it's a Stripe error, return its message for debugging
    const stripeError = {
      message: err?.message || String(err),
      type: err?.type || null,
      statusCode: err?.statusCode || null,
      raw: err?.raw || null,
    };

    return NextResponse.json({ error: "stripe_error", details: stripeError }, { status: 500 });
  }
}
