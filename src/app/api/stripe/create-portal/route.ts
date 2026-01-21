// src/app/api/stripe/create-portal/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const stripePkg: any = await import("stripe").catch((e) => {
    console.error("stripe import failed:", e);
    return null;
  });
  if (!stripePkg) return NextResponse.json({ error: "Stripe not installed" }, { status: 500 });
  const Stripe = stripePkg.default || stripePkg;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});


  try {
    const { userId, returnUrl } = await req.json();
    if (!userId) return NextResponse.json({ error: "missing userId" }, { status: 400 });

    const { data: user, error: fetchErr } = await supabaseServer
      .from("users_data")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (fetchErr) {
      console.error("supabase fetch error:", fetchErr);
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }

    if (!user?.stripe_customer_id) return NextResponse.json({ error: "no stripe customer" }, { status: 400 });

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl || process.env.NEXT_PUBLIC_APP_URL,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("create-portal error:", err);
    return NextResponse.json({ error: err.message || "internal" }, { status: 500 });
  }
}
