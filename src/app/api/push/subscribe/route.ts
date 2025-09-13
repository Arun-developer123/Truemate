// src/app/api/push/subscribe/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subscription, email } = body;

    if (!subscription || !email) {
      return NextResponse.json({ error: "subscription and email required" }, { status: 400 });
    }

    // Upsert subscription (simple approach: delete duplicates with same endpoint then insert)
    // You can also store multiple subscriptions per user (multiple devices).
    const { error: insertError } = await supabaseServer
      .from("push_subscriptions")
      .upsert(
        { user_email: email, subscription },
        { onConflict: "(user_email, (subscription->>'endpoint'))" } // (optional) depends on your DB constraints
      );

    // Fallback: if upsert fails due to constraint, we try a simpler insert
    if (insertError) {
      // try insert
      await supabaseServer.from("push_subscriptions").insert([{ user_email: email, subscription }]);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("subscribe route error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
