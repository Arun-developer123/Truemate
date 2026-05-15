// src/app/api/paypal/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const base = process.env.PAYPAL_BASE || "https://api-m.sandbox.paypal.com";

// Lazy Supabase init (prevents build crash)
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE env vars (SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY)");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false },
  });
}

// PayPal OAuth token (uses base)
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_SECRET!;

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  return res.json();
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const json = JSON.parse(rawBody);

    const supabaseAdmin = getSupabaseAdmin();

    // PayPal verification headers
    const headers = {
      transmission_id: req.headers.get("paypal-transmission-id") ?? "",
      transmission_time: req.headers.get("paypal-transmission-time") ?? "",
      cert_url: req.headers.get("paypal-cert-url") ?? "",
      auth_algo: req.headers.get("paypal-auth-algo") ?? "",
      transmission_sig: req.headers.get("paypal-transmission-sig") ?? "",
      webhook_id: process.env.PAYPAL_WEBHOOK_ID ?? "",
    };

    const verifyPayload = {
      auth_algo: headers.auth_algo,
      cert_url: headers.cert_url,
      transmission_id: headers.transmission_id,
      transmission_sig: headers.transmission_sig,
      transmission_time: headers.transmission_time,
      webhook_id: headers.webhook_id,
      webhook_event: json,
    };

    // Get PayPal token
    const tokenRes = await getPayPalAccessToken();
    const accessToken = tokenRes?.access_token;

    if (!accessToken) {
      console.error("PayPal token error:", tokenRes);
      return NextResponse.json({ error: "paypal auth failed" }, { status: 500 });
    }

    // Verify webhook signature (use base)
    const verifyRes = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(verifyPayload),
    });

    const verifyJson = await verifyRes.json();

    if (verifyJson.verification_status !== "SUCCESS") {
      console.warn("Webhook verification failed:", verifyJson);
      return NextResponse.json({ error: "invalid webhook" }, { status: 400 });
    }

    // --- Handle Events ---
    const eventType = json.event_type;
    const resource = json.resource;

    const allowedEvents = [
      "CHECKOUT.ORDER.APPROVED",
      "PAYMENT.CAPTURE.COMPLETED",
      "BILLING.SUBSCRIPTION.ACTIVATED",
      "BILLING.SUBSCRIPTION.UPDATED",
      "BILLING.SUBSCRIPTION.CANCELLED",
    ];

    if (allowedEvents.includes(eventType)) {
      // Try to get an email from common places; also parse purchase_units[0].custom_id if it's JSON
      let payerEmail: string | null = null;

      if (resource?.payer?.email_address) {
        payerEmail = resource.payer.email_address;
      } else if (resource?.subscriber?.email_address) {
        payerEmail = resource.subscriber.email_address;
      } else if (resource?.payer?.payer_info?.email) {
        payerEmail = resource.payer.payer_info.email;
      } else if (resource?.purchase_units?.[0]?.custom_id) {
        const customId = resource.purchase_units[0].custom_id;
        // custom_id might be a JSON string like {"email":"x","file":"y"}
        try {
          const parsed = JSON.parse(customId);
          if (parsed && typeof parsed === "object" && parsed.email) {
            payerEmail = String(parsed.email);
          }
        } catch (err) {
          // not JSON — sometimes merchants put email directly in custom_id
          payerEmail = String(customId);
        }
      }

      // If we didn't find email above but resource has subscriber or payer objects, attempt other fallbacks
      if (!payerEmail && resource?.subscriber?.payer_id) {
        // we can try to fetch subscription details later using subscription id; for now leave null
        console.warn("No email in webhook resource; subscriber.payer_id present:", resource.subscriber?.payer_id);
      }

      // Handle subscription events specially (store subscription id & period end)
      if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" || eventType === "BILLING.SUBSCRIPTION.UPDATED") {
        const subId = resource?.id ?? resource?.subscription_id ?? null;
        const status = resource?.status ?? "active";

        // billing_info.next_billing_time is the canonical next payment time
        const periodEnd =
          resource?.billing_info?.next_billing_time ||
          (Array.isArray(resource?.billing_info?.cycle_executions) &&
            resource.billing_info.cycle_executions[0]?.next_billing_time) ||
          null;

        if (payerEmail) {
          const { error } = await supabaseAdmin
            .from("users_data")
            .update({
              free_chats_remaining: null,
              subscription_status: status,
              paypal_subscription_id: subId,
              subscription_current_period_end: periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("email", payerEmail);

          if (error) {
            console.error("Supabase update failed (subscription activated/updated):", error);
          } else {
            console.log("User subscription updated via webhook:", payerEmail, subId);
          }
        } else {
          console.warn("Subscription event but no payer email available in resource:", json);
        }
      } else if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
        // subscription cancelled
        const subId = resource?.id ?? resource?.subscription_id ?? null;
        const status = "cancelled";
        // Try to get period end if provided
        const periodEnd = resource?.billing_info?.next_billing_time ?? null;

        if (payerEmail) {
          const { error } = await supabaseAdmin
            .from("users_data")
            .update({
              subscription_status: status,
              paypal_subscription_id: subId,
              // don't immediately wipe unlimited — set period end if available, otherwise keep what was there
              subscription_current_period_end: periodEnd ?? new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("email", payerEmail);

          if (error) {
            console.error("Supabase update failed (subscription cancelled):", error);
          } else {
            console.log("User subscription cancelled via webhook:", payerEmail, subId);
          }
        } else {
          console.warn("Subscription cancelled but no payer email in resource:", json);
        }
      } else if (eventType === "PAYMENT.CAPTURE.COMPLETED" || eventType === "CHECKOUT.ORDER.APPROVED") {
        // One-time purchase (backgrounds / files) - keep your existing custom_id unlock flow (purchase_units[0].custom_id)
        if (payerEmail) {
          const { error } = await supabaseAdmin
            .from("users_data")
            .update({
              free_chats_remaining: null,
              subscription_status: "active",
              subscription_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("email", payerEmail);

          if (error) {
            console.error("Supabase update failed (one-time capture):", error);
          } else {
            console.log("User upgraded (one-time) via webhook:", payerEmail);
          }
        } else {
          console.warn("Payment capture event but no payer email in resource:", json);
        }
      } else {
        // Other allowed events (if any) — keep as no-op or log
        console.log("Unhandled allowed event:", eventType);
      }
    } else {
      // Not in allowed events: ignore but respond 200 to ack
      console.log("Ignored event type:", eventType);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}