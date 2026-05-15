// src/app/api/paypal/create-subscription/route.ts
import { NextResponse } from "next/server";

const base = process.env.PAYPAL_BASE || "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_SECRET!;
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
    throw new Error("paypal token error: " + txt);
  }
  const j = await res.json();
  return j.access_token as string;
}

export async function POST(req: Request) {
  try {
    const { plan } = await req.json();
    if (!plan) return NextResponse.json({ error: "plan required" }, { status: 400 });

    const planId =
      plan === "monthly" ? process.env.PAYPAL_PLAN_MONTHLY : process.env.PAYPAL_PLAN_YEARLY;
    if (!planId) return NextResponse.json({ error: "plan id missing in env" }, { status: 500 });

    const token = await getAccessToken();

    const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const body = {
      plan_id: planId,
      application_context: {
        brand_name: "Truemate",
        return_url: `${site}/payment-success`, // or /billing/success
        cancel_url: `${site}/pricing`,
      },
    };

    const res = await fetch(`${base}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("create-subscription failed:", data);
      return NextResponse.json({ error: "paypal_create_failed", details: data }, { status: 500 });
    }

    const approve = (data.links || []).find((l: any) => l.rel === "approve")?.href;
    return NextResponse.json({ approve_url: approve, subscription_id: data.id });
  } catch (e: any) {
    console.error("/api/paypal/create-subscription error:", e);
    return NextResponse.json({ error: "internal", message: String(e?.message || e) }, { status: 500 });
  }
}