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
      const emailFromMetadata = metadata.email;
      const file = metadata.file;
      const userIdMetadata = metadata.userId;

      // unify email: prefer session.customer_email then metadata
      const email = session.customer_email || emailFromMetadata || null;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

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

      // 1.a) Ensure stripe_customer_id set on users_data (if we have email or userId)
      if (customerId && (email || userIdMetadata)) {
        try {
          // try to update by userId first (stronger)
          if (userIdMetadata) {
            const { error: uErr } = await supabaseServer
              .from("users_data")
              .update({ stripe_customer_id: customerId })
              .eq("id", userIdMetadata);
            if (uErr) console.warn("Could not set stripe_customer_id by userId:", uErr);
          }

          // fallback: update by email
          if (email) {
            const { error: eErr } = await supabaseServer
              .from("users_data")
              .update({ stripe_customer_id: customerId })
              .eq("email", email);
            if (eErr) console.warn("Could not set stripe_customer_id by email:", eErr);
            else console.log(`Linked stripe customer ${customerId} -> ${email}`);
          }
        } catch (e) {
          console.error("Failed to set stripe_customer_id in checkout.session.completed:", e);
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
      if (!customerId) {
        console.warn("Subscription has no customer id, skipping DB update.");
        return;
      }

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

      // Primary attempt: update row(s) by stripe_customer_id
      const { data: rowsByCustomer, error: lookupErr } = await supabaseServer
        .from("users_data")
        .select("id, email")
        .eq("stripe_customer_id", customerId);

      if (lookupErr) {
        console.error("Failed to lookup users_data by stripe_customer_id:", lookupErr);
      }

      if (rowsByCustomer && rowsByCustomer.length > 0) {
        const { error: updateErr } = await supabaseServer
          .from("users_data")
          .update(updates)
          .eq("stripe_customer_id", customerId);

        if (updateErr) console.error("Failed to update subscription status in DB (by customer):", updateErr);
        else console.log(`Updated subscription for customer ${customerId}: status=${status}`);
        return;
      }

      // If no rows found by stripe_customer_id, try to find by customer's email in Stripe (fallback)
      try {
        const stripeCustomer = await stripeInstance.customers.retrieve(customerId);
        const emailFromCustomer = (stripeCustomer as any)?.email;
        if (emailFromCustomer) {
          const { data: rowsByEmail, error: byEmailErr } = await supabaseServer
            .from("users_data")
            .select("id")
            .eq("email", emailFromCustomer)
            .maybeSingle();

          if (byEmailErr) {
            console.error("Failed to lookup users_data by email fallback:", byEmailErr);
          } else if (rowsByEmail) {
            // update by email
            const { error: updateErr2 } = await supabaseServer
              .from("users_data")
              .update(updates)
              .eq("email", emailFromCustomer);

            if (updateErr2) console.error("Failed to update subscription status in DB (by email):", updateErr2);
            else console.log(`Updated subscription for email ${emailFromCustomer}: status=${status}`);
            return;
          }
        }
      } catch (e) {
        console.warn("Could not retrieve stripe customer for email fallback:", e);
      }

      // Nothing matched — log and continue (admin can reconcile)
      console.warn(`No users_data row found for stripe customer ${customerId}; no DB update performed.`);
    } catch (e) {
      console.error("handleSubscriptionUpdate error:", e);
    }
  }
}
