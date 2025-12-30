// C:\Users\aruna\truemate\src\app\home\page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { registerServiceWorkerAndSubscribe } from "@/lib/pushClient";


type Role = "user" | "assistant" | "system";
type Message = {
  role: Role;
  content: string;
  proactive?: boolean;
  created_at?: string;
  seen?: boolean; // 🔹 added
};

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [input, setInput] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [popup, setPopup] = useState<React.ReactNode>(null);
  const [fullscreenGame, setFullscreenGame] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sending, setSending] = useState(false); // 🔹 added
  const router = useRouter();

  // keep ref in sync to avoid stale closures inside realtime/polling handlers
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // utility: dedupe messages by role|content|created_at
  const dedupeMessages = (arr: Message[]) => {
    const seen = new Set<string>();
    return arr.filter((m) => {
      const key = `${m.role}|${m.content}|${m.created_at || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // 🔹 Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/signin");
        return;
      }
      const email = data.user.email ?? null;
      setUserEmail(email);

      // 🔹 Load existing chat from DB
      if (email) {
        const { data: existingData, error: fetchError } = await supabase
          .from("users_data")
          .select("chat")
          .eq("email", email)
          .maybeSingle();

        if (fetchError) {
          console.error("Supabase fetch chat error:", fetchError.message);
        } else if (existingData?.chat) {
          const clean = dedupeMessages(existingData.chat);
          setMessages(clean);
        }
      }
    };
    getUser();
  }, [router]);

  // 🔹 Realtime listener (proactive/reminders)
useEffect(() => {
  if (!userEmail) return;

  type RealtimePayload = {
    new?: {
      chat?: Message[];
    };
  };

  const handleRealtime = (payload: RealtimePayload) => {
    const incoming: Message[] = payload.new?.chat ?? [];
    const clean = dedupeMessages(incoming);

    // if identical to current messages, skip
    if (JSON.stringify(clean) === JSON.stringify(messagesRef.current)) return;

    setMessages(clean);

    // Unread + notification for proactive/reminders
    const latest = clean[clean.length - 1];
    if (latest?.role === "assistant" && latest?.proactive && !latest?.seen) {
      setUnreadCount((c) => c + 1);
      if (Notification.permission === "granted") {
        new Notification("Truemate", { body: latest.content, icon: "/icon.png" });
      }
    }
  };

  const channel = supabase
    .channel("chat-changes")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "users_data", filter: `email=eq.${userEmail}` },
      handleRealtime
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "users_data", filter: `email=eq.${userEmail}` },
      handleRealtime
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userEmail]);


  // 🔹 Polling fallback (2–3 sec) if realtime fails
  useEffect(() => {
    if (!userEmail) return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from("users_data")
        .select("chat")
        .eq("email", userEmail)
        .maybeSingle();

      if (error) {
        console.error("Polling fetch error:", error.message);
      } else if (data?.chat) {
        const clean = dedupeMessages(data.chat);
        if (JSON.stringify(clean) !== JSON.stringify(messagesRef.current)) {
          setMessages(clean);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [userEmail]);

  // 🔹 Ask push notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // 🔹 Auto-register service worker & subscribe (when user allowed notifications)
useEffect(() => {
  if (!userEmail) return;
  // only attempt if browser supports and permission already granted
  if (typeof window !== "undefined" && "serviceWorker" in navigator && Notification.permission === "granted") {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — push subscribe skipped");
      return;
    }

    // register & subscribe (idempotent)
    registerServiceWorkerAndSubscribe(vapid, userEmail)
      .then((sub) => {
        if (sub) console.log("Push subscribed (client).");
      })
      .catch((err) => console.warn("Push subscription failed:", err));
  }
}, [userEmail]);


  // 🔹 Mark proactive messages as seen when chat updates
  useEffect(() => {
    if (!userEmail) return;

    const markSeen = async () => {
      if (messages.some((m) => m.proactive && !m.seen)) {
        const updated = messages.map((m) => (m.proactive ? { ...m, seen: true } : m));
        setMessages(updated);

        await supabase
          .from("users_data")
          .update({ chat: updated, updated_at: new Date().toISOString() })
          .eq("email", userEmail);
      }
    };

    markSeen();
  }, [messages, userEmail]);

  // 🔹 Handle sending message (optimized + single DB write)
  const handleSend = async () => {
    if (!input.trim() || !userEmail || sending) return;
    setSending(true);

    const userMsg: Message = { role: "user", content: input };

    try {
      // 1) Optimistic update (fast UI)
      const optimistic = [...messagesRef.current, userMsg];
      setMessages(optimistic);
      setInput("");

      // 2) Call chat API
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "⚠️ Empty response";
      const assistantMsg: Message = { role: "assistant", content: reply };

      // 3) Final local state (user + assistant)
      const updatedMessages: Message[] = [...optimistic, assistantMsg];
      setMessages(updatedMessages);

      // 4) Save the SAME updatedMessages to DB (important!)
      await supabase
        .from("users_data")
        .update({
          chat: updatedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("email", userEmail);

      // 5) Analyze message for proactive/reminders
      await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, message: input }),
      });
    } catch (err) {
      console.error("handleSend failed:", err);
      // Optionally: rollback optimistic update or show error UI
    } finally {
      setSending(false);
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


  // 🔹 Sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  
  return (
    <div className="flex flex-col h-screen relative">
      {/* Background image (put aarvi.jpg in public/) */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/aarvi.jpg')" }} />

      {/* overlay for readability */}
      <div className="absolute inset-0 bg-black/30" />

      {/* content above background */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="flex justify-between items-center p-4 bg-purple-600/95 text-white shadow">
          <h1 className="text-xl font-bold flex items-center">
            Truemate Chat
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">{unreadCount}</span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={handleSignOut} className="bg-red-500 px-3 py-1 rounded hover:bg-red-600">
              Sign Out
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`p-3 rounded-xl max-w-[70%] shadow-lg break-words ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : msg.proactive
                      ? "bg-yellow-100 text-gray-900 border border-yellow-400"
                      : "bg-white/90 text-gray-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Input Box */}
        <div className="p-4 bg-white/90 border-t">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border rounded-xl px-3 py-2 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending}
              className={`bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 ${
                sending ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>

        
      </div>

      
    </div>
  );
}
