// src/app/api/user/use-chat/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const { userId } = await req.json();
  const { data: user } = await supabaseServer
    .from("users_data")
    .select("free_chats_remaining, subscription_status")
    .eq("id", userId)
    .single();

  if (!user) return NextResponse.json({ error: "no user" }, { status: 404 });

  if (user.subscription_status === "active") {
    return NextResponse.json({ ok: true, remaining: null });
  }

  let remaining = user.free_chats_remaining ?? 30;
  if (remaining <= 0) return NextResponse.json({ ok: false, reason: "no_free_chats" }, { status: 403 });

  remaining = remaining - 1;
  await supabaseServer.from("users_data").update({ free_chats_remaining: remaining }).eq("id", userId);
  return NextResponse.json({ ok: true, remaining });
}
