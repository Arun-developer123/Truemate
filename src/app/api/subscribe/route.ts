// src/app/api/subscribe/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Fail fast in dev/build if env vars missing
  console.warn("Supabase env vars missing for subscribe route. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

/** simple email validator */
function isValidEmail(email: string) {
  const r =
    // basic but practical regex (not perfect but OK for client/server guard)
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return r.test(email);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = (body?.email ?? "").toString().trim();
    const email = emailRaw.toLowerCase();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    // Check existing (case-insensitive)
    const { data: existing, error: selErr } = await supabase
      .from("subscribers")
      .select("id")
      .ilike("email", email) // ilike for case-insensitive match
      .limit(1);

    if (selErr) {
      console.error("Supabase select error:", selErr);
      // continue to attempt insert fallback, or return error
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, message: "Already subscribed" }, { status: 200 });
    }

    // Insert new record
    const { error: insertErr } = await supabase.from("subscribers").insert({
      email,
      source: "website",
      meta: { ref: "blog_subscribe" },
    });

    if (insertErr) {
      // handle unique-constraint races (double-submits) gracefully
      // try detect unique violation:
      if (insertErr.code === "23505") {
        return NextResponse.json({ success: true, message: "Already subscribed" }, { status: 200 });
      }
      console.error("Supabase insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Subscribed" }, { status: 201 });
  } catch (err) {
    console.error("subscribe error", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
