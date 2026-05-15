"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  MoreHorizontal,
  Sparkles,
  Lock,
  Crown,
  Heart,
  Check,
} from "lucide-react";
import { useChatPage } from "@/hooks/useChatPage";

const DISPLAY_NAMES: Record<string, string> = {
  "free-1.jpg": "Morning Glow ☀️",
  "free-2.jpg": "Soft Calm 🌸",
  "aarvi1.jpg": "Late Night Talks 🌙",
  "aarvi2.jpg": "Dreamy Thoughts ✨",
  "aarvi3.jpg": "Coffee & Comfort ☕",
  "aarvi4.jpg": "Rainy Window 🌧️",
  "aarvi5.jpg": "Sunset Serenity 🌅",
  "aarvi6.jpg": "Focus & Growth 📖",
  "aarvi7.jpg": "City Lights 🌃",
  "aarvi8.jpg": "Good Night Peace 💤",
};

const DISPLAY_QUOTES: Record<string, string> = {
  "free-1.jpg": "A little sunshine, just for you.",
  "free-2.jpg": "Soft, calm, and easy to keep close.",
  "aarvi1.jpg": "Tonight, it’s just you and me.",
  "aarvi2.jpg": "Some people feel like home.",
  "aarvi3.jpg": "Take a break… I’m here for you.",
  "aarvi4.jpg": "Rain, silence, and deep conversations.",
  "aarvi5.jpg": "Every sunset brings a softer tomorrow.",
  "aarvi6.jpg": "I believe in your dreams.",
  "aarvi7.jpg": "Chasing dreams under neon skies.",
  "aarvi8.jpg": "Sleep peacefully… I’ll be here tomorrow.",
};

const PUBLIC_HERO_IMAGES = [
  "/chat-gallery/hero.jpg",
  "/chat-gallery/hero-2.jpg",
  "/chat-gallery/hero-3.jpg",
];

const PUBLIC_FREE_CARDS: GalleryCard[] = [
  {
    name: "free-1.jpg",
    isUnlocked: true,
    thumbUrl: "/chat-gallery/free-1.jpg",
    signedUrl: "/chat-gallery/free-1.jpg",
  },
  {
    name: "free-2.jpg",
    isUnlocked: true,
    thumbUrl: "/chat-gallery/free-2.jpg",
    signedUrl: "/chat-gallery/free-2.jpg",
  },
];

type GalleryCard = {
  name: string;
  isUnlocked: boolean;
  thumbUrl: string;
  signedUrl?: string | null;
};

