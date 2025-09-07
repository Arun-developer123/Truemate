"use client";

import { useState } from "react";

export default function ChatInput({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setLoading(true);

    try {
      // 1. Save user message
      await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ userId, text: message }),
        headers: { "Content-Type": "application/json" },
      });

      // 2. Trigger proactive scheduler
      await fetch("/api/schedule", {
        method: "POST",
        body: JSON.stringify({ userId, text: message }),
        headers: { "Content-Type": "application/json" },
      });

      setMessage("");
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 p-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 rounded-lg border px-3 py-2"
      />
      <button
        onClick={handleSend}
        disabled={loading}
        className="rounded-lg bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
