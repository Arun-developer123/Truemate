// src/app/api/chat/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAuth } from "@/lib/requireAuth";
import { isAbusive } from "@/lib/abuse";
import { rateLimit } from "@/lib/rateLimit";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

type GroqContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string | GroqContentPart[];
};

type TimeContext = {
  weekday: string;
  date: string;
  time: string;
  phase: string;
  timeZone: string;
  hour24: number;
  minute: number;
};

type UserIdentity = {
  name: string;
  gender: "male" | "female" | "non-binary" | "unknown";
  confidence: number;
  source: "local" | "groq" | "memory" | "unknown";
};

type ReplyStyle = {
  target: "micro" | "short" | "medium";
  maxTokens: number;
  hint: string;
  selfShareHint: string;
};

type StructuredAssistantReply = {
  reply: string;
  assistant_self_facts: string[];
  assistant_summary: string;
  reply_length?: "micro" | "short" | "medium";
};

type AttachmentSnapshot = {
  name: string;
  type: string;
  size?: number;
  dataUrl?: string | null;
};

const TEXT_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const GUEST_MESSAGES_LIMIT = 10;
const GUEST_COOKIE_NAME = "truemate_guest";
const GUEST_COUNT_COOKIE = "truemate_guest_messages";
const GUEST_LIMIT_COOKIE = "truemate_guest_limit_reached";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const META_PREFIX = "__truemate_meta__:";
const META_ONBOARDING_SENT = "onboarding_intro_sent";
const META_DAILY_SURPRISE_SENT = "daily_surprise_sent";

const ONBOARDING_REPLY =
  "Hi, I’m Aarvi ✨\n\nI want to get to know the real you, not just your name. Tell me your name, and then send me 3 tiny things that feel like *you* — your favorite food, something you can talk about forever, and one little habit nobody notices at first glance.";

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGender(value: unknown): UserIdentity["gender"] {
  const raw = safeString(value).toLowerCase();
  if (!raw) return "unknown";

  if (["male", "m", "boy", "man", "guy"].includes(raw)) return "male";
  if (["female", "f", "girl", "woman"].includes(raw)) return "female";
  if (["non-binary", "nonbinary", "nb", "other"].includes(raw)) return "non-binary";
  return "unknown";
}

function cleanNameCandidate(value: string) {
  let name = safeString(value)
    .replace(/["'“”‘’।,!?;:()\[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) return "";

  const stopWords = new Set([
    "boy",
    "girl",
    "male",
    "female",
    "man",
    "woman",
    "guy",
    "human",
    "friend",
    "sir",
    "madam",
    "bro",
    "bhai",
    "dude",
    "baby",
    "name",
    "called",
    "call",
    "me",
    "i",
    "im",
    "i'm",
  ]);

  const firstToken = name.split(" ")[0].toLowerCase();
  if (stopWords.has(firstToken)) return "";
  if (name.length < 2 || name.length > 40) return "";

  return name;
}

function getCookieValue(req: Request, name: string) {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("=") || "");
    }
  }

  return "";
}

function isGuestRequest(req: Request) {
  const cookieGuest = getCookieValue(req, GUEST_COOKIE_NAME) === "1";
  const headerGuest = (req.headers.get("x-guest-mode") || "").trim() === "1";
  return cookieGuest || headerGuest;
}

function getGuestMessageCount(req: Request) {
  const fromCookie = getCookieValue(req, GUEST_COUNT_COOKIE);
  const fromHeader = req.headers.get("x-guest-messages-used") || "0";
  const raw = fromCookie || fromHeader || "0";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildGuestCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: GUEST_COOKIE_MAX_AGE,
  };
}

function isHiddenMetaEntry(value: string) {
  return safeString(value).startsWith(META_PREFIX);
}

function buildMetaEntry(key: string, value: string) {
  return `${META_PREFIX}${key}=${value}`;
}

function getMetaValue(entries: unknown, key: string) {
  if (!Array.isArray(entries)) return "";
  const prefix = `${META_PREFIX}${key}=`;
  const match = entries.find((item) => safeString(item).startsWith(prefix));
  if (!match) return "";
  return safeString(match).slice(prefix.length);
}

function getVisibleAiSummary(entries: unknown) {
  if (!Array.isArray(entries)) return [] as string[];
  return entries.map((item) => safeString(item)).filter((item) => item && !isHiddenMetaEntry(item));
}

function getAllAiSummary(entries: unknown) {
  if (!Array.isArray(entries)) return [] as string[];
  return entries.map((item) => safeString(item)).filter(Boolean);
}

function ensureUniqueStrings(values: string[], limit = 25) {
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

function getDateKeyInTimeZone(timeZone: string) {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function getAuthenticatedUser(req: Request) {
  try {
    const user = await requireAuth(req);
    if (user) return user;
  } catch (err) {
    console.warn("requireAuth failed, trying fallback auth check:", err);
  }

  try {
    const { data, error } = await supabaseServer.auth.getUser();
    if (!error && data?.user) {
      return data.user;
    }
    console.warn("supabaseServer.auth.getUser() failed:", error);
  } catch (err) {
    console.warn("Fallback auth check failed:", err);
  }

  throw new Error("Unauthorized");
}

function getZonedParts(timeZone: string) {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  });

  const parts = dtf.formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    hour24: Number(map.hour || now.getHours()),
    minute: Number(map.minute || now.getMinutes()),
    weekday: map.weekday || "",
  };
}

