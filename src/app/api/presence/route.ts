import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // IMPORTANT: use SERVICE ROLE key here (server only)
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  }
);

// Accept both sendBeacon (text/plain) and JSON POST
export async function POST(req: NextRequest) {
  try {
    let payload: any = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      // sendBeacon often sends text/plain
      const text = await req.text();
      payload = JSON.parse(text);
    }

    const { user_id, is_online, last_active_at } = payload || {};

    if (!user_id || typeof is_online !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "Invalid payload" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("user_presence")
      .upsert(
        {
          user_id,
          is_online,
          last_active_at: last_active_at || new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Presence upsert failed:", error);
      return NextResponse.json(
        { ok: false, error: "DB error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Presence API error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}

// OPTIONAL: allow HEAD (sendBeacon may do this in some browsers)
export async function HEAD() {
  return new Response(null, { status: 204 });
}
