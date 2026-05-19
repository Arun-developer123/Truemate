"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import * as pushClient from "@/lib/pushClient";
import { registerPushForUser } from "@/lib/registerPush";

type Role = "user" | "assistant" | "system";

export type Message = {
  role: Role;
  content: string;
  proactive?: boolean;
  created_at?: string;
  seen?: boolean;
  scheduled_message_id?: string;
  typing?: boolean;
  source?: string;
  attachment?: {
    name: string;
    type: string;
    size?: number;
    dataUrl?: string | null;
  } | null;
};

export type BackgroundItem = {
  name: string;
  isUnlocked: boolean;
  thumbUrl: string;
  signedUrl?: string | null;
};

type SelectedAttachment = {
  file: File;
  name: string;
  type: string;
  size: number;
  previewUrl: string | null;
  dataUrl: string | null;
};

const GUEST_COOKIE_NAME = "truemate_guest";
const GUEST_CHAT_KEY = "truemate_guest_chat";
const GUEST_COUNT_KEY = "truemate_guest_messages";
const GUEST_LIMIT = 30;
const SUMMARY_DELAY_MS = 5 * 60 * 1000;
const PRESENCE_THROTTLE_MS = 30_000;
const UNLOAD_BEACON_PATH = "/api/presence";
const MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024;

const FALLBACK_BACKGROUND_OPTIONS = [
  "free-1.jpg",
  "free-2.jpg",
  "aarvi1.jpg",
  "aarvi2.jpg",
  "aarvi3.jpg",
  "aarvi4.jpg",
  "aarvi5.jpg",
  "aarvi6.jpg",
  "aarvi7.jpg",
  "aarvi8.jpg",
];

const PUBLIC_BACKGROUND_PREVIEWS: Record<string, string> = {
  "free-1.jpg": "/chat-gallery/free-1.jpg",
  "free-2.jpg": "/chat-gallery/free-2.jpg",
  "hero.jpg": "/chat-gallery/hero.jpg",
};

const QUICK_EMOJIS = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "😎",
  "🥰",
  "😌",
  "🙂",
  "🙃",
  "😉",
  "😇",
  "🥲",
  "😋",
  "😴",
  "😭",
  "😤",
  "🤍",
  "💜",
  "✨",
  "🔥",
  "💫",
  "🌙",
  "❤️",
  "💕",
  "👍",
  "🙌",
];

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const cookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
}

function isGuestCookieEnabled() {
  return readCookie(GUEST_COOKIE_NAME) === "1";
}

function readGuestCount() {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(GUEST_COUNT_KEY) || "0";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function saveGuestCount(count: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_COUNT_KEY, String(Math.max(0, count)));
}

function readGuestChat(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGuestChat(messages: Message[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_CHAT_KEY, JSON.stringify(messages));
  } catch {}
}

function clearGuestModeStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_CHAT_KEY);
    window.localStorage.removeItem(GUEST_COUNT_KEY);
    window.localStorage.removeItem(GUEST_COOKIE_NAME);
    window.localStorage.removeItem("truemate_guest_limit_reached");
  } catch {}
  try {
    document.cookie = `${GUEST_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  } catch {}
}

function dedupeMessages(arr: Message[]) {
  const seen = new Set<string>();
  return arr.filter((m) => {
    const key = `${m.role}|${m.content}|${m.created_at || ""}|${m.typing ? "typing" : ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripTypingMessages(arr: Message[]) {
  return arr.filter((m) => !m.typing);
}

function normalizeMessages(arr: Message[]) {
  return dedupeMessages(stripTypingMessages(arr));
}

type RealtimePayload = {
  new?: {
    chat?: Message[];
    free_chats_remaining?: number | null;
    subscription_status?: string | null;
  };
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function normalizeBackgroundFilename(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const clean = raw.split("?")[0].split("#")[0];
  return clean.split("/").pop() || clean;
}

function resolveBackgroundPreview(filename: string, signedUrl?: string | null) {
  const normalized = normalizeBackgroundFilename(filename);

  if (!normalized) return "/aarvi.jpg";
  if (normalized === "aarvi.jpg") return "/aarvi.jpg";

  const publicPreview = PUBLIC_BACKGROUND_PREVIEWS[normalized];
  if (publicPreview) return publicPreview;

  if (signedUrl && String(signedUrl).trim()) return signedUrl;

  return `/api/backgrounds/thumb?file=${encodeURIComponent(normalized)}`;
}

export function useChatPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [input, setInput] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestMessagesUsed, setGuestMessagesUsed] = useState(0);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [isAarviTyping, setIsAarviTyping] = useState(false);

  const [selectedBackground, setSelectedBackground] = useState<string>("/aarvi.jpg");
  const [selectedBackgroundFilename, setSelectedBackgroundFilename] = useState<string | null>(null);

  const [freeChatsRemaining, setFreeChatsRemaining] = useState<number | null | undefined>(
    undefined
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([]);
  const [backgroundOptions] = useState<string[]>(FALLBACK_BACKGROUND_OPTIONS);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<SelectedAttachment | null>(null);

  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const lastPresenceUpdateRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const attachmentObjectUrlRef = useRef<string | null>(null);

  const emojiOptions = useMemo(() => QUICK_EMOJIS, []);

  useEffect(() => {
    typingRef.current = isAarviTyping;
  }, [isAarviTyping]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceSupported(false);
      return;
    }

    setVoiceSupported(true);

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event?.error || event);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const finalText = transcript.trim();
      if (finalText) {
        setInput(finalText);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handle = attachmentObjectUrlRef.current;
    return () => {
      if (handle) {
        try {
          URL.revokeObjectURL(handle);
        } catch {}
      }
    };
  }, []);

  function resetSummaryTimer(email: string | null) {
    if (!email) return;
    try {
      if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
    } catch {}
    summaryTimerRef.current = setTimeout(() => {
      try {
        const body = JSON.stringify({ email });
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon("/api/flush-chat", blob);
        } else {
          fetch("/api/flush-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("Auto summary trigger failed:", e);
      }
    }, SUMMARY_DELAY_MS);
  }

  useEffect(() => {
    messagesRef.current = messages;
    if (isGuestMode) {
      saveGuestChat(messages.filter((m) => !m.typing));
    }
  }, [messages, isGuestMode]);

  const applyRemoteMessages = (incoming: Message[]) => {
    const clean = normalizeMessages(incoming);
    const current = messagesRef.current;

    if (typingRef.current) return;
    if (clean.length < current.length) return;

    if (JSON.stringify(clean) !== JSON.stringify(current)) {
      setMessages(clean);
      resetSummaryTimer(userEmail);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const getUser = async () => {
      const guestCookieActive = isGuestCookieEnabled();
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        if (guestCookieActive) {
          if (cancelled) return;

          setIsGuestMode(true);
          setUserEmail(null);
          setUser(null);

          const storedMessages = normalizeMessages(readGuestChat());
          setMessages(storedMessages);

          const used = readGuestCount();
          setGuestMessagesUsed(used);
          setFreeChatsRemaining(Math.max(0, GUEST_LIMIT - used));
          setGuestLimitReached(used >= GUEST_LIMIT);

          return;
        }

        router.push("/signin");
        return;
      }

      if (cancelled) return;

      setIsGuestMode(false);
      setGuestLimitReached(false);

      const email = data.user.email ?? null;
      setUserEmail(email);
      setUser(data.user);

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
        let existingData: any = null;

        try {
          const res = await supabase
            .from("users_data")
            .select("chat, background_image, free_chats_remaining, subscription_status")
            .eq("email", email)
            .maybeSingle();

          if (res.error) throw res.error;
          existingData = res.data;
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (/background_image/.test(msg) || /column .* does not exist/.test(msg)) {
            try {
              const res2 = await supabase
                .from("users_data")
                .select("chat, free_chats_remaining, subscription_status")
                .eq("email", email)
                .maybeSingle();

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
            const clean = normalizeMessages(existingData.chat);
            setMessages(clean);
          }

          if (existingData.background_image) {
            const fn = normalizeBackgroundFilename(existingData.background_image);
            setSelectedBackgroundFilename(fn);
            setSelectedBackground(resolveBackgroundPreview(fn));
          }

          if (typeof existingData.free_chats_remaining !== "undefined") {
            setFreeChatsRemaining(
              existingData.free_chats_remaining === null
                ? null
                : Number(existingData.free_chats_remaining)
            );
          } else if (
            existingData.subscription_status &&
            (existingData.subscription_status === "active" ||
              existingData.subscription_status === "trialing")
          ) {
            setFreeChatsRemaining(null);
          }
        }
      }
    };

    getUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!user?.id) return;
    registerPushForUser(user.id).catch((err: any) => {
      console.warn("registerPushForUser failed:", err);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/backgrounds/list?email=${encodeURIComponent(userEmail)}`);
        const json = await res.json();

        if (cancelled) return;

        if (json?.ok && Array.isArray(json.items)) {
          const fixed: BackgroundItem[] = json.items.map((it: any) => {
            const name = it.name;
            let thumbUrl =
              it.thumbUrl || `/api/backgrounds/thumb?file=${encodeURIComponent(name)}`;

            if (
              typeof thumbUrl === "string" &&
              (thumbUrl.includes("undefined/") ||
                (!/^\//.test(thumbUrl) && !/^https?:\/\//.test(thumbUrl)))
            ) {
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

          if (selectedBackgroundFilename) {
            const matched = fixed.find((f) => f.name === selectedBackgroundFilename);
            if (matched && matched.isUnlocked) {
              setSelectedBackground(resolveBackgroundPreview(matched.name, matched.signedUrl));
            } else if (PUBLIC_BACKGROUND_PREVIEWS[selectedBackgroundFilename]) {
              setSelectedBackground(PUBLIC_BACKGROUND_PREVIEWS[selectedBackgroundFilename]);
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

    return () => {
      cancelled = true;
    };
  }, [userEmail, selectedBackgroundFilename]);

  useEffect(() => {
    if (!userEmail) return;

    const handleRealtime = (payload: RealtimePayload) => {
      const incoming: Message[] = payload?.new?.chat ?? [];
      applyRemoteMessages(incoming);

      const newRow = payload?.new ?? {};
      if (typeof newRow.free_chats_remaining !== "undefined") {
        const val =
          newRow.free_chats_remaining === null ? null : Number(newRow.free_chats_remaining);
        setFreeChatsRemaining(val);
      }
      if (
        newRow.subscription_status &&
        (newRow.subscription_status === "active" || newRow.subscription_status === "trialing")
      ) {
        setFreeChatsRemaining(null);
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
        applyRemoteMessages(data.chat);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [userEmail]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      Notification.permission === "granted"
    ) {
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
          const alt = (pushClient as any).registerServiceWorkerAndSubscribe;
          if (typeof alt === "function") {
            alt("/firebase-messaging-sw.js")
              .then((reg: any) => {
                if (reg) {
                  console.log("Service worker registered (alt) at /firebase-messaging-sw.js", reg);
                }
              })
              .catch((err: any) => {
                console.warn("Service worker registration failed (alt):", err);
              });
          }
        }
      } catch (err: any) {
        console.warn("Service worker registration helper failed:", err);
      }
    }
  }, [userEmail]);

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

  const saveBackgroundPreference = async (imageFilename: string) => {
    if (!userEmail) return;
    try {
      const normalized = normalizeBackgroundFilename(imageFilename);

      const res = await supabase
        .from("users_data")
        .update({ background_image: normalized, updated_at: new Date().toISOString() })
        .eq("email", userEmail);

      if (res.error) {
        const msg = String(res.error.message || res.error);
        if (/background_image/.test(msg) || /column .* does not exist/.test(msg)) {
          console.warn("Background preference column missing on DB; skip saving preference.");
        } else {
          console.warn("Failed to save background preference:", msg);
        }
      } else {
        setSelectedBackgroundFilename(normalized);
      }
    } catch (e) {
      console.warn("Failed to save background preference", e);
    }
  };

  const setTypingState = (value: boolean) => {
    setIsAarviTyping(value);
    typingRef.current = value;
  };

  const addTypingBubble = (base: Message[]) => {
    const withoutTyping = stripTypingMessages(base);
    return [
      ...withoutTyping,
      {
        role: "assistant",
        content: "",
        typing: true,
        created_at: new Date().toISOString(),
      } as Message,
    ];
  };

  const finalizeWithReply = (reply: string) => {
    const assistantMsg: Message = {
      role: "assistant",
      content: reply,
      created_at: new Date().toISOString(),
    };

    const current = stripTypingMessages(messagesRef.current);
    const updatedMessages: Message[] = [...current, assistantMsg];
    setMessages(updatedMessages);
    return updatedMessages;
  };

  const clearAttachment = () => {
    if (attachmentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(attachmentObjectUrlRef.current);
      } catch {}
      attachmentObjectUrlRef.current = null;
    }
    setSelectedAttachment(null);
  };

  const handleAttachmentSelect = async (file: File | null) => {
    if (!file) {
      clearAttachment();
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      alert("File is too large. Please keep it under 8MB.");
      return;
    }

    if (attachmentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(attachmentObjectUrlRef.current);
      } catch {}
      attachmentObjectUrlRef.current = null;
    }

    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    if (previewUrl) attachmentObjectUrlRef.current = previewUrl;

    let dataUrl: string | null = null;
    try {
      dataUrl = await readFileAsDataUrl(file);
    } catch (e) {
      console.warn("Failed to read attachment as data URL:", e);
    }

    setSelectedAttachment({
      file,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      previewUrl,
      dataUrl,
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    setInput((prev) => `${prev}${emoji}`);
  };

  const startVoiceInput = () => {
    if (!voiceSupported) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.warn("startVoiceInput failed:", e);
    }
  };

  const stopVoiceInput = () => {
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      console.warn("stopVoiceInput failed:", e);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !selectedAttachment) || sending) return;

    const attachmentSnapshot = selectedAttachment
      ? {
          name: selectedAttachment.name,
          type: selectedAttachment.type,
          size: selectedAttachment.size,
          dataUrl: selectedAttachment.dataUrl,
        }
      : null;

    if (isGuestMode) {
      const currentCount = readGuestCount();

      if (currentCount >= GUEST_LIMIT || guestLimitReached) {
        setGuestLimitReached(true);
        saveGuestCount(GUEST_LIMIT);
        alert("Guest limit reached. Please sign up to continue chatting.");
        return;
      }

      setSending(true);

      try {
        const userMsg: Message = {
          role: "user",
          content: trimmed || (selectedAttachment ? `[Attachment: ${selectedAttachment.name}]` : ""),
          created_at: new Date().toISOString(),
        };

        const optimistic = addTypingBubble([...messagesRef.current, userMsg]);

        setMessages(optimistic);
        setInput("");
        setTypingState(true);
        saveGuestChat(optimistic.filter((m) => !m.typing));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-guest-mode": "1",
            "x-guest-messages-used": String(currentCount),
            "x-tz": Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
          },
          body: JSON.stringify({
            message: trimmed,
            guestMode: true,
            attachment: attachmentSnapshot,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("API /chat error:", data);

          if (res.status === 403 || data?.shouldSignup) {
            setGuestLimitReached(true);
            setGuestMessagesUsed(GUEST_LIMIT);
            saveGuestCount(GUEST_LIMIT);
            setTypingState(false);
            setMessages(stripTypingMessages(messagesRef.current));
            alert("Guest limit reached. Sign up to continue.");
            return;
          }

          throw new Error(data?.error || "Chat API failed");
        }

        const reply = data.reply || data.choices?.[0]?.message?.content || "⚠️ Empty response";

        const updatedMessages = finalizeWithReply(reply);
        saveGuestChat(updatedMessages);
        setTypingState(false);
        clearAttachment();
        setShowEmojiPicker(false);

        const nextCount = currentCount + 1;
        setGuestMessagesUsed(nextCount);
        saveGuestCount(nextCount);

        if (nextCount >= GUEST_LIMIT) {
          setGuestLimitReached(true);
          localStorage.setItem("truemate_guest_limit_reached", "1");
        }
      } catch (err: any) {
        console.error("guest handleSend failed:", err);
        setTypingState(false);
        setMessages(stripTypingMessages(messagesRef.current));
      } finally {
        setSending(false);
      }

      return;
    }

    if (!userEmail || sending) return;
    setSending(true);

    try {
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

      if (typeof usageData.remaining !== "undefined") {
        setFreeChatsRemaining(
          usageData.remaining === null ? null : Number(usageData.remaining)
        );
      }

      const userMsg: Message = {
        role: "user",
        content: trimmed || (selectedAttachment ? `[Attachment: ${selectedAttachment.name}]` : ""),
        created_at: new Date().toISOString(),
      };

      const optimisticWithoutTyping = stripTypingMessages(messagesRef.current);
      const optimistic = addTypingBubble([...optimisticWithoutTyping, userMsg]);

      setMessages(optimistic);
      setInput("");
      setTypingState(true);
      resetSummaryTimer(userEmail);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        setTypingState(false);
        alert("Session expired. Please sign in again.");
        router.push("/signin");
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: trimmed,
          email: userEmail,
          userId: user?.id,
          attachment: attachmentSnapshot,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("API /chat error:", data);
        throw new Error(data?.error || "Chat API failed");
      }

      const reply = data.reply || data.choices?.[0]?.message?.content || "⚠️ Empty response";

      const assistantMsg: Message = {
        role: "assistant",
        content: reply,
        created_at: new Date().toISOString(),
      };

      const updatedMessages: Message[] = [
        ...stripTypingMessages(messagesRef.current),
        assistantMsg,
      ];

      setMessages(updatedMessages);
      setTypingState(false);
      resetSummaryTimer(userEmail);
      clearAttachment();
      setShowEmojiPicker(false);

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
          message: trimmed,
        }),
      });
    } catch (err: any) {
      console.error("handleSend failed:", err);
      setTypingState(false);
      setMessages(stripTypingMessages(messagesRef.current));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!userEmail) return;
      const payload = JSON.stringify({ email: userEmail });
      try {
        if (navigator && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon("/api/flush-chat", blob);
        } else {
          fetch("/api/flush-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("beforeunload flush failed:", e);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [userEmail]);

  useEffect(() => {
    return () => {
      try {
        if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
      } catch {}
      if (attachmentObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(attachmentObjectUrlRef.current);
        } catch {}
      }
    };
  }, []);

  const markPresence = async (isOnline: boolean, useBeacon = false) => {
    const userId = userIdRef.current;
    if (!userId) return;

    const now = new Date().toISOString();
    const nowTs = Date.now();

    if (!isOnline && nowTs - lastPresenceUpdateRef.current < 2000) {
      // allow quick offline transitions
    } else if (nowTs - lastPresenceUpdateRef.current < PRESENCE_THROTTLE_MS) {
      return;
    }
    lastPresenceUpdateRef.current = nowTs;

    if (
      useBeacon &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      try {
        const payload = JSON.stringify({
          user_id: userId,
          is_online: isOnline,
          last_active_at: now,
        });
        navigator.sendBeacon(UNLOAD_BEACON_PATH, new Blob([payload], { type: "application/json" }));
        return;
      } catch (e) {
        console.warn("sendBeacon failed, falling back to supabase update:", e);
      }
    }

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

  useEffect(() => {
    if (!user?.id) return;

    markPresence(true).catch((e) => console.warn("initial markPresence(true) failed:", e));

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markPresence(true).catch((e) => console.warn("visibility->visible markPresence failed:", e));
      } else {
        markPresence(false).catch((e) =>
          console.warn("visibility->hidden markPresence failed:", e)
        );
      }
    };

    const onFocus = () => markPresence(true).catch((e) => console.warn("focus markPresence failed:", e));
    const onBlur = () => markPresence(false).catch((e) => console.warn("blur markPresence failed:", e));

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [user?.id]);

  useEffect(() => {
    const beforeUnloadHandler = (ev?: BeforeUnloadEvent) => {
      try {
        markPresence(false, true);
      } catch (e) {
        console.warn("beforeunload markPresence failed:", e);
      }
      if (ev) ev.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnloadHandler, { passive: true });
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, []);

  useEffect(() => {
    const handleFocus = () => setUnreadCount(0);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const handleSignOut = async () => {
    try {
      if (isGuestMode) {
        clearGuestModeStorage();
        setMessages([]);
        setInput("");
        setIsGuestMode(false);
        setGuestMessagesUsed(0);
        setGuestLimitReached(false);
        setFreeChatsRemaining(undefined);
        setTypingState(false);
        clearAttachment();
        setShowEmojiPicker(false);
        router.push("/signin");
        return;
      }

      await markPresence(false, false);
    } catch (e) {
      console.warn("Presence update failed on sign out:", e);
    }

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("supabase.auth.signOut failed:", e);
    }

    clearAttachment();
    setShowEmojiPicker(false);
    router.push("/signin");
  };

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!menuRef.current) return;
      if (ev.target instanceof Node && !menuRef.current.contains(ev.target)) {
        setMenuOpen(false);
      }
    };

    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setMenuOpen(false);
        setShowGallery(false);
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const startCheckout = async (file: string) => {
    if (!userEmail) return alert("Please sign in.");
    try {
      const res = await fetch("/api/backgrounds/paypal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, file }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("PayPal create failed:", json ?? res.status);
        alert("Purchase failed. Check console for details.");
        return;
      }

      if (json?.url) {
        window.location.href = json.url;
      } else {
        console.error("PayPal create returned no url:", json);
        alert("Purchase failed. Try again.");
      }
    } catch (e) {
      console.error("checkout error", e);
      alert("Checkout failed due to network error.");
    }
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const paypalStatus = params.get("paypal");
      const token = params.get("token");

      if (paypalStatus === "success" && token) {
        (async () => {
          try {
            const res = await fetch("/api/backgrounds/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderID: token }),
            });

            const json = await res.json();

            if (!res.ok) {
              console.error("PayPal capture failed:", json);
              alert("Payment verification failed. Check console.");
            } else if (userEmail) {
              const r = await fetch(`/api/backgrounds/list?email=${encodeURIComponent(userEmail)}`);
              const j = await r.json();
              if (j?.ok && Array.isArray(j.items)) {
                setBackgrounds(
                  j.items.map((it: any) => ({
                    name: it.name,
                    isUnlocked: Boolean(it.isUnlocked),
                    thumbUrl: it.thumbUrl || `/api/backgrounds/thumb?file=${encodeURIComponent(it.name)}`,
                    signedUrl: it.signedUrl ?? null,
                  }))
                );
              }
            }
          } catch (e) {
            console.error("paypal capture error", e);
          } finally {
            try {
              window.history.replaceState({}, document.title, window.location.pathname);
            } catch {}
          }
        })();
      }
    } catch {
      // ignore
    }
  }, [userEmail]);

  const selectBackground = (filename: string, signedUrl?: string | null) => {
    const normalized = normalizeBackgroundFilename(filename);
    const preview = resolveBackgroundPreview(normalized, signedUrl);

    setSelectedBackground(preview);
    setSelectedBackgroundFilename(normalized);
    saveBackgroundPreference(normalized);
    setShowGallery(false);
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  function scrollToMessage(scheduledId: string) {
    if (!scheduledId) return;
    try {
      const el = containerRef.current?.querySelector(
        `[data-scheduled-id="${scheduledId}"]`
      ) as HTMLElement | null;

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        setTimeout(() => el.classList.remove("highlight-pulse"), 3000);
        return;
      }

      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    } catch (e) {
      console.warn("scrollToMessage failed:", e);
    }
  }

  function openChatWithAarvi() {
    try {
      const nodes = containerRef.current?.querySelectorAll(
        `[data-role="assistant"][data-source="scheduled"]`
      );
      if (nodes && nodes.length > 0) {
        const el = nodes[nodes.length - 1] as HTMLElement;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        setTimeout(() => el.classList.remove("highlight-pulse"), 3000);
        return;
      }

      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    } catch (e) {
      console.warn("openChatWithAarvi failed:", e);
    }
  }

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
    } catch {
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
      } catch {
        // ignore
      }
    };

    navigator.serviceWorker?.addEventListener("message", swHandler);
    return () => navigator.serviceWorker?.removeEventListener("message", swHandler);
  }, []);

  const remainingGuestChats = Math.max(0, GUEST_LIMIT - guestMessagesUsed);

  return {
    messages,
    input,
    setInput,
    userEmail,
    user,
    unreadCount,
    sending,
    showGallery,
    setShowGallery,
    isGuestMode,
    guestMessagesUsed,
    guestLimitReached,
    isAarviTyping,
    selectedBackground,
    selectedBackgroundFilename,
    freeChatsRemaining,
    backgrounds,
    menuOpen,
    setMenuOpen,
    menuRef,
    containerRef,
    remainingGuestChats,
    backgroundOptions,
    handleSend,
    handleSignOut,
    selectBackground,
    startCheckout,
    formatTime,
    showEmojiPicker,
    setShowEmojiPicker,
    emojiOptions,
    handleEmojiSelect,
    voiceSupported,
    isListening,
    startVoiceInput,
    stopVoiceInput,
    toggleVoiceInput,
    selectedAttachment,
    handleAttachmentSelect,
    clearAttachment,
  };
}