// src/app/api/push/send/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import webpush from "web-push";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@yourdomain.com";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BChtvKlTMe224bK7gQN32u9IqtXG1ehzcdh0dB0aPWoI1fkAviIcCHXGUVdvd6cN1wTWhOqVZ5uqwCpgkonuqZ0";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "mr8uM1M-cxtMnKQWFpX13GDeiy_PrI9fHzN_vmJwtsI";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn("VAPID keys not set for web-push");
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

interface PushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

interface SubscriptionRow {
  id: string;
  subscription: PushSubscription;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { email?: string; title?: string; body?: string; url?: string };
    const { email, title, body: msgBody, url } = body;

    if (!email || !title) {
      return NextResponse.json({ error: "email and title required" }, { status: 400 });
    }

    // fetch all subscriptions for this user
    const { data: rows, error: fetchError } = await supabaseServer
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_email", email);

    if (fetchError) {
      console.error("fetch subscriptions error:", fetchError);
      return NextResponse.json({ error: "Failed fetch subscriptions" }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ message: "No subscriptions found" });
    }

    const payload = JSON.stringify({ title, body: msgBody, url });

    // send notifications (and cleanup invalid subs)
    const removals: string[] = [];
    await Promise.all(
      (rows as SubscriptionRow[]).map(async (r) => {
        try {
          await webpush.sendNotification(r.subscription, payload);
        } catch (err) {
          const e = err as { statusCode?: number };
          console.warn("web-push send error:", e.statusCode ?? err);
          // If unsubscribe / gone, schedule removal
          const code = e.statusCode;
          if (code === 410 || code === 404) {
            removals.push(r.id);
          }
        }
      })
    );

    // delete dead subscriptions
    if (removals.length) {
      await supabaseServer.from("push_subscriptions").delete().in("id", removals);
    }

    return NextResponse.json({ ok: true, sent: (rows as SubscriptionRow[]).length - removals.length });
  } catch (err) {
    console.error("/api/push/send error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