export default function ChatGalleryPage(): React.JSX.Element {
  const router = useRouter();
  const chat = useChatPage();

  const cards = useMemo<GalleryCard[]>(() => {
    const bucketCards =
      chat.backgrounds.length > 0
        ? chat.backgrounds
        : chat.backgroundOptions.map((name) => ({
            name,
            isUnlocked: true,
            thumbUrl: `/${name}`,
            signedUrl: `/${name}`,
          }));

    return [...PUBLIC_FREE_CARDS, ...bucketCards];
  }, [chat.backgroundOptions, chat.backgrounds]);

  const unlockedCount = cards.filter((b) => b.isUnlocked).length;
  const totalCount = cards.length || 25;

  const heroImage = useMemo(() => {
    const now = new Date();
    return PUBLIC_HERO_IMAGES[now.getDate() % PUBLIC_HERO_IMAGES.length];
  }, []);

  const heroItem = useMemo(() => {
    const selected = cards.find(
      (b) => b.name === chat.selectedBackgroundFilename && b.isUnlocked
    );
    if (selected) return selected;

    const firstUnlocked = cards.find((b) => b.isUnlocked);
    if (firstUnlocked) return firstUnlocked;

    return cards[0] ?? null;
  }, [cards, chat.selectedBackgroundFilename]);

  const heroUrl =
    heroItem?.signedUrl ||
    heroItem?.thumbUrl ||
    heroImage ||
    chat.selectedBackground ||
    "/aarvi.jpg";

  const firstLocked = cards.find((b) => !b.isUnlocked);

  const openUnlock = () => {
    if (firstLocked) {
      chat.startCheckout(firstLocked.name);
      return;
    }
    chat.startCheckout("premium");
  };

  const selectAndReturn = (name: string, url?: string | null) => {
    chat.selectBackground(name, url);
    setTimeout(() => {
      router.back();
    }, 180);
  };

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#07040d] text-white">
      <style jsx global>{`
        @keyframes heartBeat {
          0%,
          100% {
            transform: scale(1);
          }
          12% {
            transform: scale(1.16);
          }
          24% {
            transform: scale(0.98);
          }
          36% {
            transform: scale(1.2);
          }
          60% {
            transform: scale(1);
          }
        }

        @keyframes slowSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .animate-heartBeat {
          animation: heartBeat 1.1s ease-in-out infinite;
        }

        .animate-slowSpin {
          animation: slowSpin 9s linear infinite;
        }
      `}</style>

      <div
        className="fixed inset-0 scale-110 bg-cover bg-center bg-no-repeat blur-[2px]"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(4,3,10,0.32), rgba(4,3,10,0.84)), url('${heroUrl}')`,
        }}
      />
      <div
        className="fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 14%, rgba(255,105,180,0.18), transparent 22%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.18), transparent 24%), radial-gradient(circle at 50% 70%, rgba(255,255,255,0.05), transparent 34%)",
        }}
      />
      <div
        className="fixed inset-0"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 120px 180px rgba(0,0,0,0.18), inset 0 -100px 160px rgba(0,0,0,0.35)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-black/25 backdrop-blur-xl transition hover:scale-105 hover:bg-black/35"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-black/25 backdrop-blur-xl transition hover:scale-105 hover:bg-black/35"
            aria-label="Menu"
          >
            <MoreHorizontal className="h-6 w-6" />
          </button>
        </div>

        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-white/6 shadow-[0_18px_70px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative min-h-[360px] p-6 sm:p-8 lg:p-10">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(8,6,14,0.20), rgba(8,6,14,0.74)), url('${heroUrl}')`,
                }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_18%,rgba(247,247,247,0.18),transparent_18%),radial-gradient(circle_at_70%_38%,rgba(160,90,255,0.16),transparent_22%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.35))]" />

              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="max-w-xl pt-4">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-black/20 px-3 py-1 text-[12px] text-white/80 backdrop-blur-xl">
                    <Sparkles className="h-3.5 w-3.5 text-pink-300" />
                    <span>Aarvi’s Private Moments</span>
                  </div>

                  <h1 className="text-[34px] font-semibold leading-[1.02] tracking-tight text-white sm:text-[46px]">
                    Aarvi’s
                    <br />
                    Private Moments <span className="text-violet-300">💜</span>
                  </h1>

                  <p className="mt-4 max-w-md text-[15px] leading-7 text-white/78 sm:text-[16px]">
                    Unlock exclusive memories
                    <br />
                    Just for <span className="text-pink-300">you</span>.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[13px] text-white/85 backdrop-blur-xl">
                    🖼️ {unlockedCount} / {totalCount} Unlocked
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[13px] text-white/85 backdrop-blur-xl">
                    🔒 Premium Exclusive
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[13px] text-white/85 backdrop-blur-xl">
                    👑 For Premium Users
                  </div>
                </div>
              </div>
            </div>

            <div className="relative hidden min-h-[360px] lg:block">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(8,6,14,0.05), rgba(8,6,14,0.46)), url('${heroUrl}')`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/20" />

              <div className="absolute right-6 top-6 rounded-full border border-pink-300/30 bg-black/20 px-4 py-2 text-[13px] text-white/80 backdrop-blur-xl">
                <span className="mr-2 text-pink-300">♥</span>
                Premium Exclusive
              </div>

              <div className="absolute bottom-6 left-6 right-6 rounded-[26px] border border-white/10 bg-black/18 px-4 py-3 backdrop-blur-xl">
                <div className="flex items-center justify-between text-white/90">
                  <span className="text-[14px]">Just for you</span>
                  <span className="text-pink-300">✦</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[30px] border border-white/10 bg-white/6 px-4 py-4 shadow-[0_14px_50px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:px-5">
          <div className="flex flex-wrap items-center gap-4 text-white/88">
            <div className="flex items-center gap-2">
              <span className="text-[18px]">🖼️</span>
              <span className="text-[14px]">
                {unlockedCount} / {totalCount} Unlocked
              </span>
            </div>
            <div className="hidden h-5 w-px bg-white/10 sm:block" />
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-pink-200" />
              <span className="text-[14px]">Premium Exclusive</span>
            </div>
            <div className="hidden h-5 w-px bg-white/10 sm:block" />
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-300" />
              <span className="text-[14px]">For Premium Users</span>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((it, index) => {
            const unlockedUrl =
              it.signedUrl ??
              (it.isUnlocked ? `/api/backgrounds/thumb?file=${encodeURIComponent(it.name)}` : null);

            const isSelected = chat.selectedBackgroundFilename === it.name;
            const isNew = index < 2 && it.isUnlocked;

            return (
              <div key={it.name} className="relative">
                <button
                  onContextMenu={(e) => {
                    if (!it.isUnlocked) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onClick={() => {
                    if (it.isUnlocked) {
                      selectAndReturn(it.name, unlockedUrl);
                    } else {
                      chat.startCheckout(it.name);
                    }
                  }}
                  className={`group relative w-full overflow-hidden rounded-[24px] border text-left shadow-[0_14px_40px_rgba(0,0,0,0.34)] transition-transform duration-300 hover:-translate-y-0.5 hover:scale-[1.01] ${
                    isSelected ? "border-pink-300/80" : "border-white/15"
                  }`}
                >
                  <div className="relative aspect-[0.82]">
                    <img
                      src={it.thumbUrl}
                      alt={it.name}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      className={`h-full w-full object-cover transition duration-300 ${
                        it.isUnlocked ? "scale-100" : "scale-110 blur-sm brightness-75"
                      }`}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/10 to-transparent" />

                    {isNew && (
                      <div className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
                        New
                      </div>
                    )}

                    {it.isUnlocked ? (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-gray-900 shadow">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full bg-black/20 p-5 backdrop-blur-xl">
                          <Lock className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-black/20 px-3 py-3 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-[14px] font-semibold text-white">
                          {DISPLAY_NAMES[it.name] || it.name.replace(/[-.]/g, " ")}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-white/70">
                          {DISPLAY_QUOTES[it.name] || "A private moment from Aarvi."}
                        </p>
                      </div>

                      <span className="shrink-0 text-[11px] text-white/60">
                        {it.isUnlocked ? "Unlocked" : "Premium"}
                      </span>
                    </div>
                  </div>
                </button>

                {!it.isUnlocked && (
                  <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/28 px-2 py-1 text-[11px] text-white/85 backdrop-blur-xl">
                    Locked
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-5 overflow-hidden rounded-[28px] border border-fuchsia-400/30 bg-white/7 shadow-[0_16px_50px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-black/20 shadow-inner">
                <div className="text-3xl">💎</div>
              </div>
              <div>
                <div className="text-[18px] font-semibold text-white">
                  Unlock all private moments
                </div>
                <div className="mt-1 max-w-lg text-[14px] leading-6 text-white/72">
                  Get unlimited access to Aarvi’s exclusive memories & special moments.
                </div>
              </div>
            </div>

            <button
              onClick={openUnlock}
              className="rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 px-6 py-4 text-[16px] font-semibold text-white shadow-[0_10px_24px_rgba(168,85,247,0.32)] transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Unlock for Premium ✨
            </button>
          </div>
        </section>

        <div className="pb-2 pt-4 text-center text-[13px] text-white/60">
          Premium is worth it… Because some moments are just for you. 💜
        </div>

        <div className="fixed bottom-4 right-4 z-20 animate-heartBeat rounded-full border border-pink-300/20 bg-pink-500/15 p-3 shadow-[0_10px_30px_rgba(236,72,153,0.26)] backdrop-blur-xl">
          <Heart className="h-5 w-5 fill-pink-300 text-pink-200" />
        </div>
      </div>
    </div>
  );
}