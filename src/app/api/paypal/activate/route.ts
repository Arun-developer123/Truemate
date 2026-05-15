// src/app/api/paypal/activate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const base = process.env.PAYPAL_BASE || "https://api-m.sandbox.paypal.com";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false },
  });
}

async function getPayPalAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!client || !secret) throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_SECRET");

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${client}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`paypal token failed (${res.status}): ${txt}`);
  }

  const j = await res.json();
  return j.access_token as string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const subscriptionId = (body.subscriptionId || body.subscription_id || body.subscription) ?? null;
    const providedEmail = body.email ? String(body.email).trim() : null;

    if (!subscriptionId && !providedEmail) {
      return NextResponse.json({ error: "subscriptionId or email required" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // If subscriptionId provided -> fetch details from PayPal
    let subscriberEmail: string | null = providedEmail;
    let subscriptionStatus: string | null = null;
    let periodEnd: string | null = null;

    if (subscriptionId) {
      let token: string;
      try {
        token = await getPayPalAccessToken();
      } catch (err: any) {
        console.error("Failed to get PayPal token:", err);
        return NextResponse.json({ error: "paypal_auth_failed", detail: String(err?.message || err) }, { status: 500 });
      }

      const subRes = await fetch(`${base}/v1/billing/subscriptions/${subscriptionId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!subRes.ok) {
        const txt = await subRes.text().catch(() => "");
        console.error("Failed fetching subscription from PayPal:", subRes.status, txt);
        return NextResponse.json({ error: "paypal_sub_fetch_failed", status: subRes.status, detail: txt }, { status: 500 });
      }

      const subJson = await subRes.json();

      // Get email from subscription resource if available
      if (subJson?.subscriber?.email_address) {
        subscriberEmail = String(subJson.subscriber.email_address);
      }

      // status & period end
      subscriptionStatus = subJson?.status ?? null;

      // billing_info.next_billing_time is canonical, fallback to cycle_executions
      periodEnd =
        subJson?.billing_info?.next_billing_time ||
        (Array.isArray(subJson?.billing_info?.cycle_executions) && subJson.billing_info.cycle_executions[0]?.next_billing_time) ||
        null;

      // As last resort, if no email and providedEmail absent, bail (we can't map to user)
      if (!subscriberEmail) {
        return NextResponse.json(
          { error: "no_email_in_subscription", detail: "PayPal subscription does not contain subscriber.email_address and no email provided" },
          { status: 400 }
        );
      }

      // Update DB with subscription details
      const { error } = await supabaseAdmin
        .from("users_data")
        .update({
          free_chats_remaining: null,
          subscription_status: subscriptionStatus ?? "active",
          paypal_subscription_id: subscriptionId,
          subscription_current_period_end: periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("email", subscriberEmail);

      if (error) {
        console.error("Supabase update failed (activate):", error);
        return NextResponse.json({ error: "db_update_failed", detail: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, email: subscriberEmail, subscriptionId, subscriptionStatus, subscription_current_period_end: periodEnd });
    }

    // If no subscriptionId but email provided -> fallback activate (grants 30d access)
    if (providedEmail) {
      const { error } = await supabaseAdmin
        .from("users_data")
        .update({
          free_chats_remaining: null,
          subscription_status: "active",
          subscription_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("email", providedEmail);

      if (error) {
        console.error("Supabase update failed (activate fallback):", error);
        return NextResponse.json({ error: "db_update_failed", detail: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, email: providedEmail });
    }

    // reach here unexpectedly
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  } catch (e: any) {
    console.error("activate route error:", e);
    return NextResponse.json({ error: "server_error", detail: String(e?.message || e) }, { status: 500 });
  }
}