// src/app/api/stripe/checkout/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  // dynamic import to avoid TS apiVersion literal issues
  const stripePkg: any = await import("stripe").catch((e) => {
    console.error("stripe import failed:", e);
    return null;
  });
  if (!stripePkg) return NextResponse.json({ error: "Stripe not installed" }, { status: 500 });
  const Stripe = stripePkg.default || stripePkg;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

  try {
    // after: const body = await req.json();
const body = await req.json();
console.log("checkout body received:", JSON.stringify(body)); // <-- debug
const { priceId, email, userId, successUrl, cancelUrl } = body;
if (!priceId || !email || !userId) {
  const missing = [];
  if (!priceId) missing.push("priceId");
  if (!email) missing.push("email");
  if (!userId) missing.push("userId");
  console.warn("Missing params:", missing);
  return NextResponse.json({ error: "missing params", missing }, { status: 400 });
}


    // fetch user row (by id)
    const { data: userRow, error: fetchErr } = await supabaseServer
      .from("users_data")
      .select("stripe_customer_id, email")
      .eq("id", userId)
      .maybeSingle();

    if (fetchErr) {
      console.error("supabase fetch error:", fetchErr);
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }

    let stripeCustomerId = userRow?.stripe_customer_id || null;
    if (!stripeCustomerId) {
      // create customer
      const customer = await stripe.customers.create({ email });
      stripeCustomerId = customer.id;
      const { error: updErr } = await supabaseServer
        .from("users_data")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", userId);
      if (updErr) console.error("Failed to update stripe_customer_id", updErr);
    }

    // create checkout session (subscription)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer: stripeCustomerId,
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/home?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/home?checkout=cancel`,
      allow_promotion_codes: true,
      // set metadata so webhook can know user email or id if you want:
      metadata: { email, userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("checkout error:", err);
    return NextResponse.json({ error: err.message || "internal" }, { status: 500 });
  }
}
