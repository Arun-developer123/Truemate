// src/app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import * as chrono from "chrono-node";

export async function POST(req: Request) {
  try {
    const { email, message } = await req.json();

    if (!email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 1. Fetch user
    const { data: user, error: userError } = await supabaseServer
      .from("users_data")
      .select("id, email, timezone, proactive_enabled, chat")
      .eq("email", email)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Send to Groq for intent analysis
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
            content: `
You are an intent analyzer for a chat assistant.
Your ONLY job is to decide:
- "reminder" → if user asked to be reminded / yaad dilana / notify later
- "proactive_support" → if user sounds stressed, tired, sad (AI should schedule caring msg)
- "chat" → if it's just normal talk

If reminder/proactive: 
1. Extract any natural language time (examples: "in 1 minute", "kal subah 9 baje", "after 2 hours").
2. Suggest the exact text the AI should send at that time.

Return JSON ONLY in this schema (no extra text):
{
  "intent": "reminder" | "proactive_support" | "chat",
  "raw_time_text": string | null,
  "suggested_message": string | null,
  "priority": number,
  "urgency": boolean
}
`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    const aiData = await res.json();
    console.log("AI RAW:", aiData);

    let analysis;
    try {
      analysis = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
    } catch {
      analysis = { intent: "chat" };
    }

    console.log("Parsed analysis:", analysis);

    // 3. Parse time if exists
    let nextTime: string | null = null;
    if (analysis.raw_time_text) {
      const parsed = chrono.parseDate(analysis.raw_time_text, new Date(), {
        forwardDate: true,
      });
      if (parsed) nextTime = parsed.toISOString();
    }

    // 🔹 fallback: agar raw_time_text null hai to pura message parse karo
    if (!nextTime) {
      const parsed = chrono.parseDate(message, new Date(), { forwardDate: true });
      if (parsed) nextTime = parsed.toISOString();
    }

    const baseUrl =
      process.env.BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      `http://localhost:3000`;

    let pushSent = false;

    // 4. Insert scheduled message if proactive/reminder AND nextTime exists
    if (["reminder", "proactive_support"].includes(analysis.intent) && nextTime) {
      try {
        const { error: insertError } = await supabaseServer
          .from("scheduled_messages")
          .insert({
            user_id: user.id,
            trigger_event: analysis.intent,
            next_message_text: analysis.suggested_message || "I'm checking in with you ❤️",
            next_message_time: nextTime,
            priority: analysis.priority || 5,
            urgency: analysis.urgency || false,
            channel: "inapp",
            metadata: { raw_time: analysis.raw_time_text || null },
            status: "pending",
          });

        if (insertError) {
          console.error("❌ DB insert failed:", insertError.message);
        } else {
          console.log("✅ Scheduled message inserted for user:", user.id);

          // Send immediate push notification to user's devices (server-side)
          try {
            const previewText = (analysis.suggested_message || message || "")
              .toString()
              .slice(0, 120);
            await fetch(`${baseUrl}/api/push/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: user.email || email,
                title:
                  analysis.intent === "reminder"
                    ? "Reminder created"
                    : "Truemate: Check-in scheduled",
                body: previewText,
                url: "/chat",
              }),
            });
            pushSent = true;
          } catch (pushErr) {
            console.error("❌ push send error (scheduled):", pushErr);
          }
        }
      } catch (dbErr) {
        console.error("❌ Insert exception:", dbErr);
      }
    } else if (["reminder", "proactive_support"].includes(analysis.intent) && !nextTime) {
      // 5a) If intent indicates proactive/reminder but no time parsed -> create immediate proactive message in chat & notify
      try {
        const proactiveContent = analysis.suggested_message || message || "Hey — checking in with you ❤️";
        const proactiveMsg = {
          role: "assistant",
          content: proactiveContent,
          proactive: true,
          seen: false,
          created_at: new Date().toISOString(),
        };

        const updatedChat = [...(user.chat || []), proactiveMsg];

        const { error: updateError } = await supabaseServer
          .from("users_data")
          .update({
            chat: updatedChat,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (updateError) {
          console.error("❌ Failed to insert immediate proactive message:", updateError.message);
        } else {
          console.log("✅ Immediate proactive message added to chat for user:", user.id);

          // send push to user
          try {
            const previewText = proactiveContent.toString().slice(0, 120);
            await fetch(`${baseUrl}/api/push/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: user.email || email,
                title: "Truemate: New message",
                body: previewText,
                url: "/chat",
              }),
            });
            pushSent = true;
          } catch (pushErr) {
            console.error("❌ push send error (immediate):", pushErr);
          }
        }
      } catch (errInsert) {
        console.error("❌ immediate proactive insert failed:", errInsert);
      }
    }

    // 6. Save user's original message into chat history (user message)
    try {
      const newChat = [...(user.chat || []), { role: "user", content: message }];
      await supabaseServer
        .from("users_data")
        .update({
          chat: newChat,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    } catch (saveErr) {
      console.error("❌ Saving user chat failed:", saveErr);
    }

    return NextResponse.json({
      analysis,
      scheduled: nextTime ? true : false,
      nextTime,
      pushSent,
    });
  } catch (err) {
    console.error("❌ analyze failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
