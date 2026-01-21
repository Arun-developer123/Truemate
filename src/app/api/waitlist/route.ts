// src/app/api/waitlist/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const { error } = await supabaseServer.from("waitlist").insert({ email });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist API Error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
