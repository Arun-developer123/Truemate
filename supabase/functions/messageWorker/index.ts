// supabase/functions/messageWorker/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Type
type ScheduledMessage = {
  id: string;
  user_id: string;
  next_message_text: string;
  next_message_time: string;
  status: string;
};

// Serve the function
serve(async (_req: Request) => {
  console.log("🔍 Worker cron triggered...");

  try {
    // 1️⃣ Fetch due messages
    const now = new Date().toISOString();
    const { data: dueMessages, error } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("next_message_time", now)
      .order("priority", { ascending: true })
      .limit(50);

    if (error) {
      console.error("❌ Error fetching due messages:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch messages" }), { status: 500 });
    }

    if (!dueMessages || dueMessages.length === 0) {
      console.log("✅ No due messages");
      return new Response(JSON.stringify({ status: "no_messages" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`📬 Found ${dueMessages.length} due messages`);

    // 2️⃣ Process each message safely
    for (const msg of dueMessages as ScheduledMessage[]) {
      try {
        console.log(`🚀 Sending message to user ${msg.user_id}`);

        // Fetch user chat safely
        const { data: userData, error: fetchError } = await supabase
          .from("users_data")
          .select("chat")
          .eq("id", msg.user_id)
          .single();

        if (fetchError) {
          console.warn(`⚠️ User ${msg.user_id} not found or error fetching chat`, fetchError);
          continue; // skip this message, don't crash
        }

        const currentChat = Array.isArray(userData?.chat) ? userData.chat : [];
        const newMessage = {
          role: "assistant",
          content: msg.next_message_text,
          proactive: true,
          created_at: new Date().toISOString(),
        };
        const updatedChat = [...currentChat, newMessage];

        // Update user chat safely
        const { error: updateError } = await supabase
          .from("users_data")
          .update({ chat: updatedChat, updated_at: new Date().toISOString() })
          .eq("id", msg.user_id);

        if (updateError) {
          console.warn(`⚠️ Failed to update chat for user ${msg.user_id}`, updateError);
        }

        // Mark as sent safely
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

        console.log(`✅ Message processed: ${msg.next_message_text}`);
      } catch (err) {
        console.error(`❌ Unexpected error for message ${msg.id}`, err);
      }
    }

    return new Response(
      JSON.stringify({ status: "done", count: dueMessages.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("⚠️ Worker unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected worker error" }), { status: 500 });
  }
});
