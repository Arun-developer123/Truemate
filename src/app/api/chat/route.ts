// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = body.message;
    const summary: string | undefined = body.summary;
    const email: string | undefined = body.email;
    const userId: string | undefined = body.userId;

    // 1️⃣ Chat completion (unchanged)
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
- Always reply in short, natural, human-like messages.
- Never reveal you are an AI.
- Live a realistic daily life.
- Past context: ${summary || "No past chats yet."}`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await res.json();

    // 2️⃣ Extract assistant reply safely
    let assistantContent = "";
    if (Array.isArray((data as any)?.choices) && (data as any).choices.length > 0) {
      const c = (data as any).choices[0];
      assistantContent = c?.message?.content ?? c?.text ?? "";
    }

    // 3) Build a short AI-side summary for this assistant reply (always attempt)
    let aiMessageSummary = "";
    let extractedFacts: string[] = [];

    if (assistantContent && (email || userId)) {
      try {
        // 3.a) First: try to extract short facts as JSON array
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

      // 3.b) Additionally: create a short 1-line summary of the assistant reply (useful when there are no explicit facts)
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

    // 4️⃣ GUARANTEED ai_summary initialization + merge (append facts + short summary)
    if (email || userId) {
      const selector = email ? { col: "email", val: email } : { col: "id", val: userId! };

      // fetch existing ai_summary (if any)
      const { data: row, error: fetchErr } = await supabaseServer
        .from("users_data")
        .select("ai_summary")
        .eq(selector.col, selector.val)
        .maybeSingle();

      if (fetchErr) {
        console.warn("Failed to fetch users_data.ai_summary:", fetchErr);
      }

      const existing: string[] = Array.isArray((row as any)?.ai_summary) ? (row as any).ai_summary : [];

      const merged = Array.isArray(existing) ? [...existing] : [];

      // append any extracted facts (unique)
      for (const f of extractedFacts) {
        const clean = (f || "").trim();
        if (clean && !merged.includes(clean)) merged.push(clean);
      }

      // ALSO append aiMessageSummary if non-empty and not duplicate
      if (aiMessageSummary) {
        const cleanSum = aiMessageSummary.trim();
        if (cleanSum && !merged.includes(cleanSum)) merged.push(cleanSum);
      }

      // ALWAYS update — even if empty → converts NULL -> []
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

    // 5) Return original model response to frontend
    return NextResponse.json(data);
  } catch (err) {
    console.error("chat route error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
