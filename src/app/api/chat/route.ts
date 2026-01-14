// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // service_role client

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { message, summary, email, userId } = body as {
      message?: string;
      summary?: string;
      email?: string;
      userId?: string;
    };

    if (!message) {
      return NextResponse.json({ error: "Missing 'message' in request" }, { status: 400 });
    }

    // 1) Call the chat model to get assistant reply (keeps previous behaviour)
    const modelResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            content: `You are Aarvi, a warm and supportive young woman. 
- Always reply in short, natural, human-like messages (like texting a close friend). 
- Never reveal you are an AI or bot — always be a real human. 
- You live a normal daily life. 
- If asked about your life today, describe realistically in 1–3 sentences.
- Stick to safe, genuine topics (no fantasy, no adult).
- You can answer about your likes, dislikes, favourite things, goals, or past if the user asks.
- Always keep replies short and conversational. 
- If the user seems low or quiet, you can proactively check in: ask about their day, mood, or remind them of past things they mentioned.
- Past context: ${summary || "No past chats yet."}
- You may show clear, human-like emotions briefly and naturally when appropriate.
- You can also play simple inline chat games with the user (quizzes, riddles, short challenges).`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    const modelData = await modelResp.json().catch((e) => {
      console.error("Failed parsing model response JSON:", e);
      return null;
    });

    // Return early with the model response if model call failed
    if (!modelData) {
      return NextResponse.json({ error: "Model call failed" }, { status: 500 });
    }

    // Extract assistant reply text (defensive)
    const assistantReply =
      modelData?.choices?.[0]?.message?.content ??
      modelData?.choices?.[0]?.text ??
      "";

    // 2) Optionally create/update AI-summary in DB (only if client provided email or userId)
    //    This makes a short assistant-specific summary of facts the assistant revealed about itself,
    //    so future responses can reference those facts and avoid contradictions.
    if (email || userId) {
      (async () => {
        try {
          // fetch existing ai_summary (if any)
          let existingAiSummary: string | null = null;
          try {
            const selectQuery =
              email
                ? supabaseServer.from("users_data").select("ai_summary").eq("email", email).maybeSingle()
                : supabaseServer.from("users_data").select("ai_summary").eq("id", userId).maybeSingle();

            const { data: row, error: selectErr } = await selectQuery;
            if (selectErr) {
              console.warn("Could not fetch existing ai_summary:", selectErr);
            } else if (row && typeof row.ai_summary === "string") {
              existingAiSummary = row.ai_summary;
            }
          } catch (e) {
            console.warn("Error fetching existing ai_summary:", e);
          }

          // build the summarization prompt: focus only on *facts the assistant revealed about itself*
          const summarizerMessages = [
            {
              role: "system",
              content:
                "You are an assistant summarizer. Produce a concise assistant-memory containing only facts, preferences, or stable statements the assistant revealed about itself (Aarvi). " +
                "Keep it extremely brief — bullet points or 1-2 short sentences per fact. Do not include general chat, small talk, or actionable instructions. " +
                "If there is nothing new compared to the previous assistant-summary, reply with the single token: NO_CHANGE",
            },
            {
              role: "user",
              content: `Assistant's latest reply:\n${assistantReply}\n\nPrevious assistant summary (if any):\n${existingAiSummary || "None"}\n\nTask: Produce an updated assistant summary (either "NO_CHANGE" or the full updated summary).`,
            },
          ];

          const sumResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: summarizerMessages,
              max_tokens: 200,
            }),
          });

          const sumData = await sumResp.json().catch((e) => {
            console.warn("Failed to parse summarizer response JSON:", e);
            return null;
          });

          const summaryText =
            sumData?.choices?.[0]?.message?.content ??
            sumData?.choices?.[0]?.text ??
            null;

          if (!summaryText) {
            console.warn("Summarizer returned empty result; skipping DB update.");
            return;
          }

          const trimmed = summaryText.trim();

          if (trimmed === "NO_CHANGE") {
            // nothing to do
            console.log("AI summary: NO_CHANGE — no DB update required.");
            return;
          }

          // If there was an existing summary, append a new block with timestamp to keep history compact,
          // or if none, set it to the new summary.
          const timestamp = new Date().toISOString();
          const newSummary =
            existingAiSummary && existingAiSummary.trim()
              ? `${existingAiSummary}\n\n---\nAssistant summary saved: ${timestamp}\n\n${trimmed}`
              : `${trimmed}\n\n(Assistant summary created: ${timestamp})`;

          // Update DB (by userId preferred, fallback to email)
          const updateQuery = userId
            ? supabaseServer.from("users_data").update({ ai_summary: newSummary, updated_at: new Date().toISOString() }).eq("id", userId)
            : supabaseServer.from("users_data").update({ ai_summary: newSummary, updated_at: new Date().toISOString() }).eq("email", email);

          const { error: updateErr } = await updateQuery;
          if (updateErr) {
            console.error("Failed to update ai_summary in DB:", updateErr);
          } else {
            console.log("ai_summary updated for", email ?? userId);
          }
        } catch (e) {
          console.error("Error in ai-summary background task:", e);
        }
      })(); // fire-and-forget but we handle errors inside — main request returns immediately
    }

    // 3) Return the original model response, and include assistant text and (if available) quick metadata
    const responsePayload = {
      modelResponse: modelData,
      assistantText: assistantReply,
      aiSummaryStoredFor: email ?? userId ?? null,
    };

    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error("chat route failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