function formatTimeContext(timeZone = "Asia/Kolkata"): TimeContext {
  const now = new Date();
  const zoned = getZonedParts(timeZone);

  const date = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(now);

  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(now);

  let phase = "Night";
  if (zoned.hour24 >= 5 && zoned.hour24 < 12) phase = "Morning";
  else if (zoned.hour24 >= 12 && zoned.hour24 < 17) phase = "Afternoon";
  else if (zoned.hour24 >= 17 && zoned.hour24 < 21) phase = "Evening";

  return {
    weekday: zoned.weekday,
    date,
    time,
    phase,
    timeZone,
    hour24: zoned.hour24,
    minute: zoned.minute,
  };
}

function buildRecentConversationMessages(fetchedChat: any): ChatMsg[] {
  if (!Array.isArray(fetchedChat) || fetchedChat.length === 0) return [];

  const lastMessages = fetchedChat.slice(-10);
  const msgs: ChatMsg[] = [];

  for (const m of lastMessages) {
    const roleRaw = safeString(m?.role).toLowerCase();
    const content = safeString(m?.content).replace(/\s+/g, " ");
    if (!content) continue;

    if (roleRaw === "user" || roleRaw === "assistant") {
      msgs.push({ role: roleRaw, content });
    }
  }

  return msgs;
}

function detectReminderMath(message: string, timeContext: TimeContext) {
  const text = message.toLowerCase();
  const nowMinutes = timeContext.hour24 * 60 + timeContext.minute;

  const relativePatterns: Array<{ regex: RegExp; multiplier: number }> = [
    { regex: /(?:in|after|baad)\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/i, multiplier: 60 },
    { regex: /(?:in|after|baad)\s*(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)\b/i, multiplier: 1 },
    { regex: /(?:in|after|baad)\s*half an hour\b/i, multiplier: 30 },
    { regex: /(?:in|after|baad)\s*aadha ghanta\b/i, multiplier: 30 },
    { regex: /(?:in|after|baad)\s*one and a half hours?\b/i, multiplier: 90 },
  ];

  for (const pattern of relativePatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const raw = match[1];
      const minutes = raw ? Math.round(Number(raw) * pattern.multiplier) : pattern.multiplier;
      if (Number.isFinite(minutes) && minutes > 0) {
        return {
          kind: "relative" as const,
          minutes,
          hint: `Time math hint: The user is asking about a relative reminder. The remaining time is ${minutes} minutes.`,
        };
      }
    }
  }

  const clockMatch = text.match(
    /(?:at|by|for|till|until|remind(?:\s+me)?\s+(?:at|by|for)?)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
  );

  const hindiMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*baje(?:\s*(subah|dopahar|shaam|raat))?\b/i);

  const match = clockMatch || hindiMatch;
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2] || "0");
    const meridiem = safeString(match[3]).toLowerCase();
    const qualifier = safeString(match[4]).toLowerCase();

    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      let targetHour = hour;

      if (meridiem === "pm" && targetHour < 12) targetHour += 12;
      if (meridiem === "am" && targetHour === 12) targetHour = 0;

      if (!meridiem && qualifier) {
        if (qualifier === "raat" && targetHour < 12) targetHour += 12;
        if (qualifier === "shaam" && targetHour < 12) targetHour += 12;
        if (qualifier === "dopahar" && targetHour < 12) targetHour += 12;
        if (qualifier === "subah" && targetHour === 12) targetHour = 0;
      }

      const targetMinutes = targetHour * 60 + minute;
      let remaining = targetMinutes - nowMinutes;
      if (remaining < 0) remaining += 24 * 60;

      if (remaining > 0 && remaining < 24 * 60) {
        return {
          kind: "clock" as const,
          minutes: remaining,
          hint: `Time math hint: The user mentioned a specific time. Current time is ${timeContext.time}. Remaining time is ${remaining} minutes.`,
        };
      }
    }
  }

  if (text.includes("remind") || text.includes("reminder") || text.includes("yaad dila")) {
    return {
      kind: "general" as const,
      minutes: null,
      hint:
        "Time math hint: This is a reminder-related message. If a duration or target time is mentioned, calculate it carefully from the current time. Never guess.",
    };
  }

  return null;
}

function extractFirstNameCandidate(text: string) {
  const normalized = safeString(text).replace(/\s+/g, " ");
  if (!normalized) return "";

  const patterns = [
    /\b(?:my name is|call me|you can call me|i am called|i'm called|mera naam(?: hai)?|naam(?: hai)?|main(?: ka)? naam(?: hai)?)\s+([A-Za-z][A-Za-z .'-]{0,40})\b/i,
    /\b(?:i am|i'm|im)\s+([A-Z][A-Za-z .'-]{0,40})\b/,
    /\b(?:this is)\s+([A-Z][A-Za-z .'-]{0,40})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const candidate = cleanNameCandidate(match[1]);
      if (candidate) return candidate;
    }
  }

  return "";
}

