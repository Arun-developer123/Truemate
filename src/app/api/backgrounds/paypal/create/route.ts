import { NextResponse } from "next/server";

const base = process.env.PAYPAL_BASE || "https://api-m.sandbox.paypal.com";
const client = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_SECRET;
const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const getAccessToken = async (): Promise<string> => {
  if (!client || !secret) throw new Error("PAYPAL_CLIENT_ID or PAYPAL_SECRET missing in env");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${client}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`failed to get token (${res.status}): ${txt}`);
  }

  const data = await res.json();
  return data.access_token;
};

export async function POST(req: Request) {
  try {
    const { email, file } = await req.json();
    if (!email || !file) {
      return NextResponse.json({ error: "email & file required" }, { status: 400 });
    }

    const token = await getAccessToken();

    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: "1",
            },
            // store email+file as custom_id (stringified) so we can read it on capture
            custom_id: JSON.stringify({ email, file }),
          },
        ],
        application_context: {
          return_url: `${site}/payment-success`,
          cancel_url: `${site}/home?paypal=cancel`,
        },
      }),
    });

    const order = await orderRes.json();

    if (!orderRes.ok) {
      console.error("/api/backgrounds/paypal/create order create failed:", order);
      return NextResponse.json({ error: "paypal_create_failed", details: order }, { status: 500 });
    }

    const approveLink = (order.links || []).find((l: any) => l.rel === "approve")?.href;
    if (!approveLink) {
      console.error("no approve link in PayPal response:", order);
      return NextResponse.json({ error: "no_approve_link", order }, { status: 500 });
    }

    return NextResponse.json({ url: approveLink });
  } catch (e: any) {
    console.error("/api/backgrounds/paypal/create error:", e);
    return NextResponse.json({ error: "paypal_error", message: String(e?.message || e) }, { status: 500 });
  }
}