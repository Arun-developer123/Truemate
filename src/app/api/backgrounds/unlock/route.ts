import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const { email, file } = await req.json();

    if (!email || !file) {
      return NextResponse.json({ error: "email & file required" }, { status: 400 });
    }

    // fetch existing unlocked backgrounds
    const { data, error } = await supabaseServer
      .from("users_data")
      .select("unlocked_backgrounds")
      .eq("email", email)
      .single();

    if (error) throw error;

    const unlocked = new Set<string>(data?.unlocked_backgrounds || []);
    unlocked.add(file);

    // update DB
    const { error: updateError } = await supabaseServer
      .from("users_data")
      .update({
        unlocked_backgrounds: Array.from(unlocked),
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("unlock failed", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
