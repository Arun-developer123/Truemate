// src/app/api/push/send/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import webpush from "web-push";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@yourdomain.com";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn("VAPID keys not set for web-push");
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export async function POST(req: Request) {
  try {
    const { email, title, body, url } = await req.json();
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

    const payload = JSON.stringify({ title, body, url });

    // send notifications (and cleanup invalid subs)
    const removals: string[] = [];
    await Promise.all(
      rows.map(async (r: any) => {
        try {
          await webpush.sendNotification(r.subscription, payload);
        } catch (err: any) {
          console.warn("web-push send error:", err && err.statusCode ? err.statusCode : err);
          // If unsubscribe / gone, schedule removal
          const code = err?.statusCode;
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

    return NextResponse.json({ ok: true, sent: rows.length - removals.length });
  } catch (err) {
    console.error("/api/push/send error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
