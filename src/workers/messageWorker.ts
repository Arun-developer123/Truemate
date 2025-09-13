// src/workers/messageWorker.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ScheduledMessage = {
  id: string;
  user_id: string;
  next_message_text: string;
  next_message_time: string;
  status: string;
  priority: number;
};

export async function runMessageWorker() {
  console.log("🔍 Local worker triggered...");

  try {
    const now = new Date().toISOString();

    // 1️⃣ Fetch due messages
    const { data: dueMessages, error } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("next_message_time", now)
      .order("priority", { ascending: true })
      .limit(50);

    if (error) {
      console.error("❌ Error fetching due messages:", error);
      return;
    }

    if (!dueMessages || dueMessages.length === 0) {
      console.log("✅ No due messages");
      return;
    }

    console.log(`📬 Found ${dueMessages.length} due messages`);

    for (const msg of dueMessages as ScheduledMessage[]) {
      try {
        console.log(`🚀 Sending proactive message to user ${msg.user_id}`);

        const { data: userData, error: fetchError } = await supabase
          .from("users_data")
          .select("chat")
          .eq("id", msg.user_id)
          .maybeSingle();

        if (fetchError || !userData) {
          console.warn(`⚠️ User ${msg.user_id} not found`, fetchError);
          continue;
        }

        const currentChat = Array.isArray(userData.chat) ? userData.chat : [];
        const newMessage = {
          role: "assistant",
          content: msg.next_message_text,
          proactive: true,
          created_at: new Date().toISOString(),
        };
        const updatedChat = [...currentChat, newMessage];

        const { error: updateError } = await supabase
          .from("users_data")
          .update({
            chat: updatedChat,
            updated_at: new Date().toISOString(),
          })
          .eq("id", msg.user_id);

        if (updateError) {
          console.warn(
            `⚠️ Failed to update chat for user ${msg.user_id}`,
            updateError
          );
        }

        const { error: markError } = await supabase
          .from("scheduled_messages")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", msg.id);

        if (markError) {
          console.warn(`⚠️ Failed to mark message ${msg.id} as sent`, markError);
        }

        console.log(`✅ Message sent: ${msg.next_message_text}`);
      } catch (err) {
        console.error(`❌ Unexpected error for message ${msg.id}`, err);
      }
    }
  } catch (err) {
    console.error("⚠️ Local worker unexpected error", err);
  }
}

// Run locally if executed directly
if (require.main === module) {
  runMessageWorker().then(() => {
    console.log("🏁 Local worker finished.");
    process.exit(0);
  });
}
