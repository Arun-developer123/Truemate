"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Heart,
  Plus,
  Send,
  Smile,
  Mic,
  Paperclip,
  Image as ImageIcon,
  Upload,
  Crown,
  X,
} from "lucide-react";
import { useChatPage } from "@/hooks/useChatPage";

const TOTAL_FREE_CHATS = 30;
const SHOW_UPGRADE_THRESHOLD = 5;

type UpgradePlan = "monthly" | "yearly";

type PendingStarter = {
  starter: string;
  autoSend: boolean;
  source?: string;
  mood?: string;
};

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function clearPendingStarter() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("truemate_chat_starter");
    window.localStorage.removeItem("truemate_chat_auto_consumed");
  } catch {
    // ignore
  }
}

export default function ChatPage(): React.JSX.Element {
  const chat = useChatPage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const attachBtnRef = useRef<HTMLButtonElement | null>(null);
  const autoStarterTimerRef = useRef<number | null>(null);
  const autoStarterHandledRef = useRef(false);

  const safeRemaining =
    typeof chat.freeChatsRemaining === "number" && Number.isFinite(chat.freeChatsRemaining)
      ? chat.freeChatsRemaining
      : chat.isGuestMode && typeof chat.remainingGuestChats === "number" && Number.isFinite(chat.remainingGuestChats)
        ? chat.remainingGuestChats
        : null;

  const showUpgradeBanner =
    typeof safeRemaining === "number" && safeRemaining >= 0 && safeRemaining <= SHOW_UPGRADE_THRESHOLD;

  const progressValue =
    typeof safeRemaining === "number"
      ? Math.max(0, Math.min(1, safeRemaining / TOTAL_FREE_CHATS))
      : 0;

  const handleCheckout = (plan: UpgradePlan) => {
    try {
      sessionStorage.setItem("chat-needs-refresh", "1");
    } catch {
      // ignore
    }
    setShowUpgradeModal(false);
    chat.startCheckout(plan);
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    await chat.handleAttachmentSelect(file);
  };

  const handleSend = async () => {
    await chat.handleSend();
    setShowAttachMenu(false);
    chat.setShowEmojiPicker(false);
  };

  const canUseMic = chat.voiceSupported;

  useEffect(() => {
    const refreshAfterCheckout = () => {
      try {
        const flag = sessionStorage.getItem("chat-needs-refresh");
        if (flag === "1") {
          sessionStorage.removeItem("chat-needs-refresh");
          window.location.reload();
        }
      } catch {
        // ignore
      }
    };

    const onFocus = () => {
      refreshAfterCheckout();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        refreshAfterCheckout();
        return;
      }
      refreshAfterCheckout();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;

      if (
        showAttachMenu &&
        attachMenuRef.current &&
        attachBtnRef.current &&
        !attachMenuRef.current.contains(target) &&
        !attachBtnRef.current.contains(target)
      ) {
        setShowAttachMenu(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showAttachMenu]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (autoStarterHandledRef.current) return;

    const urlStarter = (searchParams.get("starter") || "").trim();
    const urlAutoSend = (searchParams.get("autoSend") || "").trim();
    const urlSource = (searchParams.get("source") || "").trim();
    const urlMood = (searchParams.get("mood") || "").trim();

    const stored = loadJson<PendingStarter | null>("truemate_chat_starter", null);
    const storedStarter = (stored?.starter || "").trim();

    const starter = urlStarter || storedStarter;
    const shouldAutoSend =
      urlAutoSend === "1" ||
      urlAutoSend.toLowerCase() === "true" ||
      stored?.autoSend === true ||
      loadJson<boolean>("truemate_chat_auto_consumed", false) === false;

    if (!starter) return;

    autoStarterHandledRef.current = true;

    if (urlMood) {
      saveJson("truemate_mood_context", {
        mood: urlMood,
        label: urlMood,
        hint: urlMood,
        changedAt: new Date().toISOString(),
      });
    }

    chat.setInput(starter);

    if (autoStarterTimerRef.current) {
      window.clearTimeout(autoStarterTimerRef.current);
    }

    if (shouldAutoSend) {
      try {
        window.localStorage.setItem("truemate_chat_auto_consumed", "true");
      } catch {
        // ignore
      }

      autoStarterTimerRef.current = window.setTimeout(async () => {
        try {
          chat.setInput(starter);
          await chat.handleSend();
          clearPendingStarter();
          if (urlSource || urlMood || urlStarter) {
            window.history.replaceState({}, "", "/chat");
          }
        } catch {
          // ignore
        }
      }, 220);
    } else {
      saveJson("truemate_chat_starter", {
        starter,
        autoSend: false,
        source: urlSource || stored?.source || "home",
        mood: urlMood || stored?.mood || "",
        createdAt: new Date().toISOString(),
      });
    }

    return () => {
      if (autoStarterTimerRef.current) {
        window.clearTimeout(autoStarterTimerRef.current);
        autoStarterTimerRef.current = null;
      }
    };
  }, [searchParams, chat]);

  const attachmentLabel = useMemo(() => {
    const a = chat.selectedAttachment;
    if (!a) return "";
    return a.name.length > 28 ? `${a.name.slice(0, 28)}...` : a.name;
  }, [chat.selectedAttachment]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#090510] text-white">
      <style jsx global>{`
        @keyframes heartbeat {
          0%,
          100% {
            transform: scale(1);
          }
          14% {
            transform: scale(1.18);
          }
          28% {
            transform: scale(0.98);
          }
          42% {
            transform: scale(1.22);
          }
          70% {
            transform: scale(1);
          }
        }

        @keyframes glowSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes bubbleFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        .animate-heartbeat {
          animation: heartbeat 1.15s ease-in-out infinite;
        }

        .animate-glowSpin {
          animation: glowSpin 8s linear infinite;
        }

        .animate-bubbleFloat {
          animation: bubbleFloat 2.4s ease-in-out infinite;
        }
      `}</style>

      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{
          backgroundImage: chat.selectedBackground
            ? `linear-gradient(180deg, rgba(10,7,20,0.34), rgba(10,7,20,0.64)), url('${chat.selectedBackground}')`
            : "linear-gradient(180deg, rgba(10,7,20,0.34), rgba(10,7,20,0.64))",
          filter: "saturate(1.08) contrast(1.03)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 18%, rgba(255,105,180,0.20), transparent 24%), radial-gradient(circle at 70% 28%, rgba(168,85,247,0.22), transparent 28%), radial-gradient(circle at 50% 70%, rgba(255,255,255,0.05), transparent 35%)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 120px 140px rgba(0,0,0,0.10), inset 0 -110px 150px rgba(0,0,0,0.28)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col px-4 pt-4 pb-4 sm:px-6">
        <header className="relative z-[120] mb-4 flex items-start justify-between">
          <button
            onClick={() => router.back()}
            className="mt-1 grid h-12 w-12 place-items-center rounded-full border border-pink-300/35 bg-black/22 backdrop-blur-xl transition hover:scale-105 hover:bg-black/30"
            aria-label="Back"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
            <div className="relative shrink-0">
              <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-500 blur-[10px] opacity-50 animate-pulse" />
              <div className="absolute -inset-1 rounded-full border border-pink-300/50 animate-glowSpin" />
              <div className="absolute -inset-[2px] rounded-full border border-fuchsia-300/30 animate-pulse" />
              <img
                src="/aarvi.jpg"
                alt="Aarvi"
                className="relative h-16 w-16 rounded-full object-cover ring-2 ring-pink-400 shadow-[0_0_0_2px_rgba(255,255,255,0.05)]"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[28px] font-semibold leading-none tracking-tight text-white">
                  Aarvi <span className="text-pink-300">✿</span>
                </h1>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[15px] text-white/92">
                <span>Online</span>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.75)]" />
              </div>
              <p className="mt-1 text-[14px] text-white/65">I’m here for you, always 💗</p>
            </div>
          </div>

          <div className="relative z-[140] flex items-center gap-3">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="grid h-12 w-12 place-items-center rounded-full border border-fuchsia-400/50 bg-black/22 backdrop-blur-xl transition hover:scale-105 hover:bg-black/30"
              aria-label="Upgrade"
              title="Upgrade"
            >
              <Crown className="h-5 w-5 text-pink-200" />
            </button>

            <div className="relative z-[150]" ref={chat.menuRef}>
              <button
                aria-haspopup="true"
                aria-expanded={chat.menuOpen}
                onClick={() => chat.setMenuOpen((s) => !s)}
                className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-black/22 backdrop-blur-xl transition hover:scale-105 hover:bg-black/30"
                title="Open menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle cx="5" cy="12" r="1.8" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                  <circle cx="19" cy="12" r="1.8" fill="currentColor" />
                </svg>
              </button>

              {chat.menuOpen && (
                <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-white/10 bg-[#140f20]/98 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl z-[200]">
                  <button
                    onClick={() => {
                      chat.setMenuOpen(false);
                      router.push("/chat/gallery");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/6"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-white/8">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-pink-300"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M21 15l-5-5-3 3-4-4L3 17"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <span className="text-[14px] text-white/90">Gallery</span>
                  </button>

                  <button
                    onClick={chat.handleSignOut}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/6"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-white/8">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-red-300"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M16 17l5-5-5-5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M21 12H9"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <rect
                          x="3"
                          y="3"
                          width="12"
                          height="18"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <span className="text-[14px] text-red-200">
                      {chat.isGuestMode ? "Leave Guest Mode" : "Sign Out"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {showUpgradeBanner && (
          <div className="mb-4 rounded-[28px] border border-fuchsia-400/35 bg-white/7 px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-pink-500/15 ring-1 ring-white/10">
                <div className="text-3xl">💎</div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[18px] font-semibold text-white">Unlock unlimited conversations</div>
                <div className="mt-1 text-[13px] text-white/72">Go Premium and never run out of chats</div>
              </div>

              <button
                onClick={() => setShowUpgradeModal(true)}
                className="shrink-0 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 px-6 py-4 text-[16px] font-semibold text-white shadow-[0_10px_24px_rgba(168,85,247,0.32)] transition hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="inline-flex items-center gap-2">
                  <span>👑</span>
                  Upgrade
                </span>
              </button>
            </div>
          </div>
        )}

        <main className="relative z-0 flex-1 overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="mx-auto mb-4 w-fit rounded-full bg-black/30 px-5 py-2 text-[14px] font-medium text-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              Today <span className="text-pink-300">💗</span>
            </div>

            <div ref={chat.containerRef} id="chat-scroll" className="flex-1 overflow-y-auto px-1 pb-3">
              <div className="space-y-4 pb-6">
                {chat.messages.map((msg, i) => {
                  if (msg.typing) {
                    return (
                      <div key={`typing-${i}`} className="flex justify-start">
                        <div className="animate-bubbleFloat rounded-full border border-fuchsia-400/35 bg-black/22 px-4 py-2 backdrop-blur-2xl">
                          <div className="flex items-center gap-3 text-[15px] text-white/75">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-400 animate-bounce [animation-delay:0ms]" />
                              <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-400 animate-bounce [animation-delay:120ms]" />
                              <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-400 animate-bounce [animation-delay:240ms]" />
                            </span>
                            <span>Aarvi is typing...</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const isUser = msg.role === "user";

                  return (
                    <div
                      key={i}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      data-scheduled-id={msg.scheduled_message_id || ""}
                      data-role={msg.role}
                      data-source={msg.source || ""}
                    >
                      <div className="relative max-w-[78%]">
                        <div
                          className={`relative rounded-[26px] px-5 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-2xl ${
                            isUser
                              ? "rounded-br-[8px] border border-fuchsia-400/55 bg-gradient-to-br from-violet-700/88 via-fuchsia-700/82 to-violet-900/90 text-white"
                              : "rounded-bl-[8px] border border-white/12 bg-black/26 text-white/95"
                          }`}
                        >
                          <div className="whitespace-pre-wrap text-[16px] leading-[1.45] tracking-[0.1px]">
                            {msg.content}
                          </div>

                          {msg.attachment?.name ? (
                            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-white/75">
                              Attached: {msg.attachment.name}
                            </div>
                          ) : null}

                          <div className={`mt-2 text-right text-[12px] ${isUser ? "text-sky-300" : "text-white/45"}`}>
                            {chat.formatTime(msg.created_at)}
                            {isUser ? (
                              <span className={`ml-1 inline-flex items-center ${chat.isAarviTyping ? "text-sky-300" : "text-white/55"}`}>
                                ✓✓
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {!isUser && (
                          <div className="animate-heartbeat absolute -bottom-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-[0_8px_20px_rgba(236,72,153,0.35)]">
                            <Heart className="h-4 w-4 fill-white text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {chat.messages.length === 0 && (
                  <div className="py-14 text-center text-[18px] text-white/80">Say hi to Aarvi — she is listening. ❤️</div>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-[26px] border border-white/10 bg-white/7 px-4 py-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-white/85">
                  <span className="text-[18px]">🎁</span>
                  <span className="text-[14px] font-medium">Free chats left today</span>
                </div>

                <div className="rounded-full border border-fuchsia-400/40 bg-[#2a1243] px-4 py-1 text-[14px] font-semibold text-white">
                  {typeof safeRemaining === "number" ? `${safeRemaining} / ${TOTAL_FREE_CHATS}` : "— / 30"}
                </div>

                <div className="h-2 flex-1 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-500 transition-all"
                    style={{ width: `${Math.max(8, progressValue * 100)}%` }}
                  />
                </div>

                <div className="hidden items-center gap-2 text-white/78 sm:flex">
                  <span className="text-[16px]">👑</span>
                  <span className="text-[14px]">Upgrade for unlimited</span>
                </div>
              </div>
            </div>

            {chat.selectedAttachment && (
              <div className="mt-3 rounded-[22px] border border-fuchsia-400/25 bg-black/22 px-4 py-3 backdrop-blur-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[13px] font-medium text-white/80">Attachment ready</div>
                  <button onClick={chat.clearAttachment} className="text-white/55 hover:text-white" aria-label="Clear attachment">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 p-3">
                  {chat.selectedAttachment.previewUrl ? (
                    <img
                      src={chat.selectedAttachment.previewUrl}
                      alt={chat.selectedAttachment.name}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-xl bg-white/10">
                      <Paperclip className="h-5 w-5 text-fuchsia-300" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-white">{attachmentLabel}</div>
                    <div className="mt-1 text-[12px] text-white/55">{chat.selectedAttachment.type || "file"}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="relative mt-4 flex items-end gap-3">
              <div className="relative">
                <button
                  ref={attachBtnRef}
                  type="button"
                  onClick={() => {
                    chat.setShowEmojiPicker(false);
                    setShowAttachMenu((s) => !s);
                  }}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-fuchsia-400/45 bg-black/18 text-fuchsia-200 backdrop-blur-2xl shadow-[0_10px_26px_rgba(0,0,0,0.2)] transition hover:scale-105"
                  aria-label="Add attachment"
                >
                  <Plus className="h-7 w-7" />
                </button>

                {showAttachMenu && (
                  <div
                    ref={attachMenuRef}
                    className="absolute bottom-16 left-0 z-[200] w-56 rounded-2xl border border-white/10 bg-[#140f20]/98 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
                  >
                    <button
                      onClick={handlePickFile}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-white/90 hover:bg-white/6"
                    >
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-white/8">
                        <ImageIcon className="h-4 w-4 text-pink-300" />
                      </div>
                      <div>
                        <div className="text-[14px] font-medium">Upload image / file</div>
                        <div className="text-[12px] text-white/50">Photos, PDFs, docs, etc.</div>
                      </div>
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,application/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files)}
                />
              </div>

              <div className="relative flex h-16 flex-1 items-center rounded-full border border-white/10 bg-black/22 px-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
                <input
                  value={chat.input}
                  onChange={(e) => chat.setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="h-full flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/45"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={chat.isGuestMode && chat.guestLimitReached}
                />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      chat.setShowEmojiPicker((s) => !s);
                    }}
                    className="ml-2 grid h-11 w-11 place-items-center rounded-full border border-white/12 bg-white/5 text-white/80 transition hover:bg-white/10"
                    aria-label="Emoji"
                  >
                    <Smile className="h-5 w-5" />
                  </button>

                  {chat.showEmojiPicker && (
                    <div className="absolute bottom-16 right-0 z-[220] w-64 rounded-2xl border border-white/10 bg-[#140f20]/98 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                      <div className="mb-2 text-[13px] font-medium text-white/70">Emojis</div>
                      <div className="grid grid-cols-5 gap-2">
                        {chat.emojiOptions.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => chat.handleEmojiSelect(emoji)}
                            className="grid h-10 w-10 place-items-center rounded-xl bg-white/6 text-[18px] transition hover:scale-105 hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={chat.toggleVoiceInput}
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/12 bg-black/22 text-white/85 shadow-[0_10px_26px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition hover:scale-105 ${
                  chat.isListening ? "ring-2 ring-pink-400/70" : ""
                } ${!canUseMic ? "opacity-60" : ""}`}
                aria-label="Voice"
                disabled={!canUseMic}
                title={canUseMic ? (chat.isListening ? "Stop voice input" : "Start voice input") : "Voice not supported"}
              >
                <Mic className={`h-5 w-5 ${chat.isListening ? "text-pink-300" : ""}`} />
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={chat.sending || (chat.isGuestMode && chat.guestLimitReached)}
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-[0_12px_30px_rgba(168,85,247,0.35)] transition hover:scale-105 active:scale-[0.98] ${
                  chat.sending || (chat.isGuestMode && chat.guestLimitReached)
                    ? "cursor-not-allowed bg-violet-400/60"
                    : "bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-600"
                }`}
                aria-label="Send"
              >
                <Send className="h-5 w-5 -rotate-12" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-[28px] border border-white/10 bg-[#120e1b]/96 p-5 shadow-2xl backdrop-blur-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Choose plan</h2>
              <button onClick={() => setShowUpgradeModal(false)} className="rounded-full px-3 py-1 text-sm text-white/70 hover:bg-white/6">
                Close
              </button>
            </div>

            <div className="grid gap-3">
              <button
                onClick={() => handleCheckout("monthly")}
                className="rounded-2xl border border-fuchsia-400/30 bg-white/7 px-4 py-4 text-left transition hover:bg-white/10"
              >
                <div className="text-[16px] font-semibold text-white">Monthly</div>
                <div className="mt-1 text-[13px] text-white/65">Open the monthly PayPal checkout</div>
              </button>

              <button
                onClick={() => handleCheckout("yearly")}
                className="rounded-2xl border border-violet-400/30 bg-white/7 px-4 py-4 text-left transition hover:bg-white/10"
              >
                <div className="text-[16px] font-semibold text-white">Yearly</div>
                <div className="mt-1 text-[13px] text-white/65">Open the yearly PayPal checkout</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