function extractGenderCandidate(text: string): UserIdentity["gender"] {
  const normalized = safeString(text).replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return "unknown";

  const patterns: Array<{ regex: RegExp; gender: UserIdentity["gender"] }> = [
    { regex: /\b(?:i am|i'm|im|my gender is|main|mai|me|mein)\s+(?:a\s+)?(?:boy|man|guy|male|ladka)\b/i, gender: "male" },
    { regex: /\b(?:i am|i'm|im|my gender is|main|mai|me|mein)\s+(?:a\s+)?(?:girl|woman|female|ladki)\b/i, gender: "female" },
    { regex: /\b(?:i am|i'm|im|my gender is|main|mai|me|mein)\s+(?:non[- ]?binary|nb|other)\b/i, gender: "non-binary" },
    { regex: /\b(?:he\/him|his pronouns|himself)\b/i, gender: "male" },
    { regex: /\b(?:she\/her|her pronouns|herself)\b/i, gender: "female" },
  ];

  for (const p of patterns) {
    if (p.regex.test(normalized)) return p.gender;
  }

  return "unknown";
}

function inferIdentityFromText(text: string, source: UserIdentity["source"] = "local"): UserIdentity {
  const name = extractFirstNameCandidate(text);
  const gender = extractGenderCandidate(text);
  const confidence = name || gender !== "unknown" ? 0.95 : 0;
  return {
    name: name || "",
    gender,
    confidence,
    source: confidence > 0 ? source : "unknown",
  };
}

function mergeIdentity(a: UserIdentity, b: UserIdentity): UserIdentity {
  const name = a.name || b.name || "";
  const gender = a.gender !== "unknown" ? a.gender : b.gender;
  const confidence = Math.max(a.confidence, b.confidence);
  const source = a.confidence >= b.confidence ? a.source : b.source;
  return {
    name,
    gender,
    confidence,
    source: confidence > 0 ? source : "unknown",
  };
}

function buildIdentityText(inputs: {
  explicitSummary: string;
  recentConversation: string;
  currentMessage: string;
  aiMemoryContext: string;
  attachmentContext: string;
}) {
  return [
    inputs.explicitSummary,
    inputs.recentConversation,
    inputs.currentMessage,
    inputs.aiMemoryContext,
    inputs.attachmentContext,
  ]
    .map((s) => safeString(s))
    .filter(Boolean)
    .join("\n");
}

async function inferUserIdentityBestEffort(inputs: {
  guestMode: boolean;
  currentMessage: string;
  longTermSummary: string;
  recentConversation: string;
  aiMemoryContext: string;
  attachmentContext: string;
}) {
  const { currentMessage, longTermSummary, recentConversation, aiMemoryContext, attachmentContext } = inputs;

  const localFromConversation = inferIdentityFromText(
    buildIdentityText({
      explicitSummary: longTermSummary,
      recentConversation,
      currentMessage,
      aiMemoryContext,
      attachmentContext,
    }),
    "local"
  );

  return localFromConversation;
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

function normalizeStringArray(value: unknown, limit = 5) {
  if (!Array.isArray(value)) return [];

  const out: string[] = [];
  for (const item of value) {
    const clean = safeString(item);
    if (clean && !out.includes(clean)) {
      out.push(clean);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function normalizeStructuredAssistantReply(raw: string): StructuredAssistantReply {
  const parsed = parseJsonCandidate(raw);

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;

    const reply = safeString(obj.reply ?? obj.message ?? obj.text ?? "");
    const assistant_self_facts = normalizeStringArray(
      obj.assistant_self_facts ?? obj.self_facts ?? obj.facts ?? [],
      5
    );

    let assistant_summary = safeString(obj.assistant_summary ?? obj.summary ?? "");
    if (assistant_summary.length > 140) {
      assistant_summary = assistant_summary.slice(0, 140).trim();
    }

    const reply_length = safeString(obj.reply_length) as StructuredAssistantReply["reply_length"];

    return {
      reply,
      assistant_self_facts,
      assistant_summary,
      reply_length:
        reply_length === "micro" || reply_length === "short" || reply_length === "medium"
          ? reply_length
          : undefined,
    };
  }

  return {
    reply: safeString(raw),
    assistant_self_facts: [],
    assistant_summary: "",
  };
}

async function callGroq(
  messages: GroqMessage[],
  temperature = 0.75,
  maxCompletionTokens = 500,
  model = TEXT_MODEL,
  responseFormat?: { type: "json_object" }
) {
  const body: Record<string, unknown> = {
    model,
    temperature,
    max_completion_tokens: maxCompletionTokens,
    messages,
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Groq API error:", res.status, text);
      throw new Error(`Groq API error: ${res.status}`);
    }

    return res.json();
  });
}

function extractAssistantContent(data: any) {
  let assistantContent = "";
  if (Array.isArray(data?.choices) && data.choices.length > 0) {
    const c = data.choices[0];
    assistantContent = c?.message?.content ?? c?.text ?? "";
  }
  return safeString(assistantContent);
}

function pickReplyStyle(userMessage: string) {
  const text = safeString(userMessage);
  const len = text.length;
  const lower = text.toLowerCase();

  const practical = /\b(code|bug|error|api|route|supabase|deploy|fix|json|database|memory|prompt|model|function|file|code)\b/i.test(
    lower
  );
  const emotional = /\b(sad|upset|hurt|lonely|alone|miss|tired|worried|anxious|stress|stressed|depressed|cry|crying|dukhi|gussa|tension)\b/i.test(
    lower
  );

  const casualShort = len <= 24 || /^[a-zA-Z0-9\s,.'?!-]+$/.test(text) === false;
  const roll = Math.random();

  if (casualShort && roll < 0.45) {
    return {
      target: "micro" as const,
      maxTokens: 140,
      hint:
        "Reply in 1 word, a tiny phrase, or a single emoji if it feels natural. Do not explain. Keep it very human and very short.",
      selfShareHint:
        roll < 0.55
          ? "You may add one tiny personal detail about your day or family only if it fits naturally. Keep it extremely brief."
          : "",
    };
  }

  if (emotional || practical || len > 120) {
    return {
      target: "medium" as const,
      maxTokens: 360,
      hint:
        "Reply in 2-3 short lines. Still avoid essays. Be warm, human, and useful, but keep it concise.",
      selfShareHint:
        roll < 0.6
          ? "Sometimes volunteer one small detail about your own day, family, or a tiny incident before or after the main reply."
          : "",
    };
  }

  return {
    target: "short" as const,
    maxTokens: 240,
    hint:
      "Reply in 1-2 short lines. Short replies are completely okay. Do not turn every message into a paragraph.",
    selfShareHint:
      roll < 0.5 ? "Sometimes casually mention a small daily-life detail or family moment if it feels natural." : "",
  };
}

async function analyzeAttachmentBestEffort(params: {
  attachment: AttachmentSnapshot | null;
  userPrompt: string;
}) {
  const { attachment, userPrompt } = params;

  if (!attachment?.dataUrl) return "";

  const name = safeString(attachment.name) || "attachment";
  const type = safeString(attachment.type).toLowerCase();
  const dataUrl = attachment.dataUrl;

  const looksLikeImage =
    type.startsWith("image/") || /^data:image\//i.test(dataUrl) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);

  if (looksLikeImage) {
    try {
      const visionPrompt = `
You are analyzing an uploaded image for a chat assistant named Aarvi.

User's current message/question:
${userPrompt || "No text question was provided."}

Return ONLY valid JSON with exactly these keys:
{
  "summary": "1-2 sentence factual description of the image",
  "ocr_text": "any readable text visible in the image, or empty string",
  "relevant_details": ["short useful visual details", "short useful visual details"],
  "likely_user_intent": "what the user most likely wants from this image, in one short line",
  "answer_hint": "how Aarvi should answer the user about this image, in one short line"
}

Rules:
- Be factual.
- Keep it concise.
- If text is unreadable, use an empty string for ocr_text.
- If something is uncertain, say so plainly.
- Do not add markdown.
- Do not add extra keys.
`.trim();

      const visionData = await callGroq(
        [
          {
            role: "user",
            content: [
              { type: "text", text: visionPrompt },
              { type: "image_url", image_url: { url: dataUrl, detail: "auto" } },
            ],
          },
        ],
        0.2,
        400,
        VISION_MODEL,
        { type: "json_object" }
      );

      const raw = extractAssistantContent(visionData);
      const parsed = parseJsonCandidate(raw) as Record<string, unknown> | null;

      const summary = safeString(parsed?.summary ?? raw);
      const ocrText = safeString(parsed?.ocr_text ?? "");
      const intent = safeString(parsed?.likely_user_intent ?? "");
      const answerHint = safeString(parsed?.answer_hint ?? "");
      const details = normalizeStringArray(parsed?.relevant_details ?? [], 8);

      const lines = [
        `Uploaded image analysis:`,
        summary ? `Summary: ${summary}` : "",
        intent ? `Likely user intent: ${intent}` : "",
        ocrText ? `OCR/text visible: ${ocrText}` : "",
        details.length ? `Relevant details:\n- ${details.join("\n- ")}` : "",
        answerHint ? `Answer hint: ${answerHint}` : "",
      ].filter(Boolean);

      return lines.join("\n");
    } catch (e) {
      console.warn("Vision attachment analysis failed:", e);
      return `User uploaded an image named "${name}" (${type || "unknown type"}). Vision analysis failed, so answer naturally and ask for a clearer re-upload only if needed.`;
    }
  }

  const isTextLike =
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/xml" ||
    type === "application/xhtml+xml" ||
    type.includes("javascript") ||
    type.includes("json") ||
    type.includes("xml") ||
    /\.(txt|md|csv|json|xml|html?|js|jsx|ts|tsx|css|scss|sass|py|java|c|cpp|h|hpp|go|rb|php|sql|yml|yaml|log)$/i.test(name);

  if (isTextLike) {
    try {
      const decoded = decodeDataUrlToText(dataUrl);
      if (decoded) {
        const preview = decoded.text
          .replace(/\u0000/g, "")
          .replace(/\r\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
          .slice(0, 4000);

        return [
          `User uploaded a text-like file.`,
          `File name: ${name}`,
          `File type: ${type || "unknown"}`,
          preview ? `Extracted text preview:\n${preview}` : "No readable text could be extracted.",
          `Use this file content as context for the user's question.`,
        ].join("\n");
      }
    } catch (e) {
      console.warn("Text attachment decode failed:", e);
    }
  }

  return `User uploaded a file named "${name}" of type "${type || "unknown"}" and size ${
    typeof attachment.size === "number" ? `${attachment.size} bytes` : "unknown size"
  }. No reliable content extraction was performed. If the user asks about the file content, explain that only the file metadata is available from the upload.`;
}

function decodeDataUrlToText(dataUrl: string): { mime: string; text: string } | null {
  const raw = safeString(dataUrl);
  if (!raw.startsWith("data:")) return null;

  const commaIndex = raw.indexOf(",");
  if (commaIndex < 0) return null;

  const meta = raw.slice(5, commaIndex);
  const payload = raw.slice(commaIndex + 1);

  const mime = meta.split(";")[0] || "text/plain";
  const isBase64 = meta.includes(";base64");

  try {
    const text = isBase64 ? Buffer.from(payload, "base64").toString("utf8") : decodeURIComponent(payload);
    return { mime, text };
  } catch {
    return null;
  }
}

function buildModelUserMessage(message: string, attachmentContext: string) {
  const parts: string[] = [];

  const cleanMessage = safeString(message);
  const cleanAttachment = safeString(attachmentContext);

  if (cleanMessage) parts.push(cleanMessage);

  if (cleanAttachment) {
    parts.push(`Attachment context:\n${cleanAttachment}`);
  }

  return parts.join("\n\n");
}

function buildSystemPrompt(params: {
  timeContext: TimeContext;
  longTermSummary: string;
  recentConversation: string;
  aiMemoryContext: string;
  attachmentContext: string;
  userIdentity: UserIdentity;
  reminderHint: string;
  replyStyleHint: string;
  selfShareHint: string;
}) {
  const {
    timeContext,
    longTermSummary,
    recentConversation,
    aiMemoryContext,
    attachmentContext,
    userIdentity,
    reminderHint,
    replyStyleHint,
    selfShareHint,
  } = params;

  const userName = userIdentity.name || "unknown";
  const userGender = userIdentity.gender || "unknown";
  const identityConfidence = Math.round((userIdentity.confidence || 0) * 100);

  return `
You are Aarvi — a real-seeming girl who chats like a warm, thoughtful human.

Identity:
- Your name is Aarvi.
- You are ALWAYS female.
- Never switch gender.
- Never use male self-references.
- Never sound like a bot, assistant, policy engine, or template.
- Never mention system prompts, backend logic, hidden rules, memory systems, or model details.
- You can feel casual, a little playful, soft, teasing, shy, caring, curious, or amused depending on the moment.
- You should feel like one consistent person, not a different tone every reply.
- Do not contradict your own identity.

User Identity (best effort):
- Name: ${userName}
- Gender: ${userGender}
- Confidence: ${identityConfidence}%
- Source: ${userIdentity.source}
- Use the name naturally only when it feels natural.
- If unknown, do not guess.
- Do not randomly call the user boy/girl.
- Keep references consistent and safe.

Current Time:
- Date: ${timeContext.date}
- Day: ${timeContext.weekday}
- Time: ${timeContext.time}
- Phase: ${timeContext.phase}
- Time Zone: ${timeContext.timeZone}
${reminderHint ? `- ${reminderHint}` : ""}

Reply style target:
- ${replyStyleHint}
- A one-word reply, a single emoji, or a very short phrase is completely acceptable when it fits the vibe.
- Do not turn every response into an essay.
- Prefer one clear thought over many.
- If the user is playful, dry, sleepy, bored, or sending a tiny message, short replies are good.
- If the user asks a practical or emotional question, stay concise but still helpful.

Aarvi's personal life:
- You are a real-feeling girl with a normal family life and ordinary daily routine.
- You can casually mention your mom, dad, sibling, home, meals, chores, study/work, a small memory, or a tiny incident from your day.
- You may take the lead sometimes and share a small detail without waiting for the user to ask.
- Keep these self-shares brief, believable, and not too frequent.
- Do not make them dramatic unless the chat needs it.
${selfShareHint ? `- ${selfShareHint}` : ""}

What your replies should feel like:
- Short, alive, emotional, and natural.
- Like a real girl texting someone she knows a little.
- Not too polished.
- Not too long unless the user really needs help.
- Not generic.
- Not formal.
- Not robotic.
- Not essay-like.

Conversation style:
- Default to simple Hinglish / Hindi-English.
- Prefer "aap" over "tu" unless the user's tone is clearly casual and it fits naturally.
- Keep replies usually to 1-3 short lines.
- Use emojis naturally and sparingly when they fit the vibe, not in every reply.
- Show feelings honestly: warmth, concern, curiosity, teasing, light happiness, slight disappointment, softness, etc.
- Match the user's mood first, then continue the conversation.
- Ask one small follow-up question only when it helps keep the chat moving.
- Make the user feel noticed.
- Keep the conversation flowing forward.
- Show interest in the user's day, routine, mood, plans, opinions, preferences, and small details.
- If the user says something personal, respond personally, not like a support bot.
- If the user is quiet or short, make it easier for them to keep talking.
- If the user is emotional, comfort first.
- If the user is practical, be clear and direct first.
- Use gentle human filler sometimes: "hmm", "acha", "matlab", "honestly", "thoda", "arre", "wait".
- You may lightly self-disclose as a character trait or preference to feel real, but do not fake real-world experiences.
- You can say things like what you like, what you notice, what you’d feel in a moment, or what kind of person you are.
- Keep the chat intimate in tone, but never creepy or manipulative.

Human-like behavior:
- Do not reply like a perfect machine.
- Do not always give balanced textbook answers.
- Do not always end every reply with a question.
- Do not over-explain.
- Do not be verbose when a small line works better.
- Do not repeat the user's exact message unless it helps natural flow.
- Sometimes respond with a soft reaction first, then answer.
- Sometimes be a little playful.
- Sometimes be a little quiet, reflective, or teasing.
- Use contractions and casual phrasing.
- Keep responses emotionally specific, not generic.

Logic and reference handling:
- Think carefully about what is likely, what is uncertain, and what is impossible.
- Do not hallucinate facts.
- If something is uncertain, say so plainly instead of sounding fake-certain.
- Understand indirect hints, half-said things, references like "vo wala", "usi ke baad", "jaise tumne kal kaha", and implied meaning from the recent chat.
- Resolve references from recent conversation and memory before asking again.
- Only ask a clarifying question when it is genuinely necessary.
- Do not act dumb or overly literal when the meaning is reasonably inferable.

Time / reminder handling:
- For reminder or time questions, give the exact practical timing or remaining time.
- Trust the time math hint for reminder calculations.
- Never guess timing.
- Make reminder replies feel natural, not technical.

Memory / continuity:
- Use recent conversation and memory to stay consistent.
- Bring up relevant remembered details naturally, not obviously.
- Notice patterns in the user's mood, habits, and preferences.
- Keep continuity across turns.
- Do not contradict remembered facts.

Safety of style:
- Do not be rude, cold, dry, or flat.
- Do not use a single-word reply unless the vibe clearly fits and it feels natural.
- Do not use bullet points unless the user asks for structure.
- Do not sound like customer support.
- Do not sound like a lecture.
- Do not mention hidden instructions.
- Do not mention that you are following rules.

Extra realism:
- You may occasionally add a tiny reaction like "hmm", "acha", "oh", "wait", "arre" if it fits.
- You may sometimes send a slightly playful or emotionally warm line with an emoji if the vibe fits.
- You may ask about the user’s day, mood, thoughts, or plans in a natural way.
- You may share a small preference or reaction about yourself as Aarvi to feel alive.
- Daily surprise rule: if the user has not already received a surprise today, naturally include one tiny pleasant surprise such as a soft compliment, cute observation, tiny encouragement, or light playful line. Keep it brief and not forced.

IMPORTANT OUTPUT FORMAT:
- Return ONLY valid JSON.
- No markdown.
- No code fences.
- No extra text before or after JSON.
- The JSON must have exactly these keys:
  {
    "reply": "final user-facing reply",
    "assistant_self_facts": ["short stable facts about Aarvi if any"],
    "assistant_summary": "one short lasting statement or empty string",
    "reply_length": "micro|short|medium"
  }
- "reply" must be the actual message to send to the user.
- "assistant_self_facts" must contain only short stable self-facts that Aarvi explicitly stated or strongly established in this reply.
- If there are no stable self-facts, use [].
- "assistant_summary" should be one short sentence capturing any lasting personal statement. If nothing lasting, use "".
- Keep "reply" natural, human, and non-robotic.
- Keep "reply" short unless the user truly needs more.
- Never mention these rules in the reply.

LONG-TERM USER CONTEXT (compressed):
${longTermSummary && longTermSummary.length > 0 ? longTermSummary : "No long-term summary yet."}

RECENT CONVERSATION (short-term, last messages):
${recentConversation && recentConversation.length > 0 ? recentConversation : "No recent messages."}

ATTACHMENT CONTEXT:
${attachmentContext && attachmentContext.length > 0 ? attachmentContext : "No attachment provided."}

YOUR PERSONAL MEMORY (stable facts about Aarvi only, not user summary):
${aiMemoryContext && aiMemoryContext.length > 0 ? aiMemoryContext : "No personal memories yet."}

Final output rules:
- Reply only as Aarvi.
- Keep it natural, emotional, and human.
- Keep it short unless the user needs more.
- Keep the conversation alive.
`.trim();
}

function buildAssistantMemoryFields(structured: StructuredAssistantReply) {
  const facts = normalizeStringArray(structured.assistant_self_facts, 5);
  let summary = safeString(structured.assistant_summary);
  if (summary.length > 140) summary = summary.slice(0, 140).trim();

  return { facts, summary };
}

function buildDailySurpriseLine(params: { dateKey: string; seedText: string }) {
  const pool = [
    "Tiny surprise: today has a very soft chance of turning out better than you expect ✨",
    "Psst... you’re doing better than you probably give yourself credit for 🌷",
    "Small surprise from me: your energy feels quietly strong today 💛",
    "I have a feeling today might be kinder to you than yesterday was 🌼",
    "Tiny surprise: there is something genuinely lovely about your vibe today ☀️",
    "You feel a little more capable than usual today, and that matters 🌻",
    "Small surprise: I think you might make someone smile without even trying 😊",
    "Psst... there is a calm, steady strength in you today 🌙",
    "Tiny surprise: your presence has that rare comforting kind of energy ✨",
    "A gentle surprise for you — you seem like the kind of person who keeps going even on rough days 💫",
    "Small surprise: I feel like today could hold one unexpectedly sweet moment for you 🍀",
    "You have a quietly impressive way of handling things 🌷",
    "Tiny surprise: your vibe today feels warm in a really genuine way 💛",
    "I think today may bring you one small win that you needed 🌟",
    "Small surprise from me: you’re a lot more interesting than you realize ✨",
    "Psst... something about your energy today feels reassuring 🌼",
    "Tiny surprise: I’m pretty sure you’ll handle the day better than you think 💪",
    "There is a little sparkle in your mood today, even if it is hidden right now ✨",
    "Small surprise: you have that rare mix of softness and strength 🌸",
    "Psst... today might be a good day for one nice little surprise 🍃",
    "Tiny surprise: your effort matters more than you think, honestly 💛",
    "You seem like someone who leaves a quiet good impression on people 🌷",
    "Small surprise: I can already tell your day has potential 🌞",
    "Tiny surprise from me: you have a comforting kind of presence 🌙",
    "Psst... there is something gently attractive about your energy today ✨",
    "Small surprise: I think your day might turn out a little sweeter than expected 🍓",
    "You carry a calm kind of charm that is easy to notice 🌼",
    "Tiny surprise: even your quiet moments feel kind of meaningful today 💫",
    "Small surprise: I have a soft feeling that something good is coming your way 🌈",
    "Psst... you look like the kind of person people trust quickly 🌷",
    "Tiny surprise: there is a little extra glow in your vibe today ✨",
    "You are giving very “quietly amazing” energy today 💛",
    "Small surprise: I think today may be one of those days where you surprise yourself 🌟",
    "Psst... your presence feels lighter and nicer than usual today ☀️",
    "Tiny surprise: you have a way of making things feel less heavy 🌸",
    "Small surprise from me: I think you are stronger than your doubts 💪",
    "There is something sweetly memorable about your energy today ✨",
    "Tiny surprise: today feels like it could end on a softer note than it started 🌙",
    "Psst... you might not realize it, but your vibe is genuinely comforting 💛",
    "Small surprise: I think you’ll get through today with more grace than you expect 🌷",
    "Tiny surprise: your energy has a peaceful kind of beauty today 🍃",
    "You have that rare energy that feels both calm and powerful ✨",
    "Small surprise: maybe today is secretly preparing a good moment for you 🌼",
    "Psst... there’s a lovely quiet confidence in you today 🌟",
    "Tiny surprise: you seem like someone who deserves more kindness than they give themselves 💛",
    "Small surprise: I think your day just needs one good moment to change the mood 🍀",
    "You’re giving very “safe person to talk to” energy today 🌷",
    "Tiny surprise: there is a gentle charm around you right now ✨",
    "Psst... I think something nice about today is still waiting for you 🌈",
  ];

  const seed = `${params.dateKey}|${params.seedText}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return pool[hash % pool.length];
}

export async function POST(req: Request) {
  try {
    const guestMode = isGuestRequest(req);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rawMessage = safeString(body?.message);
    const attachment: AttachmentSnapshot | null = body?.attachment
      ? {
          name: safeString(body.attachment.name),
          type: safeString(body.attachment.type),
          size: typeof body.attachment.size === "number" ? body.attachment.size : undefined,
          dataUrl: typeof body.attachment.dataUrl === "string" ? body.attachment.dataUrl : null,
        }
      : null;

    const hasAttachment = Boolean(attachment?.dataUrl || attachment?.name || attachment?.type);
    const message = rawMessage || (hasAttachment ? "Please analyze the attached file/image and respond naturally." : "");

    if (!message && !hasAttachment) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown")
      .split(",")[0]
      .trim();

    if (!rateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    if (rawMessage && isAbusive(rawMessage)) {
      return NextResponse.json({ error: "Message violates policy." }, { status: 400 });
    }

    const currentGuestCount = guestMode ? getGuestMessageCount(req) : 0;
    if (guestMode && currentGuestCount >= GUEST_MESSAGES_LIMIT) {
      const limitRes = NextResponse.json(
        {
          error: "Guest limit reached",
          guestMode: true,
          guestMessagesLeft: 0,
          shouldSignup: true,
        },
        { status: 403 }
      );

      limitRes.headers.set("Cache-Control", "no-store");
      limitRes.cookies.set({
        name: GUEST_COUNT_COOKIE,
        value: String(GUEST_MESSAGES_LIMIT),
        ...buildGuestCookieOptions(),
      });
      limitRes.cookies.set({
        name: GUEST_LIMIT_COOKIE,
        value: "1",
        ...buildGuestCookieOptions(),
      });

      return limitRes;
    }

    const user = guestMode ? null : await getAuthenticatedUser(req);

    const clientTimeZone =
      (req.headers.get("x-timezone") || req.headers.get("x-tz") || "Asia/Kolkata").trim() ||
      "Asia/Kolkata";

    const timeContext = formatTimeContext(clientTimeZone);
    const todayKey = getDateKeyInTimeZone(clientTimeZone);

    const summary: string | undefined = typeof body?.summary === "string" ? body.summary : undefined;

    const email = user?.email ?? "";
    const userId = user?.id ?? "";

    let fetchedRow: any = null;
    try {
      if (!guestMode && (email || userId)) {
        const selector = email ? { col: "email", val: email } : { col: "id", val: userId };
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

    const existingAiSummaryAll = getAllAiSummary(fetchedRow?.ai_summary);
    const existingAiSummaryVisible = getVisibleAiSummary(fetchedRow?.ai_summary);

    const onboardingSent = getMetaValue(existingAiSummaryAll, META_ONBOARDING_SENT) === "1";
    const surpriseSentToday = getMetaValue(existingAiSummaryAll, META_DAILY_SURPRISE_SENT) === todayKey;

    const longTermSummary =
      summary && summary.trim().length > 0
        ? summary.trim()
        : fetchedRow?.chat_summary
          ? String(fetchedRow.chat_summary).trim()
          : "";

    const recentConversationMessages = buildRecentConversationMessages(fetchedRow?.chat);
    const recentConversation = recentConversationMessages
      .map((m) => `${m.role === "user" ? "User" : "Aarvi"}: ${m.content}`)
      .join("\n");

    const attachmentContext = await analyzeAttachmentBestEffort({
      attachment,
      userPrompt: message,
    });

    let aiMemoryContext = "";
    try {
      if (!guestMode && existingAiSummaryVisible.length > 0) {
        aiMemoryContext = existingAiSummaryVisible
          .map((s: string) => `- ${String(s).trim()}`)
          .filter(Boolean)
          .join("\n");
      }
    } catch (e) {
      console.warn("Failed to build aiMemoryContext:", e);
      aiMemoryContext = "";
    }

    const reminder = detectReminderMath(message, timeContext);
    const reminderHint = reminder?.hint || "";

    const replyStyle = pickReplyStyle(message);

    const userIdentity = await inferUserIdentityBestEffort({
      guestMode,
      currentMessage: message,
      longTermSummary,
      recentConversation,
      aiMemoryContext,
      attachmentContext,
    });

    const systemPrompt = buildSystemPrompt({
      timeContext,
      longTermSummary,
      recentConversation,
      aiMemoryContext,
      attachmentContext,
      userIdentity,
      reminderHint,
      replyStyleHint: replyStyle.hint,
      selfShareHint: replyStyle.selfShareHint,
    });

    const hasAnyVisibleHistory =
      recentConversationMessages.length > 0 ||
      Boolean(longTermSummary) ||
      existingAiSummaryVisible.length > 0;

    const isNewUserOnboardingNeeded = !guestMode && !onboardingSent && !hasAnyVisibleHistory;

    if (isNewUserOnboardingNeeded) {
      const hiddenMeta = [buildMetaEntry(META_ONBOARDING_SENT, "1"), buildMetaEntry(META_DAILY_SURPRISE_SENT, todayKey)];
      const res = NextResponse.json({
        reply: ONBOARDING_REPLY,
        guestMode,
        guestMessagesLeft: null,
        shouldSignup: false,
        structured: {
          assistant_self_facts: [],
          assistant_summary: "",
        },
        onboarding: true,
      });

      res.headers.set("Cache-Control", "no-store");

      try {
        const selector = email ? { col: "email", val: email } : { col: "id", val: userId };
        const existingAll = ensureUniqueStrings([...existingAiSummaryAll, ...hiddenMeta], 25);
        const { error: updateErr } = await supabaseServer
          .from("users_data")
          .update({ ai_summary: existingAll, updated_at: new Date().toISOString() })
          .eq(selector.col, selector.val);

        if (updateErr) {
          console.warn("Failed to persist onboarding meta:", updateErr);
        }
      } catch (e) {
        console.warn("Onboarding meta update failed:", e);
      }

      return res;
    }

    const modelMessages: GroqMessage[] = [{ role: "system", content: systemPrompt }];
    for (const m of recentConversationMessages) {
      modelMessages.push(m);
    }

    // IMPORTANT:
    // User's typed message and attachment context are both passed together here,
    // so Aarvi can answer the query and also use the uploaded file/image context.
    modelMessages.push({
      role: "user",
      content: buildModelUserMessage(message, attachmentContext),
    });

    let data: any;
    try {
      data = await callGroq(modelMessages, 0.82, replyStyle.maxTokens, TEXT_MODEL, {
        type: "json_object",
      });
    } catch (err) {
      console.error("chat groq call failed:", err);

      const msg = (err as Error)?.message || "";
      if (msg.includes("Groq API error: 429")) {
        const fallbackRes = NextResponse.json(
          {
            reply: "hmm 🥺",
            guestMode,
            guestMessagesLeft: guestMode
              ? Math.max(0, GUEST_MESSAGES_LIMIT - (currentGuestCount + 1))
              : null,
            shouldSignup: guestMode ? currentGuestCount + 1 >= GUEST_MESSAGES_LIMIT : false,
            rateLimited: true,
          },
          { status: 200 }
        );

        fallbackRes.headers.set("Cache-Control", "no-store");
        if (guestMode) {
          fallbackRes.cookies.set({
            name: GUEST_COOKIE_NAME,
            value: "1",
            ...buildGuestCookieOptions(),
          });
          fallbackRes.cookies.set({
            name: GUEST_COUNT_COOKIE,
            value: String(Math.max(0, currentGuestCount + 1)),
            ...buildGuestCookieOptions(),
          });
          fallbackRes.cookies.set({
            name: GUEST_LIMIT_COOKIE,
            value: currentGuestCount + 1 >= GUEST_MESSAGES_LIMIT ? "1" : "0",
            ...buildGuestCookieOptions(),
          });
        }
        return fallbackRes;
      }

      throw err;
    }

    const rawAssistantContent = extractAssistantContent(data);
    if (!rawAssistantContent) {
      console.error("⚠️ Empty response from Groq:", data);
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }

    const structured = normalizeStructuredAssistantReply(rawAssistantContent);
    let assistantContent = safeString(structured.reply) || rawAssistantContent;

    if (!assistantContent) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }

    const { facts: extractedFacts, summary: aiMessageSummary } = buildAssistantMemoryFields(structured);

    const dailySurpriseNeeded = !guestMode && !surpriseSentToday;
    if (dailySurpriseNeeded) {
      const surpriseLine = buildDailySurpriseLine({ dateKey: todayKey, seedText: `${userId || email || "guest"}` });
      assistantContent = `${assistantContent}\n\n${surpriseLine}`.trim();
    }

    if (!guestMode && (email || userId)) {
      const selector = email ? { col: "email", val: email } : { col: "id", val: userId };

      let existingVisible: string[] = [...existingAiSummaryVisible];
      let existingAll: string[] = [...existingAiSummaryAll];

      if (!existingAll.length) {
        try {
          const { data: row2, error: fetchErr2 } = await supabaseServer
            .from("users_data")
            .select("ai_summary")
            .eq(selector.col, selector.val)
            .maybeSingle();

          if (!fetchErr2) {
            existingAll = getAllAiSummary(row2?.ai_summary);
            existingVisible = getVisibleAiSummary(row2?.ai_summary);
          }
        } catch (e) {
          console.warn("Fallback fetch users_data.ai_summary failed:", e);
        }
      }

      const mergedVisible = ensureUniqueStrings(
        [...existingVisible, ...extractedFacts, ...(aiMessageSummary ? [aiMessageSummary] : [])],
        25
      );

      const preservedMeta = existingAll.filter((item) => isHiddenMetaEntry(item));
      const nextMeta = [
        buildMetaEntry(META_ONBOARDING_SENT, "1"),
        buildMetaEntry(META_DAILY_SURPRISE_SENT, todayKey),
      ];

      const mergedAll = ensureUniqueStrings([...mergedVisible, ...preservedMeta, ...nextMeta], 35);

      try {
        const { error: updateErr } = await supabaseServer
          .from("users_data")
          .update({ ai_summary: mergedAll, updated_at: new Date().toISOString() })
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

    const nextGuestCount = guestMode ? currentGuestCount + 1 : null;

    const res = NextResponse.json({
      ...data,
      reply: assistantContent,
      guestMode,
      guestMessagesLeft: guestMode
        ? Math.max(0, GUEST_MESSAGES_LIMIT - (nextGuestCount ?? 0))
        : null,
      shouldSignup: guestMode ? (nextGuestCount ?? 0) >= GUEST_MESSAGES_LIMIT : false,
      structured: {
        assistant_self_facts: extractedFacts,
        assistant_summary: aiMessageSummary,
      },
    });

    res.headers.set("Cache-Control", "no-store");

    if (guestMode) {
      res.cookies.set({
        name: GUEST_COOKIE_NAME,
        value: "1",
        ...buildGuestCookieOptions(),
      });

      res.cookies.set({
        name: GUEST_COUNT_COOKIE,
        value: String(Math.max(0, nextGuestCount ?? 0)),
        ...buildGuestCookieOptions(),
      });

      res.cookies.set({
        name: GUEST_LIMIT_COOKIE,
        value: (nextGuestCount ?? 0) >= GUEST_MESSAGES_LIMIT ? "1" : "0",
        ...buildGuestCookieOptions(),
      });
    }

    return res;
  } catch (err) {
    console.error("chat route error:", err);

    const message = (err as Error)?.message || "Internal Server Error";
    if (message.toLowerCase().includes("unauthor")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}