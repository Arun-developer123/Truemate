// src/app/api/flush-chat/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // 👈 service_role client

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    console.log("🟢 Raw body from sendBeacon:", raw);

    const { email } = JSON.parse(raw || "{}");
    console.log("🟢 Parsed email:", email);

    if (!email) {
      return NextResponse.json({ error: "Email missing" }, { status: 400 });
    }

    // 1. Fetch user row (with service_role → bypass RLS)
    const { data, error } = await supabaseServer
      .from("users_data")
      .select("chat")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("❌ Supabase fetch error:", error.message);
      return NextResponse.json({ error: "Chat fetch failed" }, { status: 400 });
    }

    if (!data) {
      console.error("❌ No row found for email:", email);
      return NextResponse.json({ error: "User row not found" }, { status: 404 });
    }

    const chatData = data.chat ?? [];

    if (chatData.length === 0) {
      console.log("ℹ️ No chat to summarize for:", email);
      return NextResponse.json({ message: "No chat to summarize" });
    }

    // 2. Summarize using Groq API
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "Summarize the following conversation briefly and clearly.",
          },
          { role: "user", content: JSON.stringify(chatData) },
        ],
      }),
    });

    const dataRes = await res.json();
    const summary =
      dataRes.choices?.[0]?.message?.content || "No summary generated.";

    console.log("🟢 Generated Summary:", summary);

    // 3. Update DB (save summary + clear chat)
    const { error: updateError } = await supabaseServer
      .from("users_data")
      .update({
        chat_summary: summary,
        chat: [],
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    if (updateError) {
      console.error("❌ Supabase update error:", updateError.message);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    console.log("✅ Chat summarized & cleared for:", email);

    return NextResponse.json({
      message: "Chat summarized & cleared",
      summary,
    });
  } catch (err) {
    console.error("flush-chat failed:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
