// src/app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import * as chrono from "chrono-node";

type Analysis = {
  intent?: "reminder" | "proactive_support" | "chat";
  raw_time_text?: string | null;
  suggested_message?: string | null;
  priority?: number;
  urgency?: boolean;
};

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

function addHoursToNow(hours: number) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function addDaysToNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function scheduleMessage(
  baseUrl: string,
  userEmail: string,
  userId: string,
  messageText: string,
  sendTimeISO: string,
  opts: {
    trigger_event?: string;
    priority?: number;
    urgency?: boolean;
    channel?: string;
    metadata?: any;
    pushPreview?: boolean;
  } = {}
) {
  try {
    // avoid scheduling duplicates by checking existing pending with same text
    try {
      const check = await supabaseServer
        .from("scheduled_messages")
        .select("id")
        .eq("user_id", userId)
        .eq("next_message_text", messageText)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();

      if (check?.data) {
        return { ok: true, skipped: true, reason: "already_scheduled" };
      }
    } catch (chkErr) {
      // ignore check errors and continue to attempt insert
      console.warn("scheduleMessage duplicate-check failed:", chkErr);
    }

    const payload = {
      user_id: userId,
      trigger_event: opts.trigger_event || "followup",
      next_message_text: messageText,
      next_message_time: sendTimeISO,
      priority: opts.priority ?? 5,
      urgency: opts.urgency ?? false,
      channel: opts.channel || "inapp",
      metadata: opts.metadata || {},
      status: "pending",
    };

    const { error: insertError } = await supabaseServer
      .from("scheduled_messages")
      .insert(payload);

    if (insertError) {
      console.error("❌ scheduleMessage DB insert failed:", insertError.message);
      return { ok: false, error: insertError.message };
    }

    // attempt to send an immediate push preview (not the scheduled send)
    if (opts.pushPreview) {
      try {
        await fetch(`${baseUrl}/api/push/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail,
            title: "Truemate: New scheduled message",
            body: messageText.toString().slice(0, 120),
            url: "/chat",
          }),
        });
      } catch (pushErr) {
        console.error("❌ push send error (schedule preview):", pushErr);
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("❌ scheduleMessage exception:", err);
    return { ok: false, error: String(err) };
  }
}

export async function POST(req: Request) {
  try {
    // give TS a hint about shape
    const body = (await req.json()) as { email?: string; message?: string };
    const emailRaw = body.email;
    const messageRaw = body.message;

    if (!emailRaw || !messageRaw) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // normalize to string so TS won't complain when passing to functions that require string
    const email = String(emailRaw);
    const message = String(messageRaw);

    // 1. Fetch user
    const { data: user, error: userError } = await supabaseServer
      .from("users_data")
      .select("id, email, timezone, proactive_enabled, chat")
      .eq("email", email)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const baseUrl =
      process.env.BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      `http://localhost:3000`;

    // 2. Send to Groq for intent analysis (original behaviour)
    const res = await fetch(GROQ_API, {
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

    let analysis: Analysis = { intent: "chat" };
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

    let pushSent = false;

    // small helpers for stable string values (user fields may be undefined)
    const userEmail = String(user.email || email);
    const userId = String((user as any).id || "");

    // 4. Insert scheduled message if proactive/reminder AND nextTime exists (original)
    if (["reminder", "proactive_support"].includes(analysis.intent as string) && nextTime) {
      try {
        const { error: insertError } = await supabaseServer
          .from("scheduled_messages")
          .insert({
            user_id: userId,
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
          console.log("✅ Scheduled message inserted for user:", userId);

          // Send immediate push notification to user's devices (server-side)
          try {
            const previewText = (analysis.suggested_message || message || "")
              .toString()
              .slice(0, 120);
            await fetch(`${baseUrl}/api/push/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: userEmail,
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
    } else if (["reminder", "proactive_support"].includes(analysis.intent as string) && !nextTime) {
      // 5a) If intent indicates proactive/reminder but no time parsed -> create immediate proactive message in chat & notify (original)
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
          .eq("id", userId);

        if (updateError) {
          console.error("❌ Failed to insert immediate proactive message:", updateError.message);
        } else {
          console.log("✅ Immediate proactive message added to chat for user:", userId);

          // send push to user
          try {
            const previewText = proactiveContent.toString().slice(0, 120);
            await fetch(`${baseUrl}/api/push/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: userEmail,
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

    // 6. Save user's original message into chat history (user message) (original)
    try {
      const newChat = [...(user.chat || []), { role: "user", content: message, created_at: new Date().toISOString() }];
      await supabaseServer
        .from("users_data")
        .update({
          chat: newChat,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } catch (saveErr) {
      console.error("❌ Saving user chat failed:", saveErr);
    }

    // ---------------------------
    // NEW: Follow-ups / Onboarding (non-destructive, additional)
    // ---------------------------
    const followupResults: any[] = [];

    // determine if user is "new" (no chat or very short chat)
    const chatArr: any[] = Array.isArray(user.chat) ? user.chat : [];
    const isNewUser = chatArr.length === 0 || chatArr.filter((m) => m.role === "user").length <= 1;

    if (isNewUser) {
      // Onboarding sequence: immediate greeting + 3 follow-ups scheduled
      try {
        const onboardingMessages = [
          "Hi! I'm Aarvi — nice to meet you 😊 Before we start, what are 2–3 things you like (hobbies/foods/interests)?",
          "Thanks! And what are 1–2 things you dislike or prefer to avoid?",
          "Cool — what's your current situation? (studying/working/etc.) And any daily routine you'd like me to know?",
          "What are some short-term goals you'd like help with? (today / this week / this month)",
        ];

        const firstOnboardText = onboardingMessages[0];

        // CHECK 1: If the first onboarding text already exists in user's chat, skip inserting it again
        const hasOnboardingInChat = chatArr.some(
          (m) =>
            m &&
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Before we start, what are 2") // small unique substring to identify the message
        );

        // CHECK 2: If there's already a pending scheduled 'onboarding' message for this user, skip immediate insert
        let existingScheduledOnboarding = null;
        try {
          const sch = await supabaseServer
            .from("scheduled_messages")
            .select("id")
            .eq("user_id", userId)
            .eq("trigger_event", "onboarding")
            .eq("status", "pending")
            .limit(1)
            .maybeSingle();
          existingScheduledOnboarding = sch?.data || null;
        } catch (schErr) {
          console.warn("scheduled_messages check failed:", schErr);
        }

        if (!hasOnboardingInChat && !existingScheduledOnboarding) {
          // Insert first onboarding message immediately into chat (assistant proactive)
          const first = {
            role: "assistant",
            content: firstOnboardText,
            proactive: true,
            seen: false,
            created_at: new Date().toISOString(),
          };

          const updatedChat = [...(user.chat || []), first];
          const { error: updateError } = await supabaseServer
            .from("users_data")
            .update({
              chat: updatedChat,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

          if (!updateError) {
            // push preview for immediate onboarding question
            try {
              await fetch(`${baseUrl}/api/push/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: userEmail,
                  title: "Truemate: Let's get to know you",
                  body: firstOnboardText.slice(0, 120),
                  url: "/chat",
                }),
              });
              pushSent = true;
            } catch (pushErr) {
              console.error("❌ push send error (onboarding immediate):", pushErr);
            }
          } else {
            console.error("❌ Failed to add onboarding immediate message to chat:", updateError.message);
          }
        } else {
          console.log("ℹ️ Skipping immediate onboarding message (already present or scheduled).");
        }

        // Schedule subsequent onboarding messages at +1h, +24h, +72h
        const scheduleTimes = [addHoursToNow(1), addDaysToNow(1), addDaysToNow(3)];
        for (let i = 1; i < onboardingMessages.length; i++) {
          const msg = onboardingMessages[i];
          const when = scheduleTimes[i - 1] || addDaysToNow(1);
          // scheduleMessage internally checks duplicates by next_message_text + user_id + pending status
          const resSchedule = await scheduleMessage(baseUrl, userEmail, userId, msg, when, {
            trigger_event: "onboarding",
            priority: 6,
            urgency: false,
            metadata: { stage: i + 1, source: "analyzer-onboarding" },
            pushPreview: false,
          });
          followupResults.push({ type: "onboarding", index: i, msg, when, res: resSchedule });
        }
      } catch (onboardErr) {
        console.error("❌ Onboarding sequence failed:", onboardErr);
      }
    } else {
      // Existing user -> create AI-generated follow-ups based on last messages
      try {
        // Prepare last few messages as context
        const lastMessages = chatArr.slice(-8).map((m) => `${m.role}: ${m.content}`).join("\n");

        const followupPrompt = `
You are a follow-up assistant for a supportive chat AI. A user's recent chat context is below:

${lastMessages}

Task:
1) Propose up to 3 follow-up messages the assistant can send to continue the conversation helpfully (short, friendly, and personalized).
2) For each message, suggest WHEN to send it as "hours_from_now" (numeric), and give "priority" (1-10) and "urgency" (true/false).
3) Return JSON only: [{ "text": "...", "hours_from_now": 24, "priority": 6, "urgency": false }, ...]
If unsure, return an empty array.
`;

        const followRes = await fetch(GROQ_API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: "You are a helpful assistant that returns JSON only." },
              { role: "user", content: followupPrompt },
            ],
            temperature: 0.6,
            max_tokens: 500,
          }),
        });

        const followJson = await followRes.json();
        const followContent = followJson.choices?.[0]?.message?.content || "[]";
        let followUps: Array<{ text: string; hours_from_now?: number; priority?: number; urgency?: boolean }> =
          [];

        try {
          followUps = JSON.parse(followContent);
          if (!Array.isArray(followUps)) followUps = [];
        } catch {
          // try to extract JSON substring (best-effort) without using /s flag
          const maybe = followContent.match(/\[[\s\S]*\]/);
          if (maybe) {
            try {
              followUps = JSON.parse(maybe[0]);
            } catch {
              followUps = [];
            }
          } else {
            followUps = [];
          }
        }

        if (followUps.length === 0) {
          // fallback single check-in after 4h
          followUps = [
            {
              text: "Hey — just checking in. How have you been since we last talked?",
              hours_from_now: 4,
              priority: 5,
              urgency: false,
            },
          ];
        }

        // schedule followUps
        for (const fu of followUps.slice(0, 3)) {
          const hrs = fu.hours_from_now ?? 24;
          const when = addHoursToNow(hrs);
          const resSchedule = await scheduleMessage(baseUrl, userEmail, userId, fu.text, when, {
            trigger_event: "followup",
            priority: fu.priority ?? 5,
            urgency: fu.urgency ?? false,
            channel: "inapp",
            metadata: { source: "analyzer-followup", contextSnapshot: lastMessages.slice(0, 1200) },
            pushPreview: false,
          });
          followupResults.push({ type: "followup", text: fu.text, hours_from_now: hrs, when, res: resSchedule });
        }

        // also schedule a recurring gentle check-in as metadata hint (e.g., weekly)
        try {
          const recapMsg = "Hey — hope things are going okay. If you'd like, tell me one small thing you want to get done this week.";
          const whenWeekly = addDaysToNow(7);
          await scheduleMessage(baseUrl, userEmail, userId, recapMsg, whenWeekly, {
            trigger_event: "weekly_checkin",
            priority: 4,
            urgency: false,
            metadata: { recurring_hint: "weekly", source: "analyzer-weekly" },
            pushPreview: false,
          });
        } catch (recErr) {
          console.error("❌ weekly checkin scheduling failed:", recErr);
        }
      } catch (followErr) {
        console.error("❌ Follow-up generation failed:", followErr);
      }
    }

    return NextResponse.json({
      analysis,
      scheduled: nextTime ? true : false,
      nextTime,
      pushSent,
      followupResults,
      isNewUser,
    });
  } catch (err) {
    console.error("❌ analyze failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
