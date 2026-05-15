// src/app/api/flush-chat/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // service_role client

type Role = "user" | "assistant" | "system";

interface Message {
  role: Role;
  content: string;
  proactive?: boolean;
  seen?: boolean;
}

const TWO_MIN_MS = 2 * 60 * 1000;

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: string[], limit = 25) {
  const out: string[] = [];
  for (const v of values) {
    const clean = safeString(v);
    if (clean && !out.includes(clean)) {
      out.push(clean);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function parseJsonCandidate(raw: string) {
  const trimmed = safeString(raw);
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fenced?.[1]?.trim() || trimmed;

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace >= 0 && lastBrace > firstBrace) {
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeSummaryOutput(raw: string) {
  const parsed = parseJsonCandidate(raw);

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;

    const user_summary = safeString(obj.user_summary ?? obj.chat_summary ?? obj.summary ?? "");
    const ai_summary = safeString(obj.ai_summary ?? obj.assistant_summary ?? obj.ai ?? "");

    return {
      user_summary,
      ai_summary,
    };
  }

  return {
    user_summary: "",
    ai_summary: "",
  };
}

function buildConversationTranscript(messages: Message[]) {
  return messages
    .map((m) => {
      const role = m.role === "user" ? "USER" : m.role === "assistant" ? "AARVI" : "SYSTEM";
      return `${role}: ${safeString(m.content)}`;
    })
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

async function summarizeForUser(email: string, userRow: any) {
  try {
    const chatData: Message[] = Array.isArray(userRow?.chat) ? userRow.chat : [];

    if (chatData.length === 0) {
      console.log(`ℹ️ [${email}] No chat to summarize.`);
      const { error: updateNoChatErr } = await supabaseServer
        .from("users_data")
        .update({ updated_at: new Date().toISOString() })
        .eq("email", email);

      if (updateNoChatErr) {
        console.error(`❌ [${email}] Supabase update error (no-chat case):`, updateNoChatErr.message);
        return { email, status: "no_chat", error: updateNoChatErr.message };
      }

      return { email, status: "no_chat" };
    }

    // Filter messages for summarization (exclude proactive)
    const toSummarize = chatData.filter(
      (m) => (m.role === "user" || m.role === "assistant") && !m.proactive
    );

    // Keep unseen proactive messages
    const proactiveMsgs = chatData.filter((m) => m.proactive === true && !m.seen);

    if (toSummarize.length === 0) {
      console.log(`ℹ️ [${email}] No user/assistant msgs to summarize, keeping unseen proactive only.`);
      const { error: updateError } = await supabaseServer
        .from("users_data")
        .update({
          chat: proactiveMsgs,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (updateError) {
        console.error(`❌ [${email}] Supabase update error (proactive-only):`, updateError.message);
        return { email, status: "proactive_only_update_failed", error: updateError.message };
      }

      return { email, status: "proactive_only_kept" };
    }

    const userMessages = toSummarize.filter((m) => m.role === "user");
    const assistantMessages = toSummarize.filter((m) => m.role === "assistant");

    const userTranscript = buildConversationTranscript(userMessages);
    const assistantTranscript = buildConversationTranscript(assistantMessages);

    // 3) Call summarization model
    let userSummary = "";
    let aiSummary = "";

    try {
      const modelReq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content: `
You are a memory extraction system.

Your job is to read a chat and extract TWO separate summaries:

1) user_summary:
- Only include what the USER said, felt, wanted, decided, promised, or revealed
- Do not include AI statements
- Focus on user intent, preferences, goals, emotions, facts, and decisions

2) ai_summary:
- Only include what the AI (Aarvi) said
- Include promises, suggestions, commitments, follow-ups, advice, tone, and important AI actions

Rules:
- NEVER mix user content and AI content
- NEVER assume AI words belong to the user
- Keep both summaries concise, human-like, and clear
- If a side has nothing important, use an empty string
- Return STRICT JSON ONLY with exactly:
{
  "user_summary": "...",
  "ai_summary": "..."
}
`.trim(),
            },
            {
              role: "user",
              content: `
USER MESSAGES:
${userTranscript || "None"}

AARVI MESSAGES:
${assistantTranscript || "None"}
`.trim(),
            },
          ],
        }),
      });

      const modelRes = (await modelReq.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      const raw = modelRes.choices?.[0]?.message?.content ?? "";
      const parsed = normalizeSummaryOutput(raw);

      userSummary = safeString(parsed.user_summary);
      aiSummary = safeString(parsed.ai_summary);

      console.log(`🟢 [${email}] Generated userSummary:`, userSummary);
      console.log(`🟢 [${email}] Generated aiSummary:`, aiSummary);
    } catch (modelErr) {
      console.error(`❌ [${email}] Summarization model error:`, modelErr);
      userSummary = `⚠️ User summary generation failed at ${new Date().toISOString()}.`;
      aiSummary = `⚠️ AI summary generation failed at ${new Date().toISOString()}.`;
    }

    const timestamp = new Date().toISOString();

    // 4) Append user summary to old chat_summary
    const previousSummary =
      typeof userRow.chat_summary === "string" && userRow.chat_summary.trim()
        ? userRow.chat_summary.trim()
        : "";

    const appendedBlock = `\n\n---\nSummary saved: ${timestamp}\n\n${userSummary || "No user summary generated."}`;
    const finalChatSummary = previousSummary ? `${previousSummary}${appendedBlock}` : `${userSummary}`;

    // 5) Merge AI summary into ai_summary jsonb array
    const existingAiSummaryRaw = Array.isArray(userRow.ai_summary) ? userRow.ai_summary : [];
    const existingAiSummary = existingAiSummaryRaw.map((item: unknown) => safeString(item)).filter(Boolean);

    const finalAiSummary = uniqueStrings(
      [
        ...existingAiSummary,
        ...(aiSummary ? [aiSummary] : []),
      ],
      25
    );

    // 6) Update DB
    const { error: updateError } = await supabaseServer
      .from("users_data")
      .update({
        chat_summary: finalChatSummary,
        ai_summary: finalAiSummary,
        chat: proactiveMsgs,
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    if (updateError) {
      console.error(`❌ [${email}] Supabase update error (final):`, updateError.message);
      return { email, status: "final_update_failed", error: updateError.message };
    }

    console.log(`✅ [${email}] Chat summarized & appended separately.`);
    return {
      email,
      status: "summarized",
      chat_summary: finalChatSummary,
      ai_summary: finalAiSummary,
    };
  } catch (err) {
    console.error(`❌ [${email}] summarizeForUser failed:`, err);
    return { email, status: "error", error: String(err) };
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    console.log("🟢 Raw body from sendBeacon / cron:", raw);

    let email: string | undefined;
    try {
      const parsed = JSON.parse(raw || "{}") as { email?: string };
      email = parsed.email;
    } catch (parseErr) {
      console.error("❌ Failed to parse body:", parseErr);
      // If body is not JSON it's okay — treat as cron if no email found below.
    }

    if (email) {
      console.log("🟢 Parsed email:", email);

      const { data: userRow, error: fetchError } = await supabaseServer
        .from("users_data")
        .select("chat, chat_summary, ai_summary")
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

      const result = await summarizeForUser(email, userRow);
      return NextResponse.json({ message: "Single user processed", result });
    } else {
      console.log("🟢 No email provided — running batch cron mode.");

      const { data: rows, error: fetchAllErr } = await supabaseServer
        .from("users_data")
        .select("email, chat, chat_summary, ai_summary, updated_at");

      if (fetchAllErr) {
        console.error("❌ Supabase fetch-all error:", fetchAllErr.message);
        return NextResponse.json({ error: "Batch fetch failed" }, { status: 500 });
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        console.log("ℹ️ No users found with chat.");
        return NextResponse.json({ message: "No users found" });
      }

      const now = Date.now();
      const toProcess = (rows as any[]).filter((r) => {
        try {
          const chatArr = Array.isArray(r.chat) ? r.chat : [];
          if (chatArr.length === 0) return false;

          if (!r.updated_at) return true;

          const updatedMs = new Date(r.updated_at).getTime();
          return now - updatedMs >= TWO_MIN_MS;
        } catch {
          return false;
        }
      });

      console.log(`🟢 Batch found ${toProcess.length} user(s) to process.`);

      const results: any[] = [];

      for (const row of toProcess) {
        const userEmail = row.email;
        if (!userEmail) {
          console.warn("⚠️ Skipping row with no email:", row);
          continue;
        }

        try {
          const res = await summarizeForUser(userEmail, row);
          results.push(res);
          await new Promise((resDelay) => setTimeout(resDelay, 300));
        } catch (e) {
          console.error(`❌ Error processing ${userEmail}:`, e);
          results.push({ email: userEmail, status: "error", error: String(e) });
        }
      }

      return NextResponse.json({
        message: "Batch flush completed",
        processed: results.length,
        results,
      });
    }
  } catch (err) {
    console.error("flush-chat failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}