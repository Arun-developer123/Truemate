// src/app/api/flush-chat/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // service_role client

type Role = "user" | "assistant" | "system";

interface Message {
  role: Role;
  content: string;
  proactive?: boolean;
  seen?: boolean;
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    console.log("🟢 Raw body from sendBeacon:", raw);

    let email: string | undefined;
    try {
      const parsed = JSON.parse(raw || "{}") as { email?: string };
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

    const chatData: Message[] = Array.isArray(userRow.chat) ? userRow.chat : [];

    if (chatData.length === 0) {
      console.log("ℹ️ No chat to summarize for:", email);
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
      (m) => (m.role === "user" || m.role === "assistant") && !m.proactive
    );

    // Keep unseen proactive messages
    const proactiveMsgs = chatData.filter((m) => m.proactive === true && !m.seen);

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

    // 3) Call summarization model
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

      const modelRes = (await modelReq.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      newSummary = modelRes.choices?.[0]?.message?.content ?? newSummary;
      console.log("🟢 Generated Summary:", newSummary);
    } catch (modelErr) {
      console.error("❌ Summarization model error:", modelErr);
      newSummary = `⚠️ Summary generation failed at ${new Date().toISOString()}.`;
    }

    // 4) Append to old summary
    const previousSummary =
      typeof userRow.chat_summary === "string" && userRow.chat_summary.trim()
        ? userRow.chat_summary
        : "";

    const timestamp = new Date().toISOString();
    const appendedBlock = `\n\n---\nSummary saved: ${timestamp}\n\n${newSummary}`;
    const finalSummary = previousSummary ? `${previousSummary}${appendedBlock}` : `${newSummary}`;

    // 5) Update DB
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
