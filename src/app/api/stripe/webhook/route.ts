// src/app/api/stripe/webhook/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  // dynamic import so TypeScript won't error if stripe package isn't present at top-level
  const stripePkg: any = await import("stripe").catch((e) => {
    console.error("stripe package import failed:", e);
    return null;
  });

  if (!stripePkg) {
    console.error("Stripe package not available. Make sure 'stripe' is installed.");
    return NextResponse.json({ error: "Stripe not configured on server" }, { status: 500 });
  }

  const Stripe = stripePkg.default || stripePkg;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2022-11-15" });

  try {
    const buf = await req.arrayBuffer();
    const rawBody = Buffer.from(buf);
    const sig = req.headers.get("stripe-signature") || "";
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err) {
      console.error("stripe webhook signature verification failed", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const metadata: any = session.metadata || {};
      const email = metadata.email;
      const file = metadata.file;

      if (email && file) {
        try {
          // Read existing unlocked_backgrounds for the user
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

            // append if not already present
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
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("stripe webhook handler error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
