// src/lib/ai/analyzeMessage.ts
import * as chrono from "chrono-node";

type AnalysisResult = {
  mood: string;
  urgency: "immediate" | "normal";
  intent: string;
  suggested_message: string;
  suggested_time: string; // ISO string
  priority: number;
  action: "send_now" | "schedule" | "no_action";
  followup_time?: string; // optional follow-up ISO string
};

// Utility: default 9AM next day
function getTomorrow9AM(timezone: string = "UTC") {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

// Utility: compute dynamic priority based on mood & urgency
function computePriority(mood: string, urgency: "immediate" | "normal"): number {
  let base = 5;
  switch (mood) {
    case "sad":
      base = 1;
      break;
    case "lonely":
      base = 2;
      break;
    case "stressed":
      base = 2;
      break;
    case "nervous":
      base = 3;
      break;
    case "bored":
      base = 4;
      break;
    case "happy":
      base = 5;
      break;
  }
  if (urgency === "immediate") base -= 1; // immediate messages get higher priority
  return Math.max(1, base);
}

// ---- Main function ----
export function analyzeMessage(
  userMessage: string,
  userTimezone: string = "UTC"
): AnalysisResult {
  const text = userMessage.toLowerCase();

  let mood = "neutral";
  let urgency: "immediate" | "normal" = "normal";
  let intent = "none";
  let suggested_message = "";
  let suggested_time = new Date().toISOString();
  let action: "send_now" | "schedule" | "no_action" = "no_action";
  let followup_time: string | undefined;

  // --- Detect mood/intents ---
  if (text.includes("sad") || text.includes("cry") || text.includes("depressed")) {
    mood = "sad";
    urgency = "immediate";
    intent = "emotional_support";
    suggested_message = "I’m here for you 🤗";
    suggested_time = new Date().toISOString();
    action = "send_now";
  } else if (text.includes("lonely") || text.includes("alone")) {
    mood = "lonely";
    urgency = "immediate";
    intent = "companionship";
    suggested_message = "You’re not alone, I’m here with you 💜";
    suggested_time = new Date().toISOString();
    action = "send_now";
  } else if (text.includes("stress") || text.includes("tense") || text.includes("pressure")) {
    mood = "stressed";
    urgency = "immediate";
    intent = "relax_support";
    suggested_message = "Take a deep breath… you’ve got this 🌿";
    suggested_time = new Date().toISOString();
    action = "send_now";
  } else if (text.includes("interview") || text.includes("exam") || text.includes("test")) {
    mood = "nervous";
    urgency = "normal";
    intent = "event_support";
    suggested_message = "Good luck, you’ll do great 💪";
    suggested_time = getTomorrow9AM(userTimezone);
    action = "schedule";
  } else if (text.includes("bored") || text.includes("boring")) {
    mood = "bored";
    urgency = "normal";
    intent = "entertainment";
    suggested_message = "Let’s play a game or try something fun 🎮";
    suggested_time = new Date().toISOString();
    action = "send_now";
  } else if (
    text.includes("happy") ||
    text.includes("party") ||
    text.includes("birthday") ||
    text.includes("celebration")
  ) {
    mood = "happy";
    urgency = "normal";
    intent = "celebration";
    suggested_message = "That’s amazing! 🎉";
    suggested_time = new Date().toISOString();
    action = "send_now";
  }

  // --- Parse natural time if no immediate urgency ---
  if (action === "no_action" || action === "schedule") {
    const parsedDate = chrono.parseDate(userMessage, new Date(), { forwardDate: true });
    if (parsedDate) {
      suggested_time = parsedDate.toISOString();
      action = "schedule";
      intent = "reminder";
      suggested_message = suggested_message || "Okay, I’ll remind you 👍";

      // Optional follow-up: 1 hour later if normal urgency
      if (urgency === "normal") {
        const followup = new Date(parsedDate.getTime() + 60 * 60 * 1000);
        followup_time = followup.toISOString();
      }
    }
  }

  const priority = computePriority(mood, urgency);

  return {
    mood,
    urgency,
    intent,
    suggested_message,
    suggested_time,
    priority,
    action,
    followup_time,
  };
}
