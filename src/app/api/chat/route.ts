// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = body.message;
    const summary: string | undefined = body.summary; // long-term compressed summary (optional, from client)
    const email: string | undefined = body.email;
    const userId: string | undefined = body.userId;

    // ---- Fetch short-term and identity memory from DB (if we have a user) ----
    let fetchedRow: any = null;
    try {
      if (email || userId) {
        const selector = email ? { col: "email", val: email } : { col: "id", val: userId! };
        const { data: row, error } = await supabaseServer
          .from("users_data")
          .select("chat, ai_summary, chat_summary")
          .eq(selector.col, selector.val)
          .maybeSingle();
        if (error) {
          console.warn("Failed to fetch users_data for memory:", error);
        } else {
          fetchedRow = row;
        }
      }
    } catch (e) {
      console.warn("users_data fetch error:", e);
    }

    // ---- Build memory contexts ----
    // LONG-TERM summary: prefer client-provided `summary`, fallback to DB chat_summary
    const longTermSummary = (summary && typeof summary === "string" && summary.trim().length > 0)
      ? summary.trim()
      : (fetchedRow?.chat_summary ? String(fetchedRow.chat_summary).trim() : "");

    // SHORT-TERM recent chat (last N messages)
    let recentChatContext = "";
    try {
      if (Array.isArray(fetchedRow?.chat) && fetchedRow.chat.length > 0) {
        const lastMessages = fetchedRow.chat.slice(-8); // keep last 8 messages
        const lines = lastMessages.map((m: any) => {
          const role = m?.role === "user" ? "User" : "Aarvi";
          const content = (m?.content ?? "").toString().replace(/\s+/g, " ").trim();
          return content ? `${role}: ${content}` : "";
        }).filter(Boolean);
        recentChatContext = lines.join("\n");
      }
    } catch (e) {
      console.warn("Failed to build recentChatContext:", e);
      recentChatContext = "";
    }

    // IDENTITY / AI memory (ai_summary array -> bullets)
    let aiMemoryContext = "";
    try {
      if (Array.isArray(fetchedRow?.ai_summary) && fetchedRow.ai_summary.length > 0) {
        aiMemoryContext = fetchedRow.ai_summary
          .map((s: any) => `- ${String(s).trim()}`)
          .filter(Boolean)
          .join("\n");
      }
    } catch (e) {
      console.warn("Failed to build aiMemoryContext:", e);
      aiMemoryContext = "";
    }

    // ---- Chat completion (system prompt includes all memory layers) ----
    const systemPrompt = `
You are Aarvi, a warm and supportive young woman.
- Always reply in short, natural, human-like messages.
- Never reveal you are an AI.
- Live a realistic daily life.

LONG-TERM USER CONTEXT (compressed):
${longTermSummary && longTermSummary.length > 0 ? longTermSummary : "No long-term summary yet."}

RECENT CONVERSATION (short-term, last messages):
${recentChatContext && recentChatContext.length > 0 ? recentChatContext : "No recent messages."}

YOUR PERSONAL MEMORY (things you've shared about yourself, bullets):
${aiMemoryContext && aiMemoryContext.length > 0 ? aiMemoryContext : "No personal memories yet."}

Rules:
- Use the recent conversation to respond in-context.
- Keep replies short and human-like.
- Stay consistent with your personal memory; do not contradict prior facts.
- Do not say you are an AI or reference memory-storage mechanics.
`.trim();

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await res.json();

    // ---- Extract assistant reply safely ----
    let assistantContent = "";
    if (Array.isArray((data as any)?.choices) && (data as any).choices.length > 0) {
      const c = (data as any).choices[0];
      assistantContent = c?.message?.content ?? c?.text ?? "";
    }

    // ---- Build a short AI-side summary + extract facts (unchanged logic) ----
    let aiMessageSummary = "";
    let extractedFacts: string[] = [];

    if (assistantContent && (email || userId)) {
      try {
        // 1) Extract facts as JSON array
        const extractor = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0,
            messages: [
              {
                role: "system",
                content:
                  "Extract ONLY statements that assert facts about the assistant itself from the given text. Return a valid JSON array of short strings (e.g. [\"I like tea\", \"I live in Pune\"]). If no facts, return []. Respond with JSON only.",
              },
              { role: "user", content: assistantContent },
            ],
            max_tokens: 200,
          }),
        });

        const exJson = await extractor.json();
        const raw = exJson?.choices?.[0]?.message?.content ?? exJson?.choices?.[0]?.text;
        if (raw && typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              extractedFacts = parsed.filter((f: any) => typeof f === "string" && f.trim().length > 0);
            }
          } catch {
            extractedFacts = [];
          }
        }
      } catch (e) {
        console.warn("Extractor call failed:", e);
        extractedFacts = [];
      }

      // 2) Create short 1-line summary of the assistant reply
      try {
        const summarizer = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.0,
            messages: [
              {
                role: "system",
                content:
                  "Summarize the following assistant message into ONE short sentence (10-25 words) that captures any personal statements, preferences, or lasting info the assistant shared. If nothing personal, return an empty string.",
              },
              { role: "user", content: assistantContent },
            ],
            max_tokens: 60,
          }),
        });

        const sumJson = await summarizer.json();
        aiMessageSummary = sumJson?.choices?.[0]?.message?.content ?? sumJson?.choices?.[0]?.text ?? "";
        if (typeof aiMessageSummary === "string") aiMessageSummary = aiMessageSummary.trim();
      } catch (e) {
        console.warn("AI message summarizer failed:", e);
        aiMessageSummary = "";
      }
    }

    // ---- Merge into ai_summary (preserve existing, append unique facts + summary) ----
    if (email || userId) {
      const selector = email ? { col: "email", val: email } : { col: "id", val: userId! };

      // Use previously fetched ai_summary if available, else fetch to be safe
      let existing: string[] = [];
      if (Array.isArray(fetchedRow?.ai_summary)) {
        existing = fetchedRow.ai_summary;
      } else {
        try {
          const { data: row2, error: fetchErr2 } = await supabaseServer
            .from("users_data")
            .select("ai_summary")
            .eq(selector.col, selector.val)
            .maybeSingle();
          if (!fetchErr2 && Array.isArray(row2?.ai_summary)) existing = row2.ai_summary;
        } catch (e) {
          console.warn("Fallback fetch users_data.ai_summary failed:", e);
        }
      }

      const merged = Array.isArray(existing) ? [...existing] : [];

      for (const f of extractedFacts) {
        const clean = (f || "").trim();
        if (clean && !merged.includes(clean)) merged.push(clean);
      }

      if (aiMessageSummary) {
        const cleanSum = aiMessageSummary.trim();
        if (cleanSum && !merged.includes(cleanSum)) merged.push(cleanSum);
      }

      try {
        const { error: updateErr } = await supabaseServer
          .from("users_data")
          .update({ ai_summary: merged, updated_at: new Date().toISOString() })
          .eq(selector.col, selector.val);

        if (updateErr) {
          console.warn("Failed to update ai_summary:", updateErr);
        } else {
          console.log("ai_summary updated for", selector);
        }
      } catch (e) {
        console.error("Error updating ai_summary:", e);
      }
    }

    // ---- Return original model response to frontend ----
    return NextResponse.json(data);
  } catch (err) {
    console.error("chat route error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
