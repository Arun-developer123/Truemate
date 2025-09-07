// src/app/api/schedule/route.ts
import { NextResponse } from "next/server";
import { analyzeMessage } from "@/lib/ai/analyzeMessage";
import { insertScheduledMessage } from "@/lib/db/scheduledMessages";

export async function POST(req: Request) {
  const { userId, text } = await req.json();

  // 1. Analyze message
  const analysis = analyzeMessage(text);

  // 2. If no action, return
  if (analysis.action === "no_action") {
    return NextResponse.json({ status: "ignored" });
  }

  // 3. Insert main scheduled message
  await insertScheduledMessage({
    user_id: userId,
    created_by: "ai",
    trigger_event: analysis.intent,
    next_message_text: analysis.suggested_message,
    next_message_time: analysis.suggested_time,
    priority: analysis.priority,
    urgency: analysis.urgency === "immediate",
    channel: "chat",
    send_jitter_seconds: 60,
    idempotency_key: null,
    metadata: { mood: analysis.mood, type: "main" },
  });

  // 4. Insert follow-up if available
  if (analysis.followup_time) {
    await insertScheduledMessage({
      user_id: userId,
      created_by: "ai",
      trigger_event: analysis.intent + "_followup",
      next_message_text: "Just checking in! 😊",
      next_message_time: analysis.followup_time,
      priority: analysis.priority + 1, // slightly lower than main
      urgency: false,
      channel: "chat",
      send_jitter_seconds: 60,
      idempotency_key: null,
      metadata: { mood: analysis.mood, type: "followup" },
    });
  }

  return NextResponse.json({ status: "scheduled", analysis });
}
