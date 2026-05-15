import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const base = process.env.PAYPAL_BASE || "https://api-m.sandbox.paypal.com";
const client = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_SECRET;

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
    throw new Error(`paypal token fetch failed (${res.status}): ${txt}`);
  }

  const data = await res.json();
  return data.access_token;
};

export async function POST(req: Request) {
  try {
    const { orderID } = await req.json();
    if (!orderID) return NextResponse.json({ error: "orderID required" }, { status: 400 });

    const token = await getAccessToken();

    const capRes = await fetch(`${base}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const capData = await capRes.json();

    if (!capRes.ok) {
      console.error("/api/backgrounds/paypal/capture failed:", capData);
      return NextResponse.json({ error: "capture_failed", details: capData }, { status: 500 });
    }

    // ✅ IMPORTANT: ensure payment actually completed
    if (capData.status !== "COMPLETED") {
      console.error("payment not completed:", capData);
      return NextResponse.json(
        { error: "payment_not_completed", status: capData.status },
        { status: 400 }
      );
    }

    // Duplicate-capture protection: capture id (useful for logging / future idempotency)
    const captureId = capData.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;

    // Try to extract our custom_id (we set custom_id on purchase_unit)
    const pu = capData.purchase_units?.[0] || {};
    let customStr = pu.custom_id ?? null;

    // fallback: some responses nest it under payments.captures[0].custom_id
    if (!customStr) {
      customStr = pu?.payments?.captures?.[0]?.custom_id ?? null;
    }

    if (!customStr) {
      console.error("capture succeeded but custom_id missing:", capData);
      return NextResponse.json({ error: "missing_custom_id", details: capData }, { status: 500 });
    }

    let parsed: { email?: string; file?: string } = {};
    try {
      parsed = JSON.parse(customStr);
    } catch (err) {
      console.error("failed to parse custom_id json:", err, customStr);
      return NextResponse.json({ error: "invalid_custom_id", custom_id: customStr }, { status: 500 });
    }

    const email = parsed.email;
    const file = parsed.file;

    if (!email || !file) {
      return NextResponse.json({ error: "invalid_custom_id_payload", parsed }, { status: 500 });
    }

    // fetch existing unlocked array
    const { data: userRow, error: selectErr } = await supabaseServer
      .from("users_data")
      .select("unlocked_backgrounds")
      .eq("email", email)
      .maybeSingle();

    if (selectErr) {
      console.error("supabase select error while unlocking:", selectErr);
      return NextResponse.json({ error: "db_select_failed", details: String(selectErr) }, { status: 500 });
    }

    const unlocked: string[] = Array.isArray(userRow?.unlocked_backgrounds)
      ? [...userRow!.unlocked_backgrounds]
      : [];

    if (!unlocked.includes(file)) unlocked.push(file);

    const { error: updateErr } = await supabaseServer
      .from("users_data")
      .update({
        unlocked_backgrounds: unlocked,
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    if (updateErr) {
      console.error("supabase update error while unlocking:", updateErr);
      return NextResponse.json({ error: "db_update_failed", details: String(updateErr) }, { status: 500 });
    }

    // return capture + captureId for debugging if needed
    return NextResponse.json({ ok: true, capture: capData, captureId });
  } catch (e: any) {
    console.error("/api/backgrounds/paypal/capture error:", e);
    return NextResponse.json({ error: "Internal", message: String(e?.message || e) }, { status: 500 });
  }
}