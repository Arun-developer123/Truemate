// src/app/api/backgrounds/thumb/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const file = url.searchParams.get("file");
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    // 1) Try public thumbs bucket first (if you created one)
    try {
      const thumbsBucket = "backgrounds_thumbs";
      const pub = supabaseServer.storage.from(thumbsBucket).getPublicUrl(file);
      const publicUrl = pub?.data?.publicUrl || (pub as any)?.publicUrl;
      if (publicUrl) {
        return NextResponse.redirect(publicUrl);
      }
    } catch (e) {
      // ignore and fall back to signed url
    }

    // 2) Fallback: signed URL from private 'backgrounds' bucket
    const { data } = await supabaseServer.storage.from("backgrounds").createSignedUrl(file, 60 * 60); // 1 hour
    if (data?.signedUrl) {
      return NextResponse.redirect(data.signedUrl);
    }

    return NextResponse.json({ error: "not found" }, { status: 404 });
  } catch (err) {
    console.error("/api/backgrounds/thumb error:", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
