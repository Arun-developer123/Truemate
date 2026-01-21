import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const { userId, peek } = await req.json();

  const { data: user } = await supabaseServer
    .from("users_data")
    .select("free_chats_remaining, subscription_status")
    .eq("id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ✅ Paid = unlimited
  if (user.subscription_status === "active") {
    return NextResponse.json({ ok: true, remaining: null });
  }

  const remaining = user.free_chats_remaining ?? 30;

  // 👀 Peek mode (NO decrement)
  if (peek) {
    return NextResponse.json({ ok: true, remaining });
  }

  if (remaining <= 0) {
    return NextResponse.json(
      { ok: false, reason: "no_free_chats" },
      { status: 403 }
    );
  }

  const next = remaining - 1;

  await supabaseServer
    .from("users_data")
    .update({ free_chats_remaining: next })
    .eq("id", userId);

  return NextResponse.json({ ok: true, remaining: next });
}
