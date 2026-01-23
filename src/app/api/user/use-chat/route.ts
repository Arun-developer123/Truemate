import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = (body?.userId ?? null) as string | null;
    const peek = Boolean(body?.peek);

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // --- Peek (read-only, no decrement) ---
    if (peek) {
      const { data: row, error: fetchErr } = await supabaseServer
        .from("users_data")
        .select("free_chats_remaining, subscription_status")
        .eq("id", userId)
        .maybeSingle();

      if (fetchErr) {
        console.error("use-chat peek: db error", fetchErr);
        return NextResponse.json({ error: "db error" }, { status: 500 });
      }

      if (!row) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // treat active/trialing as unlimited
      if (row.subscription_status === "active" || row.subscription_status === "trialing") {
        return NextResponse.json({ ok: true, remaining: null });
      }

      const remaining = (typeof row.free_chats_remaining === "number" ? row.free_chats_remaining : 30);
      return NextResponse.json({ ok: true, remaining });
    }

    // --- Non-peek: atomic decrement via RPC ---
    const { data: rpcData, error: rpcErr } = await supabaseServer.rpc("decrement_free_chats", {
      p_user_id: userId,
    });

    if (rpcErr) {
      console.error("use-chat rpc error:", rpcErr);
      return NextResponse.json({ error: "server error" }, { status: 500 });
    }

    // rpcData may be number, null, or an array depending on client; normalize:
    let result: any = rpcData;
    if (Array.isArray(result)) result = result[0];

    // handle sentinels
    if (result === -999) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result === -1) {
      return NextResponse.json({ ok: false, reason: "no_free_chats" }, { status: 403 });
    }

    // success: result === null (unlimited) or number (remaining after decrement)
    return NextResponse.json({ ok: true, remaining: result });
  } catch (err: any) {
    console.error("use-chat route error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
