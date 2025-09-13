// src/app/api/flush-chat/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // service_role client

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    console.log("🟢 Raw body from sendBeacon:", raw);

    let email: string | undefined;
    try {
      const parsed = JSON.parse(raw || "{}");
      email = parsed.email;
    } catch (parseErr) {
      console.error("❌ Failed to parse sendBeacon body:", parseErr);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    console.log("🟢 Parsed email:", email);

    if (!email) {
      return NextResponse.json({ error: "Email missing" }, { status: 400 });
    }

    // 1) Fetch user row (chat + existing summary)
    const { data: userRow, error: fetchError } = await supabaseServer
      .from("users_data")
      .select("chat, chat_summary")
      .eq("email", email)
      .maybeSingle();

    if (fetchError) {
      console.error("❌ Supabase fetch error:", fetchError.message);
      return NextResponse.json({ error: "Chat fetch failed" }, { status: 500 });
    }

    if (!userRow) {
      console.error("❌ No row found for email:", email);
      return NextResponse.json({ error: "User row not found" }, { status: 404 });
    }

    const chatData: any[] = Array.isArray(userRow.chat) ? userRow.chat : [];

    if (chatData.length === 0) {
      console.log("ℹ️ No chat to summarize for:", email);
      // still clear any fully-seen proactive messages (none) and update timestamp
      const { error: updateNoChatErr } = await supabaseServer
        .from("users_data")
        .update({ updated_at: new Date().toISOString() })
        .eq("email", email);

      if (updateNoChatErr) {
        console.error("❌ Supabase update error (no-chat case):", updateNoChatErr.message);
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }

      return NextResponse.json({ message: "No chat to summarize" });
    }

    // 2) Filter messages for summarization (exclude proactive)
    const toSummarize = chatData.filter(
      (m: any) =>
        (m.role === "user" || m.role === "assistant") &&
        !m.proactive
    );

    // Keep unseen proactive messages (we will persist them back into chat)
    const proactiveMsgs = chatData.filter(
      (m: any) => m.proactive === true && m.seen === false
    );

    // If nothing to summarize (only proactive present), just update DB to keep unseen proactive and exit
    if (toSummarize.length === 0) {
      console.log("ℹ️ No user/assistant msgs to summarize, keeping unseen proactive only for:", email);

      const { error: updateError } = await supabaseServer
        .from("users_data")
        .update({
          chat: proactiveMsgs,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (updateError) {
        console.error("❌ Supabase update error (proactive-only):", updateError.message);
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }

      return NextResponse.json({ message: "Only unseen proactive messages kept" });
    }

    // 3) Call summarization model (wrap in try/catch to handle model errors gracefully)
    let newSummary = "No summary generated.";
    try {
      const modelReq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "Summarize the following conversation briefly and clearly in a human-like style. Keep it concise and focused on the user's intents, requests, decisions, and important facts. Exclude system/proactive metadata.",
            },
            { role: "user", content: JSON.stringify(toSummarize) },
          ],
          max_tokens: 400,
        }),
      });

      const modelRes = await modelReq.json();
      newSummary = modelRes.choices?.[0]?.message?.content ?? newSummary;
      console.log("🟢 Generated Summary:", newSummary);
    } catch (modelErr) {
      console.error("❌ Summarization model error:", modelErr);
      // continue — we'll still attempt to append a fallback note
      newSummary = `⚠️ Summary generation failed at ${new Date().toISOString()}.`;
    }

    // 4) Append to old summary (don't overwrite)
    const previousSummary = typeof userRow.chat_summary === "string" && userRow.chat_summary.trim()
      ? userRow.chat_summary
      : "";

    const timestamp = new Date().toISOString();
    const appendedBlock = `\n\n---\nSummary saved: ${timestamp}\n\n${newSummary}`;

    const finalSummary = previousSummary ? `${previousSummary}${appendedBlock}` : `${newSummary}`;

    // 5) Update DB: set chat_summary = finalSummary and keep only unseen proactive messages
    const { error: updateError } = await supabaseServer
      .from("users_data")
      .update({
        chat_summary: finalSummary,
        chat: proactiveMsgs,
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    if (updateError) {
      console.error("❌ Supabase update error (final):", updateError.message);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    console.log("✅ Chat summarized & appended for:", email);

    return NextResponse.json({
      message: "Chat summarized & appended",
      summary: finalSummary,
    });
  } catch (err) {
    console.error("flush-chat failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
