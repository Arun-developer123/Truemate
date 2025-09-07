"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Role = "user" | "assistant";
type Message = {
  role: Role;
  content: string;
  proactive?: boolean;
  created_at?: string;
};

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi 👋 I'm Truemate, your AI companion!" },
  ]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [popup, setPopup] = useState<any>(null);
  const [fullscreenGame, setFullscreenGame] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  // 🔹 Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/signin");
        return;
      }
      setUserId(data.user.id ?? null);
      setUserEmail(data.user.email ?? null);
    };
    getUser();
  }, [router]);

  // 🔹 Setup realtime listener for proactive messages
  useEffect(() => {
    if (!userEmail) return;

    const channel = supabase
      .channel("chat-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users_data" },
        (payload) => {
          const newChat: Message[] = payload.new.chat || [];
          setMessages(newChat);

          // ✅ Agar latest message assistant ka proactive hai → unread badge + notification
          const latest = newChat[newChat.length - 1];
          if (latest?.role === "assistant" && latest?.proactive) {
            setUnreadCount((c) => c + 1);

            if (Notification.permission === "granted") {
              new Notification("Truemate", {
                body: latest.content,
                icon: "/icon.png", // public folder me ek icon.png daal dena
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userEmail]);

  // 🔹 Ask push notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // 🔹 Handle sending message
  const handleSend = async () => {
    if (!input.trim() || !userEmail) return;

    try {
      const newMessages: Message[] = [...messages, { role: "user", content: input }];
      setMessages(newMessages);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "⚠️ Empty response";

      const updatedMessages: Message[] = [
        ...newMessages,
        { role: "assistant", content: reply },
      ];
      setMessages(updatedMessages);

      setInput("");

      // 🔹 Save chat to DB
      const { data: existingData } = await supabase
        .from("users_data")
        .select("chat")
        .eq("email", userEmail)
        .maybeSingle();

      const oldChat: Message[] = Array.isArray(existingData?.chat)
        ? existingData.chat
        : [];

      const newChat: Message[] = [
        ...oldChat,
        { role: "user", content: input },
        { role: "assistant", content: reply },
      ];

      await supabase
        .from("users_data")
        .update({
          chat: newChat,
          updated_at: new Date().toISOString(),
        })
        .eq("email", userEmail);
    } catch (err) {
      console.error("handleSend failed:", err);
    }
  };

  // 🔹 On tab close → summarize and clear chat
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!userEmail) return;
      const payload = JSON.stringify({ email: userEmail });
      navigator.sendBeacon("/api/flush-chat", payload);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [userEmail]);

  // 🔹 Reset unread count when chat window active
  useEffect(() => {
    const handleFocus = () => setUnreadCount(0);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // 🔹 Footer Buttons functionality
  const handleFooterClick = async (type: string) => {
    if (!userEmail) return;

    switch (type) {
      case "games":
        setPopup(
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-2">🎮 Multiplayer Games</h2>
            <div className="grid gap-3">
              <button
                className="bg-purple-600 text-white py-2 rounded"
                onClick={() =>
                  setFullscreenGame("https://www.crazygames.com/embed/crazy-car-stunts")
                }
              >
                🚗 Crazy Car Stunt Multiplayer
              </button>

              <button
                className="bg-purple-600 text-white py-2 rounded"
                onClick={() =>
                  setFullscreenGame("https://zv1y2i8p.play.gamezop.com/g/SkhljT2fdgb")
                }
              >
                🎲 Ludo Multiplayer
              </button>

              <button
                className="bg-purple-600 text-white py-2 rounded"
                onClick={() =>
                  setFullscreenGame("https://www.onlinegames.io/fragen/")
                }
              >
                🥊 Fighting Arena
              </button>

              <button
                className="bg-purple-600 text-white py-2 rounded"
                onClick={() =>
                  setFullscreenGame("https://www.onlinegames.io/geometry-arrow/")
                }
              >
                ♟️ Geometry-Arrow
              </button>
            </div>
          </div>
        );
        break;

      case "challenges":
        setPopup("📆 Today's Challenge: Write 3 things you're grateful for 🙏");
        break;

      case "achievements": {
        const { data, error } = await supabase
          .from("users_data")
          .select("achievements")
          .eq("email", userEmail)
          .maybeSingle();
        if (error) {
          console.error("Supabase achievements fetch error:", error.message);
        }
        setPopup("🏆 Achievements: " + JSON.stringify(data?.achievements || []));
        break;
      }

      case "easter":
        setPopup("🥚 You found a secret Easter Egg! 🐰✨");
        break;
    }
  };

  // 🔹 Sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  // 🔹 Fullscreen Game View
  if (fullscreenGame) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="p-2 bg-purple-600 text-white flex justify-between items-center">
          <span className="font-bold">🎮 Playing Game</span>
          <button
            onClick={() => setFullscreenGame(null)}
            className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
          >
            ⬅ Back to Chat
          </button>
        </div>
        <iframe
          src={fullscreenGame}
          className="w-full flex-1"
          allow="gamepad *"
        ></iframe>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-purple-600 text-white shadow relative">
        <h1 className="text-xl font-bold flex items-center">
          Truemate Chat
          {unreadCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </h1>
        <button
          onClick={handleSignOut}
          className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
        >
          Sign Out
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 bg-gray-100">
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl max-w-xs ${
                msg.role === "user"
                  ? "bg-blue-500 text-white ml-auto"
                  : "bg-white text-gray-800"
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
      </main>

      {/* Input Box */}
      <div className="p-4 bg-white border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border rounded-xl px-3 py-2 focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700"
        >
          Send
        </button>
      </div>

      {/* Footer Icons */}
      <footer className="flex justify-around items-center p-3 bg-gray-200 border-t">
        <button
          onClick={() => handleFooterClick("games")}
          className="flex flex-col items-center text-sm text-gray-700 hover:text-purple-600"
        >
          🎮 Games
        </button>
        <button
          onClick={() => handleFooterClick("challenges")}
          className="flex flex-col items-center text-sm text-gray-700 hover:text-purple-600"
        >
          📆 Challenges
        </button>
        <button
          onClick={() => handleFooterClick("achievements")}
          className="flex flex-col items-center text-sm text-gray-700 hover:text-purple-600"
        >
          🏆 Achievements
        </button>
        <button
          onClick={() => handleFooterClick("easter")}
          className="flex flex-col items-center text-sm text-gray-700 hover:text-purple-600"
        >
          🥚 Easter Eggs
        </button>
      </footer>

      {/* Popup Modal */}
      {popup && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          onClick={() => setPopup(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-lg w-[95vw] max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 overflow-y-auto flex-1">{popup}</div>
            <div className="p-3 border-t text-right">
              <button
                onClick={() => setPopup(null)}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
