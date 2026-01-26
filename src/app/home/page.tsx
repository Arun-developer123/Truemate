// C:\Users\aruna\truemate\src\app\home\page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
// NOTE: use namespace import so TS doesn't complain about missing named export
import * as pushClient from "@/lib/pushClient";
import { registerPushForUser } from "@/lib/registerPush";
import SubscribeButton from "@/components/SubscribeButton";
import FreeChatsManager from "@/components/FreeChatsManager";

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
  // optional scheduled message id (present for scheduled messages)
  scheduled_message_id?: string;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  // default to primary image — this ensures an image is always visible
  const [selectedBackground, setSelectedBackground] = useState<string>("/aarvi.jpg");
  // keep filename from DB (if user had previously selected a paid background)
  const [selectedBackgroundFilename, setSelectedBackgroundFilename] = useState<string | null>(null);

  const router = useRouter();

  // Dropdown menu state & refs (NEW)
  const [menuOpen, setMenuOpen] = useState(false);
  const [subMenuOpen, setSubMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
      setUser(data.user); // <--- set user so registerPushForUser can use user.id

      // --- NEW: upsert presence row: mark user online when they hit /home or login ---
      try {
        if (data.user?.id) {
          await supabase
            .from("user_presence")
            .upsert(
              {
                user_id: data.user.id,
                is_online: true,
                last_active_at: new Date().toISOString(),
              },
              { onConflict: "user_id" }
            );
        }
      } catch (e) {
        console.warn("user_presence upsert failed:", e);
      }

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
            // IMPORTANT: never set `/filename` for private images.
            // store filename to try to resolve after gallery list loads
            const fn = existingData.background_image;
            setSelectedBackgroundFilename(fn);

            if (fn === "aarvi.jpg") {
              // free public image -> safe to set directly
              setSelectedBackground("/aarvi.jpg");
            } else {
              // paid image -> keep fallback (public default) until we resolve signedUrl
              setSelectedBackground("/aarvi.jpg");
            }
          }
        }
      }
    };
    getUser();
  }, [router]);

  // --- Register push for user (call once user.id available) ---
  useEffect(() => {
    if (!user?.id) return;
    // fire-and-forget registration; it will request permission and save token
    registerPushForUser(user.id).catch((err: any) => {
      console.warn("registerPushForUser failed:", err);
    });
  }, [user?.id]);

  // --- Load gallery items from server ---
  useEffect(() => {
    if (!userEmail) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/backgrounds/list?email=${encodeURIComponent(userEmail)}`);
        const json = await res.json();
        if (json?.ok && Array.isArray(json.items)) {
          // Fix any broken thumbUrl that was accidentally created using undefined env var
          const fixed: BackgroundItem[] = json.items.map((it: any) => {
            const name = it.name;
            let thumbUrl = it.thumbUrl || `/api/backgrounds/thumb?file=${encodeURIComponent(name)}`;
            // defensive: if thumbUrl contains "undefined/" or doesn't start with http/"/", fallback to relative path
            if (typeof thumbUrl === "string" && (thumbUrl.includes("undefined/") || (!/^\//.test(thumbUrl) && !/^https?:\/\//.test(thumbUrl)))) {
              thumbUrl = `/api/backgrounds/thumb?file=${encodeURIComponent(name)}`;
            }
            return {
              name,
              isUnlocked: Boolean(it.isUnlocked),
              thumbUrl,
              signedUrl: it.signedUrl ?? null,
            };
          });
          setBackgrounds(fixed);

          // If we loaded a filename from DB earlier, try resolve it now:
          if (selectedBackgroundFilename && selectedBackgroundFilename !== "aarvi.jpg") {
            const matched = fixed.find((f) => f.name === selectedBackgroundFilename);
            if (matched) {
              // if unlocked and signedUrl present, apply it now
              if (matched.isUnlocked && matched.signedUrl) {
                setSelectedBackground(matched.signedUrl);
              } else {
                // otherwise keep fallback (aarvi.jpg) until user unlocks
                // no-op
              }
            }
          }
        } else {
          console.warn("backgrounds list returned no items:", json);
        }
      } catch (e) {
        console.warn("Failed to load backgrounds", e);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, selectedBackgroundFilename]);

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

  // --- Register service worker (fixed: use pushClient namespace + typed handlers) ---
  useEffect(() => {
    if (!userEmail) return;
    if (typeof window !== "undefined" && "serviceWorker" in navigator && Notification.permission === "granted") {
      // call the function if it's present on the module (defensive)
      try {
        const fn = (pushClient as any).ensureServiceWorkerRegistered;
        if (typeof fn === "function") {
          fn("/firebase-messaging-sw.js")
            .then((reg: any) => {
              if (reg) console.log("Service worker registered at /firebase-messaging-sw.js", reg);
            })
            .catch((err: any) => {
              console.warn("Service worker registration failed:", err);
            });
        } else {
          // fallback: try other known function name if available (defensive - won't change behavior)
          const alt = (pushClient as any).registerServiceWorkerAndSubscribe;
          if (typeof alt === "function") {
            alt("/firebase-messaging-sw.js")
              .then((reg: any) => {
                if (reg) console.log("Service worker registered (alt) at /firebase-messaging-sw.js", reg);
              })
              .catch((err: any) => {
                console.warn("Service worker registration failed (alt):", err);
              });
          } else {
            // No-op: the module didn't export a known SW helper; silently skip.
            // This preserves behaviour without throwing a TS import error.
          }
        }
      } catch (err: any) {
        console.warn("Service worker registration helper failed:", err);
      }
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
      } else {
        // update our local filename state so gallery resolution can apply immediately
        setSelectedBackgroundFilename(imageFilename);
      }
    } catch (e) {
      console.warn("Failed to save background preference", e);
    }
  };

  // --- Handle send ---
  const handleSend = async () => {
    if (!input.trim() || !userEmail || sending) return;
    setSending(true);

    try {
      // 🔒 STEP 1: CHECK FREE CHAT LIMIT (BEFORE ANY UI CHANGE)
      const usage = await fetch("/api/user/use-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });

      const usageData = await usage.json();

      if (!usageData.ok) {
        alert("Free chats finished. Please upgrade.");
        setSending(false);
        return;
      }

      // ✅ STEP 2: NOW SAFE TO ADD MESSAGE
      const userMsg: Message = { role: "user", content: input };
      const optimistic = [...messagesRef.current, userMsg];

      setMessages(optimistic);
      setInput("");

      // 🤖 STEP 3: CALL AI
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          email: userEmail,
          userId: user?.id,
        }),
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "⚠️ Empty response";

      const assistantMsg: Message = {
        role: "assistant",
        content: reply,
      };

      const updatedMessages: Message[] = [...optimistic, assistantMsg];

      setMessages(updatedMessages);

      await supabase
        .from("users_data")
        .update({
          chat: updatedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("email", userEmail);

      await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          message: input,
        }),
      });
    } catch (err: any) {
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

  // --- Presence & reliable offline handling (production-ready) ---
  const userIdRef = useRef<string | null>(null);
  const lastPresenceUpdateRef = useRef<number>(0);
  const PRESENCE_THROTTLE_MS = 30_000; // at most one DB write every 30s
  const UNLOAD_BEACON_PATH = "/api/presence"; // optional API route for sendBeacon fallback

  // keep userIdRef up-to-date so unload handler has latest id
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  /**
   * Mark presence server-side.
   * 1) If `useBeacon` and navigator.sendBeacon available, attempt a beacon to a lightweight API route (fast on unload).
   *    You may implement this serverless API to accept the payload and update Supabase (recommended).
   * 2) Otherwise fall back to Supabase client `upsert`.
   *
   * NOTE: We throttle actual writes to avoid DB spam when user is rapidly switching visibility/focus.
   */
  const markPresence = async (isOnline: boolean, useBeacon = false) => {
    const userId = userIdRef.current;
    if (!userId) return;

    const now = new Date().toISOString();
    const nowTs = Date.now();
    // throttle frequent writes
    if (!isOnline && nowTs - lastPresenceUpdateRef.current < 2000) {
      // allow immediate offline transitions if they happen quickly (small guard)
      // but generally respect throttle
    } else if (nowTs - lastPresenceUpdateRef.current < PRESENCE_THROTTLE_MS) {
      return;
    }
    lastPresenceUpdateRef.current = nowTs;

    // prefer sendBeacon for unload scenarios (fast, best-effort)
    if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const payload = JSON.stringify({ user_id: userId, is_online: isOnline, last_active_at: now });
        // If you don't have this API route, create a simple serverless route that upserts to user_presence.
        navigator.sendBeacon(UNLOAD_BEACON_PATH, new Blob([payload], { type: "application/json" }));
        return;
      } catch (e) {
        // fallback to client update below
        console.warn("sendBeacon failed, falling back to supabase update:", e);
      }
    }

    // fallback: use Supabase client (best-effort in normal runtime; may not complete on unload)
    try {
      await supabase
        .from("user_presence")
        .upsert(
          {
            user_id: userId,
            is_online: isOnline,
            last_active_at: now,
          },
          { onConflict: "user_id" }
        );
    } catch (e) {
      console.warn("markPresence supabase upsert failed:", e);
    }
  };

  // Set user online when tab becomes visible / focused
  useEffect(() => {
    if (!user?.id) return;

    // mark online immediately when this effect runs (user landed on page)
    markPresence(true).catch((e) => console.warn("initial markPresence(true) failed:", e));

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markPresence(true).catch((e) => console.warn("visibility->visible markPresence failed:", e));
      } else {
        // when hiding, mark offline (best-effort) but don't block
        markPresence(false).catch((e) => console.warn("visibility->hidden markPresence failed:", e));
      }
    };

    const onFocus = () => markPresence(true).catch((e) => console.warn("focus markPresence failed:", e));
    const onBlur = () => markPresence(false).catch((e) => console.warn("blur markPresence failed:", e));

    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
    // only depend on user id (handlers refer to userIdRef)
  }, [user?.id]);

  // Use beforeunload to best-effort mark offline using sendBeacon (fast) then fallback to async update
  useEffect(() => {
    const beforeUnloadHandler = (ev?: BeforeUnloadEvent) => {
      // try beacon when available for reliability on page unload
      // useBeacon = true to prefer navigator.sendBeacon (non-blocking)
      try {
        markPresence(false, true);
      } catch (e) {
        console.warn("beforeunload markPresence failed:", e);
      }

      // Optionally set a returnValue to prompt; we don't prompt so nothing set.
      if (ev) ev.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnloadHandler, { passive: true });
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, []);

  // Reset unread count on focus (keeps UX snappy)
  useEffect(() => {
    const handleFocus = () => setUnreadCount(0);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Sign out helper: mark offline (waits for upsert to complete) then sign out and redirect
  const handleSignOut = async () => {
    try {
      // ensure presence marked offline before sign out
      await markPresence(false, false); // prefer direct DB update here
    } catch (e) {
      console.warn("Presence update failed on sign out:", e);
    }

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("supabase.auth.signOut failed:", e);
    }

    router.push("/signin");
  };

  // Close menu on outside click / escape
  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!menuRef.current) return;
      if (ev.target instanceof Node && !menuRef.current.contains(ev.target)) {
        setMenuOpen(false);
        setSubMenuOpen(false);
      }
    };
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setMenuOpen(false);
        setSubMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // --- Gallery helpers ---
  const backgroundUrlFor = (it: BackgroundItem) => {
    return it.isUnlocked ? it.signedUrl || it.thumbUrl : it.thumbUrl;
  };

  const isSelected = (it: BackgroundItem) => {
    try {
      // match by signedUrl (preferred) or by filename fallback
      if (it.signedUrl && selectedBackground === it.signedUrl) return true;
      if (selectedBackground && selectedBackground.endsWith(it.name)) return true;
      // also consider public default
      if (it.name === "aarvi.jpg" && selectedBackground === "/aarvi.jpg") return true;
      return false;
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
      // unlocked paid image => use signed URL directly (secure)
      setSelectedBackground(signedUrl);
    } else {
      // no signedUrl provided — only safe direct file we allow is the public default
      if (filename === "aarvi.jpg") {
        setSelectedBackground("/aarvi.jpg");
      } else {
        // private image not unlocked: keep default public image as safe fallback
        setSelectedBackground("/aarvi.jpg");
      }
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

  // --- NEW: scrollToMessage & openChatWithAarvi (deep-link handling) ---
  function scrollToMessage(scheduledId: string) {
    if (!scheduledId) return;
    try {
      const el = containerRef.current?.querySelector(`[data-scheduled-id="${scheduledId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        setTimeout(() => el.classList.remove("highlight-pulse"), 3000);
        return;
      }
      // fallback: if not found, scroll to bottom
      containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
    } catch (e) {
      console.warn("scrollToMessage failed:", e);
    }
  }

  function openChatWithAarvi() {
    try {
      const nodes = containerRef.current?.querySelectorAll(`[data-role="assistant"][data-source="scheduled"]`);
      if (nodes && nodes.length > 0) {
        const el = nodes[nodes.length - 1] as HTMLElement;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        setTimeout(() => el.classList.remove("highlight-pulse"), 3000);
        return;
      }
      containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
    } catch (e) {
      console.warn("openChatWithAarvi failed:", e);
    }
  }

  // on mount: check URL params for deep-link and listen for SW postMessage navigation fallback
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("open") === "aarvi") {
        const id = params.get("scheduled_message_id");
        if (id) {
          scrollToMessage(id);
        } else {
          openChatWithAarvi();
        }
      }
    } catch (e) {
      // ignore
    }

    const swHandler = (ev: MessageEvent) => {
      try {
        const msg = ev.data;
        if (msg?.type === "navigate" && msg?.url) {
          const url = new URL(msg.url, window.location.origin);
          const id = url.searchParams.get("scheduled_message_id");
          if (id) scrollToMessage(id);
          else openChatWithAarvi();
          return;
        }
      } catch (e) {
        // ignore
      }
    };

    navigator.serviceWorker?.addEventListener("message", swHandler);
    return () => navigator.serviceWorker?.removeEventListener("message", swHandler);
  }, []);

  return (
    <div className="flex flex-col h-screen relative bg-gray-50">
      {/* Dynamic background - make image clearly visible: lighter, minimal overlay, no blur */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: selectedBackground ? `linear-gradient(rgba(0,0,0,0.06), rgba(0,0,0,0.14)), url('${selectedBackground}')` : undefined,
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

          {/* RIGHT: three-dot menu (replaces direct buttons) */}
          <div className="relative" ref={menuRef}>
            <button
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((s) => !s)}
              className="p-2 rounded-full bg-white/90 shadow hover:scale-105 transition-transform"
              title="Open menu"
            >
              {/* three dots icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-800" viewBox="0 0 24 24" fill="none">
                <circle cx="5" cy="12" r="1.8" fill="currentColor" />
                <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                <circle cx="19" cy="12" r="1.8" fill="currentColor" />
              </svg>
            </button>

            {/* menu dropdown */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl ring-1 ring-black/10 p-2 z-50">
                <button
                  onClick={() => {
                    setShowGallery(true);
                    setMenuOpen(false);
                    setSubMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                >
                  {/* gallery icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke="#6b21a8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 15l-5-5-3 3-4-4L3 17" stroke="#6b21a8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm">Gallery</span>
                </button>

                <div className="border-t my-1" />

                <div className="border-t my-1" />

                <button onClick={handleSignOut} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M16 17l5-5-5-5" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12H9" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="3" y="3" width="12" height="18" rx="2" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm text-red-600">Sign Out</span>
                </button>
              </div>
            )}
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

            {/* Free chats banner / upgrade manager */}
            <div className="px-6 py-2 border-b border-white/10">
              <FreeChatsManager userEmail={userEmail} userId={user?.id} messages={messages} />
            </div>

            {/* messages list */}
            <div className="p-6 overflow-y-auto flex-1" id="chat-scroll" ref={containerRef}>
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    data-scheduled-id={msg.scheduled_message_id || ""}
                    data-role={msg.role}
                    data-source={(msg as any).source || ""}
                  >
                    <div
                      className={`max-w-[70%] p-4 rounded-2xl shadow-md break-words text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-700/90 text-white rounded-br-none backdrop-blur-sm"
                          : msg.proactive
                          ? "bg-yellow-50/90 text-yellow-900 border border-yellow-300"
                          : "bg-white/80 text-gray-900 backdrop-blur-sm"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      <div className="text-[11px] mt-2 text-gray-600 text-right">{formatTime(msg.created_at)}</div>
                    </div>
                  </div>
                ))}

                {messages.length === 0 && <div className="text-center text-white/95 py-12 text-lg">Say hi to Aarvi — she is listening. ❤️</div>}
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
              <button onClick={() => setShowGallery(false)} className="text-gray-600 px-3 py-1 rounded hover:bg-gray-100">
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {backgrounds.length > 0 ? (
                backgrounds.map((it) => (
                  <div key={it.name} className="relative">
                    <button
                      // Prevent context menu (right-click) for locked items so user can't "Open image in new tab"
                      onContextMenu={(e) => {
                        if (!it.isUnlocked) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      onClick={() => {
                        if (it.isUnlocked) {
                          selectBackground(it.name, it.signedUrl || null);
                        } else {
                          startCheckout(it.name);
                        }
                      }}
                      className={`rounded-xl overflow-hidden shadow-lg p-0 border-2 w-full text-left ${isSelected(it) ? "border-indigo-500" : "border-transparent"}`}
                    >
                      {/* Image: blur when locked. Also disable drag to make it harder to open/save */}
                      <img
                        src={it.thumbUrl}
                        alt={it.name}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        className={`w-full h-40 object-cover block transition-transform duration-300 ${it.isUnlocked ? "" : "filter blur-sm scale-105"}`}
                      />

                      {/* Text row */}
                      <div className="p-2 text-sm text-center flex items-center justify-between">
                        <span className="truncate w-3/4">{it.name.replace(/[-.]/g, " ")}</span>
                        <span className="text-xs w-1/4 text-right">{it.isUnlocked ? "Unlocked" : "Locked"}</span>
                      </div>
                    </button>

                    {/* Lock overlay & icon for locked items */}
                    {!it.isUnlocked && (
                      <>
                        {/* subtle dark overlay so the blurred image reads as locked */}
                        <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                          <div className="absolute inset-0 bg-black/25 rounded-xl" />
                        </div>

                        {/* centered lock icon */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-white/90 rounded-full p-2 shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-800" viewBox="0 0 24 24" fill="none">
                              <path d="M12 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" fill="currentColor" />
                              <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                              <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>

                        {/* small top-left badge */}
                        <div className="absolute top-2 left-2 bg-black/40 px-2 py-1 rounded text-white text-[11px]">Pay to unlock</div>
                      </>
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
                    <img src={`/${fn}`} alt={fn} className="w-full h-40 object-cover block" draggable={false} onDragStart={(e) => e.preventDefault()} />
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
