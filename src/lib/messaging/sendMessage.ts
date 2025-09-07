// src/lib/messaging/sendMessage.ts
import { supabase } from "@/lib/supabaseClient";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  proactive?: boolean; // 👈 identify proactive messages
  created_at: string;
};

export async function sendMessageToUser(
  userId: string,
  text: string
): Promise<void> {
  // 1. Fetch existing chat JSON
  const { data: user, error: fetchError } = await supabase
    .from("users_data")
    .select("chat")
    .eq("id", userId)
    .single();

  if (fetchError) throw fetchError;

  const currentChat: ChatMessage[] = user?.chat || [];

  // 2. Add new proactive message
  const newMessage: ChatMessage = {
    role: "assistant",
    content: text,
    proactive: true,
    created_at: new Date().toISOString(),
  };

  const updatedChat = [...currentChat, newMessage];

  // 3. Update in DB
  const { error: updateError } = await supabase
    .from("users_data")
    .update({ chat: updatedChat, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (updateError) throw updateError;
}
