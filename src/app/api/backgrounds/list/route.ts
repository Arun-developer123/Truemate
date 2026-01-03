// src/app/api/backgrounds/list/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "email required" },
        { status: 400 }
      );
    }

    // 1️⃣ List all background files from storage
    const { data: files, error: listErr } =
      await supabaseServer.storage
        .from("backgrounds")
        .list("");

    if (listErr) throw listErr;

    // 2️⃣ Fetch unlocked backgrounds for user
    const { data: userRow, error: userErr } =
      await supabaseServer
        .from("users_data")
        .select("unlocked_backgrounds")
        .eq("email", email)
        .maybeSingle();

    if (userErr) throw userErr;

    const unlocked_backgrounds: string[] = Array.isArray(
      userRow?.unlocked_backgrounds
    )
      ? userRow!.unlocked_backgrounds
      : [];

    // 3️⃣ Build response
    const items = (files || []).map((file) => {
      const fileName = file.name;

      // ✅ YAHI TUMHARA REQUIRED LOGIC
      const isUnlocked = unlocked_backgrounds.includes(fileName);

      return {
        name: fileName,
        isUnlocked,
        thumbUrl: `/api/backgrounds/thumb?file=${encodeURIComponent(fileName)}`,
        signedUrl: null, // request later only if unlocked
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("/api/backgrounds/list error:", err);
    return NextResponse.json(
      { error: "Internal" },
      { status: 500 }
    );
  }
}
