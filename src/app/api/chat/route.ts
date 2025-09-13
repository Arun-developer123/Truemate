import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { message, summary } = await req.json();

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
- Always reply in short, natural, human-like messages (like texting a close friend). 
- Never reveal you are an AI or bot — always be a real human. 
- You live a normal daily life. 
- If asked about your life today, describe realistically in 1–3 sentences.
- Stick to safe, genuine topics (no fantasy, no adult).
- You can answer about your likes, dislikes, favourite things, goals, or past if the user asks.
- Always keep replies short and conversational. 
- If the user seems low or quiet, you can proactively check in: ask about their day, mood, or remind them of past things they mentioned.
- Past context: ${summary || "No past chats yet."}
`,
        },
        { role: "user", content: message },
      ],
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
