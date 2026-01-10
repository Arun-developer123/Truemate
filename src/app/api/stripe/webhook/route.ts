// src/app/api/stripe/webhook/route.ts
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
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

  try {
    const buf = await req.arrayBuffer();
    const rawBody = Buffer.from(buf);
    const sig = req.headers.get("stripe-signature") || "";
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err: any) {
      console.error("stripe webhook signature verification failed", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // --- handle events ---
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const metadata: any = session.metadata || {};
      const email = metadata.email;
      const file = metadata.file;
      const userIdMetadata = metadata.userId;

      // 1) If metadata.file exists -> unlock gallery background (your previous logic)
      if (email && file) {
        try {
          const { data: userRow, error: fetchErr } = await supabaseServer
            .from("users_data")
            .select("unlocked_backgrounds")
            .eq("email", email)
            .maybeSingle();

          if (fetchErr) {
            console.error("Failed to fetch user unlocked_backgrounds:", fetchErr);
          } else {
            const unlocked: string[] = Array.isArray(userRow?.unlocked_backgrounds)
              ? (userRow!.unlocked_backgrounds as string[])
              : [];

            if (!unlocked.includes(file)) {
              const newUnlocked = [...unlocked, file];
              const { error: updateErr } = await supabaseServer
                .from("users_data")
                .update({ unlocked_backgrounds: newUnlocked })
                .eq("email", email);

              if (updateErr) {
                console.error("Failed to update unlocked_backgrounds:", updateErr);
              } else {
                console.log(`Unlocked ${file} for ${email}`);
              }
            } else {
              console.log(`File ${file} already unlocked for ${email} — skipping update.`);
            }
          }
        } catch (e) {
          console.error("Failed to mark unlocked:", e);
        }
      }

      // 2) If checkout created a subscription, retrieve and handle subscription
      if (session.subscription && typeof session.subscription === "string") {
        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await handleSubscriptionUpdate(subscription, stripe);
        } catch (e) {
          console.error("Failed to retrieve subscription from session:", e);
        }
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as any;
      if (invoice.subscription && typeof invoice.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        await handleSubscriptionUpdate(subscription, stripe);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as any;
      await handleSubscriptionUpdate(subscription, stripe);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("stripe webhook handler error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  // helper
  async function handleSubscriptionUpdate(subscription: any, stripeInstance: any) {
    try {
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
      if (!customerId) return;

      const status = subscription.status; // active, past_due, canceled, incomplete, etc.
      const current_period_end = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

      const updates: any = {
        stripe_subscription_id: subscription.id,
        subscription_status: status,
        subscription_current_period_end: current_period_end,
      };

      if (status === "active") {
        updates.free_chats_remaining = null; // unlimited
      } else if (status === "canceled" || status === "incomplete_expired" || status === "past_due") {
        // restore to 30 if not set
        updates.free_chats_remaining = 30;
      }

      const { error: updateErr } = await supabaseServer
        .from("users_data")
        .update(updates)
        .eq("stripe_customer_id", customerId);

      if (updateErr) console.error("Failed to update subscription status in DB:", updateErr);
      else console.log(`Updated subscription for customer ${customerId}: status=${status}`);
    } catch (e) {
      console.error("handleSubscriptionUpdate error:", e);
    }
  }
}
