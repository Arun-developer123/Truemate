// src/workers/messageWorker.ts

import { fetchDueMessages, markMessageSent } from "@/lib/db/scheduledMessages";
import { sendMessageToUser } from "@/lib/messaging/sendMessage";

// Background loop (poll every 60 sec)
export async function runMessageWorker() {
  console.log("📢 Worker started...");

  setInterval(async () => {
    try {
      console.log("🔍 Checking for due messages...");

      // 1. Fetch messages that are ready to be sent
      const dueMessages = await fetchDueMessages(50);

      if (dueMessages.length === 0) {
        console.log("✅ No due messages right now");
        return;
      }

      // 2. Process each message
      for (const msg of dueMessages) {
        console.log(`🚀 Sending message to user ${msg.user_id}`);

        try {
          // Send proactive message
          await sendMessageToUser(msg.user_id, msg.next_message_text);

          // Mark as sent
          await markMessageSent(msg.id);

          console.log(`✅ Sent: ${msg.next_message_text}`);
        } catch (err) {
          console.error(`❌ Failed to send message ${msg.id}`, err);
        }
      }
    } catch (err) {
      console.error("⚠️ Worker error:", err);
    }
  }, 60_000); // run every 60 seconds
}
