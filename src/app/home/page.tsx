// C:\Users\aruna\truemate\src\app\home\page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { registerServiceWorkerAndSubscribe } from "@/lib/pushClient";

// NOTE: If you want to persist background choices in DB, add this column to your users_data table:
// ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS background_image text;

// --- Types ---
type Role = "user" | "assistant" | "system";
type Message = {
  role: Role;
  content: string;
  proactive?: boolean;
  created_at?: string;
  seen?: boolean;
};

type BackgroundItem = {
  name: string;
  isUnlocked: boolean;
  thumbUrl: string;
  signedUrl?: string | null;
};

// --- Component ---
export default function HomePage(): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [input, setInput] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  // default to primary image — this ensures an image is always visible
  const [selectedBackground, setSelectedBackground] = useState<string>("/aarvi.jpg");
  const router = useRouter();

  // Gallery images (put these in /public) - kept for fallback if needed
  const backgroundOptions = ["aarvi.jpg", "aarvi-1.jpg", "aarvi-2.jpg", "aarvi-3.jpg"];

  // New: backgrounds loaded from server
  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const dedupeMessages = (arr: Message[]) => {
    const seen = new Set<string>();
    return arr.filter((m) => {
      const key = `${m.role}|${m.content}|${m.created_at || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // --- Get current user + load chat and background preference ---
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/signin");
        return;
      }
      const email = data.user.email ?? null;
      setUserEmail(email);

      if (email) {
        // First try to fetch chat + background_image (if column exists)
        let existingData: any = null;
        try {
          const res = await supabase.from("users_data").select("chat, background_image").eq("email", email).maybeSingle();
          if (res.error) throw res.error;
          existingData = res.data;
        } catch (e: any) {
          // If the column doesn't exist (common when upgrading), fall back to fetching chat only
          const msg = String(e?.message || e);
          if (/background_image/.test(msg) || /column .* does not exist/.test(msg)) {
            try {
              const res2 = await supabase.from("users_data").select("chat").eq("email", email).maybeSingle();
              if (!res2.error) existingData = res2.data;
            } catch (e2) {
              console.error("Supabase fetch chat fallback failed:", e2);
            }
          } else {
            console.error("Supabase fetch chat error:", msg);
          }
        }

        if (existingData) {
          if (existingData.chat) {
            const clean = dedupeMessages(existingData.chat);
            setMessages(clean);
          }
          if (existingData.background_image) {
            setSelectedBackground(`/${existingData.background_image}`);
          }
        }
      }
    };
    getUser();
  }, [router]);

  // --- Load gallery items from server ---
  useEffect(() => {
  if (!userEmail) return;
  const load = async () => {
    try {
      const res = await fetch(`/api/backgrounds/list?email=${encodeURIComponent(userEmail)}`);
      const json = await res.json();
      if (json?.ok && Array.isArray(json.items)) {
        // Fix any broken thumbUrl that was accidentally created using undefined env var
        const fixed = json.items.map((it: any) => {
          const name = it.name;
          let thumbUrl = it.thumbUrl || `/api/backgrounds/thumb?file=${encodeURIComponent(name)}`;
          // defensive: if thumbUrl contains "undefined/" or doesn't start with http/"/", fallback to relative path
          if (typeof thumbUrl === "string" && (thumbUrl.includes("undefined/") || !/^\/|https?:\/\//.test(thumbUrl))) {
            thumbUrl = `/api/backgrounds/thumb?file=${encodeURIComponent(name)}`;
          }
          return { ...it, thumbUrl };
        });
        setBackgrounds(fixed);
      } else {
        console.warn("backgrounds list returned no items:", json);
      }
    } catch (e) {
      console.warn("Failed to load backgrounds", e);
    }
  };
  load();
}, [userEmail]);


  // --- Realtime listener for chat updates ---
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
      if (JSON.stringify(clean) === JSON.stringify(messagesRef.current)) return;
      setMessages(clean);

      const latest = clean[clean.length - 1];
      if (latest?.role === "assistant" && latest?.proactive && !latest?.seen) {
        setUnreadCount((c) => c + 1);
        if (typeof window !== "undefined" && Notification.permission === "granted") {
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

  // --- Polling fallback ---
  useEffect(() => {
    if (!userEmail) return;
    const interval = setInterval(async () => {
      const { data, error } = await supabase.from("users_data").select("chat").eq("email", userEmail).maybeSingle();

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

  // --- Notification permission ---
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // --- Register service worker ---
  useEffect(() => {
    if (!userEmail) return;
    if (typeof window !== "undefined" && "serviceWorker" in navigator && Notification.permission === "granted") {
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — push subscribe skipped");
        return;
      }
      registerServiceWorkerAndSubscribe(vapid, userEmail)
        .then((sub) => {
          if (sub) console.log("Push subscribed (client).");
        })
        .catch((err) => console.warn("Push subscription failed:", err));
    }
  }, [userEmail]);

  // --- Mark proactive as seen ---
  useEffect(() => {
    if (!userEmail) return;
    const markSeen = async () => {
      if (messages.some((m) => m.proactive && !m.seen)) {
        const updated = messages.map((m) => (m.proactive ? { ...m, seen: true } : m));
        setMessages(updated);
        await supabase.from("users_data").update({ chat: updated, updated_at: new Date().toISOString() }).eq("email", userEmail);
      }
    };
    markSeen();
  }, [messages, userEmail]);

  // --- Save background preference to DB ---
  const saveBackgroundPreference = async (imageFilename: string) => {
    if (!userEmail) return;
    try {
      const res = await supabase.from("users_data").update({ background_image: imageFilename, updated_at: new Date().toISOString() }).eq("email", userEmail);
      if (res.error) {
        // if column missing, silently ignore (we already handle fallback on read)
        const msg = String(res.error.message || res.error);
        if (/background_image/.test(msg) || /column .* does not exist/.test(msg)) {
          console.warn("Background preference column missing on DB; skip saving preference.");
        } else {
          console.warn("Failed to save background preference:", msg);
        }
      }
    } catch (e) {
      console.warn("Failed to save background preference", e);
    }
  };

  // --- Handle send ---
  const handleSend = async () => {
    if (!input.trim() || !userEmail || sending) return;
    setSending(true);
    const userMsg: Message = { role: "user", content: input };

    try {
      const optimistic = [...messagesRef.current, userMsg];
      setMessages(optimistic);
      setInput("");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "⚠️ Empty response";
      const assistantMsg: Message = { role: "assistant", content: reply };

      const updatedMessages: Message[] = [...optimistic, assistantMsg];
      setMessages(updatedMessages);

      await supabase.from("users_data").update({ chat: updatedMessages, updated_at: new Date().toISOString() }).eq("email", userEmail);

      await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, message: input }),
      });
    } catch (err) {
      console.error("handleSend failed:", err);
    } finally {
      setSending(false);
    }
  };

  // --- Before unload: flush chat ---
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!userEmail) return;
      const payload = JSON.stringify({ email: userEmail });
      navigator.sendBeacon("/api/flush-chat", payload);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [userEmail]);

  useEffect(() => {
    const handleFocus = () => setUnreadCount(0);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  // --- Gallery helpers ---
  const backgroundUrlFor = (it: BackgroundItem) => {
    return it.isUnlocked ? it.signedUrl || it.thumbUrl : it.thumbUrl;
  };

  const isSelected = (it: BackgroundItem) => {
    try {
      return selectedBackground && selectedBackground.endsWith(it.name);
    } catch {
      return false;
    }
  };

  const startCheckout = async (file: string) => {
  if (!userEmail) return alert("Please sign in.");
  try {
    const res = await fetch("/api/backgrounds/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, file }),
    });

    // try parse JSON first, but fall back to text for debugging
    let json: any = null;
    try {
      json = await res.json();
    } catch (e) {
      // ignore
    }

    if (!res.ok) {
      const text = await res.text().catch(() => null);
      console.error("Checkout failed:", json ?? text ?? res.status);
      alert("Purchase failed. Check console for details.");
      return;
    }

    if (json?.url) {
      window.location.href = json.url;
    } else {
      const text = await res.text().catch(() => null);
      console.error("Checkout response missing url:", json ?? text);
      alert("Purchase failed. Try again.");
    }
  } catch (e) {
    console.error("checkout error", e);
    alert("Checkout failed due to network error.");
  }
};


  // --- Gallery select (keeps existing saveBackgroundPreference behavior) ---
  const selectBackground = (filename: string, signedUrl?: string | null) => {
    if (signedUrl) {
      setSelectedBackground(signedUrl);
    } else {
      setSelectedBackground(`/${filename}`);
    }
    saveBackgroundPreference(filename);
    setShowGallery(false);
  };

  // --- small helpers ---
  const formatTime = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col h-screen relative bg-gray-50">
      {/* Dynamic background - make image clearly visible: lighter, minimal overlay, no blur */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.06), rgba(0,0,0,0.14)), url('${selectedBackground}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* subtle vignette so content remains readable */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 80px 120px rgba(0,0,0,0.22)" }} />

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21s-7-4.35-9-7c-2-2.5 0-5 3-5 2 0 3 2 6 2s4-2 6-2c3 0 5 2.5 3 5-2 2.65-9 7-9 7z" fill="url(#g)" />
                <defs>
                  <linearGradient id="g" x1="0" x2="1">
                    <stop offset="0" stopColor="#ff8a80" />
                    <stop offset="1" stopColor="#ff80ab" />
                  </linearGradient>
                </defs>
              </svg>
              <div>
                <h1 className="text-white text-lg font-semibold drop-shadow">Truemate Chat</h1>
                <p className="text-sm text-white/90">Close, warm & private conversations</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 bg-white/90 rounded-xl shadow hover:scale-105 transition-transform flex items-center gap-2"
              onClick={() => setShowGallery(true)}
              aria-label="Open gallery"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke="#6b21a8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 15l-5-5-3 3-4-4L3 17" stroke="#6b21a8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium">Gallery</span>
            </button>

            <button onClick={handleSignOut} className="bg-red-500 text-white px-3 py-2 rounded-xl shadow hover:bg-red-600">
              Sign Out
            </button>
          </div>
        </header>

        {/* Chat area */}
        <main className="flex-1 overflow-hidden p-6">
          <div className="mx-auto max-w-3xl h-full flex flex-col rounded-2xl shadow-2xl" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))", border: "1px solid rgba(255,255,255,0.06)" }}>
            {/* top decorative area */}
            <div className="p-6 border-b border-white/10 flex items-center gap-4">
              <img src="/aarvi.jpg" alt="Aarvi" className="w-12 h-12 rounded-full object-cover ring-2 ring-white/70 shadow" />
              <div>
                <div className="text-white font-semibold">Aarvi</div>
                <div className="text-sm text-white/90">Your cherished companion</div>
              </div>
              <div className="ml-auto text-sm text-white/90">{unreadCount > 0 ? `${unreadCount} new` : "All caught up"}</div>
            </div>

            {/* messages list */}
            <div className="p-6 overflow-y-auto flex-1" id="chat-scroll">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] p-4 rounded-2xl shadow-md break-words text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-700/90 text-white rounded-br-none backdrop-blur-sm"
                        : msg.proactive
                        ? "bg-yellow-50/90 text-yellow-900 border border-yellow-300"
                        : "bg-white/80 text-gray-900 backdrop-blur-sm"
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      <div className="text-[11px] mt-2 text-gray-600 text-right">{formatTime(msg.created_at)}</div>
                    </div>
                  </div>
                ))}

                {messages.length === 0 && (
                  <div className="text-center text-white/95 py-12 text-lg">Say hi to Aarvi — she is listening. ❤️</div>
                )}
              </div>
            </div>

            {/* input */}
            <div className="p-4 border-t border-white/10 bg-transparent rounded-b-2xl">
              <div className="max-w-3xl mx-auto flex gap-3 items-center">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Write something from the heart..."
                  className="flex-1 min-h-[48px] max-h-36 resize-none px-4 py-3 rounded-xl focus:outline-none shadow-inner bg-white/90"
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
                  className={`px-5 py-3 rounded-xl text-white font-semibold ${sending ? "bg-purple-400 cursor-not-allowed" : "bg-gradient-to-r from-pink-500 to-purple-600 hover:scale-105"}`}
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer small */}
        <footer className="p-3 text-center text-sm text-white/80">Made with care — keep your memories safe.</footer>
      </div>

      {/* Gallery modal */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowGallery(false)} />
          <div className="relative z-10 max-w-xl w-full bg-white/95 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Choose background</h2>
              <button onClick={() => setShowGallery(false)} className="text-gray-600 px-3 py-1 rounded hover:bg-gray-100">Close</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {backgrounds.length > 0 ? (
                backgrounds.map((it) => (
                  <div key={it.name} className="relative">
                    <button
                      onClick={() => {
                        if (it.isUnlocked) {
                          selectBackground(it.name, it.signedUrl || null);
                        } else {
                          startCheckout(it.name);
                        }
                      }}
                      className={`rounded-xl overflow-hidden shadow-lg p-0 border-2 w-full text-left ${isSelected(it) ? "border-indigo-500" : "border-transparent"}`}
                    >
                      <img src={it.thumbUrl} alt={it.name} className="w-full h-40 object-cover block" />
                      <div className="p-2 text-sm text-center flex items-center justify-between">
                        <span className="truncate w-3/4">{it.name.replace(/[-.]/g, " ")}</span>
                        <span className="text-xs w-1/4 text-right">{it.isUnlocked ? "Unlocked" : "Locked"}</span>
                      </div>
                    </button>
                    {!it.isUnlocked && (
                      <div className="absolute top-2 left-2 bg-black/40 px-2 py-1 rounded text-white text-[11px]">Pay to unlock</div>
                    )}
                  </div>
                ))
              ) : (
                // fallback: original local options (unchanged behaviour)
                backgroundOptions.map((fn) => (
                  <button
                    key={fn}
                    onClick={() => selectBackground(fn)}
                    className={`rounded-xl overflow-hidden shadow-lg p-0 border-2 ${selectedBackground === `/${fn}` ? "border-indigo-500" : "border-transparent"}`}
                  >
                    <img src={`/${fn}`} alt={fn} className="w-full h-40 object-cover block" />
                    <div className="p-2 text-sm text-center">{fn.replace(/[-.]/g, " ")}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
