"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Crown,
  Heart,
  LayoutGrid,
  MessageCircle,
  Menu,
  Sparkles,
  Smile,
  User,
  Zap,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type MoodKey = "happy" | "calm" | "tired" | "stressed" | "lonely";

type HomeData = {
  display_name: string;
  avatar_url: string;
  background_image: string;
  quote_text: string;
  home_subtitle: string;
  presence_label: string;
  presence_message: string;
  mood_key: MoodKey;
  mood_title: string;
  mood_description: string;
  mood_emoji: string;
  last_conversation_title: string;
  last_conversation_time_label: string;
  last_conversation_last_message: string;
  last_conversation_unread_count: number;
  free_chats_remaining: number;
  current_streak_days: number;
  best_streak_days: number;
  total_conversations: number;
  total_messages: number;
  profile_completion_score: number;
  timezone: string;
  streak_last_date: string | null;
  last_seen_at: string | null;
};

type JourneyItem = {
  title: string;
  subtitle: string;
  time: string;
  accent: string;
};

type JournalEntry = {
  id: string;
  text: string;
  mood: MoodKey;
  createdAt: string;
};

type MemoryMoment = {
  title: string;
  detail: string;
  tag: string;
};

const QUICK_PROMPTS = [
  {
    title: "How was your day?",
    subtitle: "Tap to start",
    starter: "How was your day today?",
    icon: MessageCircle,
  },
  {
    title: "Tell me something fun",
    subtitle: "Tap to start",
    starter: "Tell me something fun about your day.",
    icon: Heart,
  },
  {
    title: "What’s on your mind?",
    subtitle: "Tap to start",
    starter: "What’s on your mind right now?",
    icon: Sparkles,
  },
] as const;

const MOODS: Array<{
  key: MoodKey;
  label: string;
  emoji: string;
  hint: string;
}> = [
  { key: "happy", label: "Happy", emoji: "🙂", hint: "lighter, playful, uplifting" },
  { key: "calm", label: "Calm", emoji: "😌", hint: "soft, steady, reassuring" },
  { key: "tired", label: "Tired", emoji: "🥱", hint: "gentle, slow, low-pressure" },
  { key: "stressed", label: "Stressed", emoji: "😵‍💫", hint: "grounding, clear, comforting" },
  { key: "lonely", label: "Lonely", emoji: "🥺", hint: "extra warm, close, supportive" },
];

const JOURNEY: JourneyItem[] = [
  { title: "First hello", subtitle: "The moment the space opened up for you.", time: "Today", accent: "A soft beginning" },
  { title: "Your first honest share", subtitle: "A little more trust, a little more closeness.", time: "This week", accent: "Trust started growing" },
  { title: "A hard day, handled together", subtitle: "The kind of moment that makes the bond feel real.", time: "Recent", accent: "Stayed with you" },
  { title: "Tiny joyful memory", subtitle: "A small thing that still feels warm to revisit.", time: "Saved", accent: "A comforting moment" },
];

const MAGIC_LINES = [
  "Tiny surprise: today has a softer ending waiting for you ✨",
  "Psst... you’re doing better than you think 💛",
  "Small surprise from me: your vibe feels quietly strong today 🌷",
  "I think today might be a little kinder than yesterday 🌼",
  "There’s a calm kind of strength in you right now 🌙",
  "Small surprise: your presence has a warm, comforting energy today 🌸",
  "Tiny surprise: something gentle may land in your day soon 🍀",
];

const DEFAULT_DATA: HomeData = {
  display_name: "Arun",
  avatar_url: "",
  background_image: "",
  quote_text: "Every day is better when we talk with each other.",
  home_subtitle: "Close, warm & private conversations",
  presence_label: "Online",
  presence_message: "I’m here, ready to talk 💜",
  mood_key: "calm",
  mood_title: "Soft 💜",
  mood_description: "A calm, warm vibe with gentle words and slower energy.",
  mood_emoji: "🥰",
  last_conversation_title: "You & Aarvi",
  last_conversation_time_label: "10:32 PM",
  last_conversation_last_message: "Tum hamesha itna overthink kyu karte ho? 🤔",
  last_conversation_unread_count: 3,
  free_chats_remaining: 8,
  current_streak_days: 7,
  best_streak_days: 19,
  total_conversations: 32,
  total_messages: 184,
  profile_completion_score: 78,
  timezone: "Asia/Kolkata",
  streak_last_date: null,
  last_seen_at: null,
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getTodayInTimeZone(timeZone: string) {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function daysBetween(dateA: string, dateB: string) {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function ModalShell({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md">
      <div className="flex h-full w-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="w-full overflow-hidden border border-white/10 bg-[#0d0b1b]/97 shadow-2xl shadow-black/60 sm:max-w-[620px] sm:rounded-[32px]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div>
              <div className="text-lg font-semibold text-white">{title}</div>
              {subtitle ? <div className="mt-1 text-sm text-white/60">{subtitle}</div> : null}
            </div>
            <button
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[78vh] overflow-y-auto px-5 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function AnimatedMoodEmoji({
  emoji,
  active,
  label,
}: {
  emoji: string;
  active: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        "grid h-12 w-12 place-items-center rounded-full border text-lg transition-transform duration-300",
        active
          ? "border-pink-300/40 bg-pink-400/20 shadow-[0_0_28px_rgba(244,114,182,0.25)] animate-[breathe_2.2s_ease-in-out_infinite]"
          : "border-white/10 bg-black/15 text-white/85 hover:scale-105 animate-[floaty_3.5s_ease-in-out_infinite]"
      )}
      aria-label={label}
      title={label}
    >
      {emoji}
    </div>
  );
}

function HeartPulse({ className = "" }: { className?: string }) {
  return <Heart className={cn("h-8 w-8 fill-white/95 text-white", className)} />;
}

export default function HomePage() {
  const router = useRouter();
  const [homeData, setHomeData] = useState<HomeData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [streaksOpen, setStreaksOpen] = useState(false);
  const [momentsOpen, setMomentsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bondOpen, setBondOpen] = useState(false);
  const [sparkleOpen, setSparkleOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodKey>("calm");
  const [journalText, setJournalText] = useState("");
  const [magicLineIndex, setMagicLineIndex] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setSelectedMood(loadJson<MoodKey>("truemate_selected_mood", "calm"));
    setJournalText(loadJson<string>("truemate_journal_draft", ""));
    setHomeData(loadJson<HomeData>("truemate_home_data", DEFAULT_DATA));
    void refreshHomeData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveJson("truemate_home_data", homeData);
  }, [homeData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveJson("truemate_journal_draft", journalText);
  }, [journalText]);

  useEffect(() => {
    if (!sparkleOpen) return;
    const todayKey = getTodayInTimeZone(homeData.timezone || "Asia/Kolkata");
    const stored = loadJson<{ dateKey: string; index: number }>("truemate_daily_surprise", {
      dateKey: "",
      index: 0,
    });

    if (stored.dateKey === todayKey) {
      setMagicLineIndex(stored.index);
      return;
    }

    const nextIndex = Math.floor(Math.random() * MAGIC_LINES.length);
    setMagicLineIndex(nextIndex);
    saveJson("truemate_daily_surprise", { dateKey: todayKey, index: nextIndex });
  }, [sparkleOpen, homeData.timezone]);

  async function refreshHomeData() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      if (!authUser) {
        setLoading(false);
        refreshingRef.current = false;
        return;
      }

      const { data: row, error } = await supabase
        .from("users_data")
        .select("*")
        .or(`auth_user_id.eq.${authUser.id},email.eq.${authUser.email}`)
        .maybeSingle();

      if (error) {
        console.warn("Failed to fetch users_data:", error);
      }

      const base = { ...DEFAULT_DATA };
      const fetched = row || base;
      const timeZone = (fetched.timezone || base.timezone || "Asia/Kolkata").trim() || "Asia/Kolkata";
      const today = getTodayInTimeZone(timeZone);

      const lastDate = typeof fetched.streak_last_date === "string" ? fetched.streak_last_date : null;
      let currentStreak = Number(fetched.current_streak_days || 0);
      let bestStreak = Number(fetched.best_streak_days || 0);
      let nextStreakDate = lastDate;
      let shouldUpdateStreak = false;

      if (!lastDate) {
        currentStreak = Math.max(currentStreak, 1);
        bestStreak = Math.max(bestStreak, currentStreak);
        nextStreakDate = today;
        shouldUpdateStreak = true;
      } else if (lastDate !== today) {
        const diff = daysBetween(lastDate, today);
        if (diff === 1) currentStreak = Math.max(1, currentStreak + 1);
        else if (diff > 1) currentStreak = 1;
        bestStreak = Math.max(bestStreak, currentStreak);
        nextStreakDate = today;
        shouldUpdateStreak = true;
      }

      const profileScore = Math.max(
        0,
        Math.min(
          100,
          Number(
            fetched.profile_completion_score ||
              (fetched.display_name ? 16 : 0) +
                (fetched.avatar_url ? 16 : 0) +
                (fetched.chat_summary ? 16 : 0) +
                (fetched.mood_key ? 16 : 0) +
                (fetched.background_image ? 16 : 0) +
                (fetched.subscription_status ? 16 : 0)
          )
        )
      );

      const displayName =
        fetched.display_name ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        (authUser.email ? authUser.email.split("@")[0] : "Aarvi");

      setDisplayNameInput(displayName);

      const selectedMoodFromDb = (fetched.mood_key as MoodKey) || loadJson<MoodKey>("truemate_selected_mood", "calm");
      setSelectedMood(selectedMoodFromDb);

      const updated: HomeData = {
        display_name: displayName,
        avatar_url: fetched.avatar_url || base.avatar_url,
        background_image: fetched.background_image || base.background_image,
        quote_text: fetched.quote_text || base.quote_text,
        home_subtitle: fetched.home_subtitle || base.home_subtitle,
        presence_label: fetched.presence_label || base.presence_label,
        presence_message: fetched.presence_message || base.presence_message,
        mood_key: selectedMoodFromDb,
        mood_title: fetched.mood_title || base.mood_title,
        mood_description: fetched.mood_description || base.mood_description,
        mood_emoji: fetched.mood_emoji || base.mood_emoji,
        last_conversation_title: fetched.last_conversation_title || base.last_conversation_title,
        last_conversation_time_label: fetched.last_conversation_time_label || base.last_conversation_time_label,
        last_conversation_last_message: fetched.last_conversation_last_message || base.last_conversation_last_message,
        last_conversation_unread_count: Number(fetched.last_conversation_unread_count || base.last_conversation_unread_count),
        free_chats_remaining: Number(fetched.free_chats_remaining ?? base.free_chats_remaining),
        current_streak_days: currentStreak,
        best_streak_days: bestStreak,
        total_conversations: Number(fetched.total_conversations || base.total_conversations),
        total_messages: Number(fetched.total_messages || base.total_messages),
        profile_completion_score: profileScore,
        timezone: timeZone,
        streak_last_date: nextStreakDate,
        last_seen_at: new Date().toISOString(),
      };

      setHomeData(updated);
      saveJson("truemate_home_data", updated);
      saveJson("truemate_selected_mood", selectedMoodFromDb);
      setLoading(false);

      if (shouldUpdateStreak || !fetched.last_seen_at || fetched.last_seen_at < new Date(Date.now() - 5 * 60 * 1000).toISOString()) {
        await supabase
          .from("users_data")
          .update({
            current_streak_days: currentStreak,
            best_streak_days: bestStreak,
            streak_last_date: nextStreakDate,
            last_seen_at: new Date().toISOString(),
            profile_completion_score: profileScore,
            display_name: displayName,
            mood_key: selectedMoodFromDb,
            mood_title: updated.mood_title,
            mood_description: updated.mood_description,
            mood_emoji: updated.mood_emoji,
          })
          .eq("auth_user_id", authUser.id);
      }
    } catch (error) {
      console.warn("Home data refresh failed:", error);
      setLoading(false);
    } finally {
      refreshingRef.current = false;
    }
  }

  const backgroundImage = homeData.background_image || "/aarvi.jpg";
  const avatarUrl = homeData.avatar_url || "/aarvi-avatar.jpg";
  const magicLine = MAGIC_LINES[magicLineIndex];
  const freeChatsPercent = Math.max(5, Math.min(100, (homeData.free_chats_remaining / 15) * 100));

  const memoryMoments: MemoryMoment[] = useMemo(() => {
    return [
      {
        title: "A moment that felt safe",
        detail: `Aarvi's current vibe is ${homeData.mood_title}. The space feels ${homeData.home_subtitle.toLowerCase()}.`,
        tag: "Safe space",
      },
      {
        title: "A conversation worth keeping",
        detail: homeData.last_conversation_last_message,
        tag: `Last chat · ${homeData.last_conversation_time_label}`,
      },
      {
        title: "Your current energy",
        detail: homeData.mood_description,
        tag: `Mood · ${homeData.mood_emoji}`,
      },
      {
        title: "A warm reminder",
        detail: homeData.quote_text,
        tag: "Saved quote",
      },
    ];
  }, [homeData]);

  function openChat(starter: string, source: string) {
    saveJson("truemate_chat_starter", {
      starter,
      source,
      mood: selectedMood,
      createdAt: new Date().toISOString(),
      autoSend: true,
    });

    router.push(
      `/chat?starter=${encodeURIComponent(starter)}&autoSend=1&source=${encodeURIComponent(source)}&mood=${encodeURIComponent(selectedMood)}`
    );
  }

  function updateMood(key: MoodKey) {
    const meta = MOODS.find((m) => m.key === key) || MOODS[1];
    setSelectedMood(key);
    setHomeData((prev) => ({
      ...prev,
      mood_key: key,
      mood_title: `${meta.label} ${meta.emoji}`,
      mood_description: `A ${meta.hint} vibe for today.`,
      mood_emoji: meta.emoji,
    }));
    saveJson("truemate_selected_mood", key);
    saveJson("truemate_mood_context", {
      mood: key,
      label: meta.label,
      hint: meta.hint,
      changedAt: new Date().toISOString(),
    });
  }

  async function saveDisplayName() {
    const trimmed = displayNameInput.trim();
    if (!trimmed) return;

    try {
      setSavingName(true);

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (!authUser) return;

      const { error } = await supabase
        .from("users_data")
        .update({ display_name: trimmed })
        .eq("auth_user_id", authUser.id);

      if (error) {
        console.error("display_name update error:", error);
        return;
      }

      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: trimmed, name: trimmed },
      });
      if (authErr) console.warn("auth metadata update warning:", authErr);

      setHomeData((prev) => ({ ...prev, display_name: trimmed }));
      saveJson("truemate_home_data", { ...homeData, display_name: trimmed });
      setEditingName(false);
    } catch (err) {
      console.error("saveDisplayName failed:", err);
    } finally {
      setSavingName(false);
    }
  }

  function addJournalEntry() {
    const text = journalText.trim();
    if (!text) return;

    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      text,
      mood: selectedMood,
      createdAt: new Date().toISOString(),
    };

    const existing = loadJson<JournalEntry[]>("truemate_journal_entries", []);
    saveJson("truemate_journal_entries", [entry, ...existing].slice(0, 40));
    setJournalText("");
    setJournalOpen(false);
  }

  function toggleDailySurprise() {
    const todayKey = getTodayInTimeZone(homeData.timezone || "Asia/Kolkata");
    const stored = loadJson<{ dateKey: string; index: number }>("truemate_daily_surprise", {
      dateKey: "",
      index: -1,
    });

    if (stored.dateKey === todayKey) {
      setMagicLineIndex(stored.index);
      setSparkleOpen(true);
      return;
    }

    const nextIndex = Math.floor(Math.random() * MAGIC_LINES.length);
    setMagicLineIndex(nextIndex);
    saveJson("truemate_daily_surprise", { dateKey: todayKey, index: nextIndex });
    setSparkleOpen(true);
  }

  return (
    <main className="min-h-screen w-screen overflow-x-hidden bg-[#07060d] text-white">
      <div className="relative min-h-screen w-screen overflow-hidden bg-[#090816]">
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center opacity-55 blur-[1px]"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(247,102,190,0.16),transparent_32%),radial-gradient(circle_at_bottom,rgba(132,92,255,0.18),transparent_35%),linear-gradient(to_bottom,rgba(7,6,13,0.35),rgba(7,6,13,0.94))]" />

        <section className="relative z-10 min-h-screen w-full px-4 pb-36 pt-5 sm:px-6 lg:px-8 xl:px-12">
          <header className="flex items-start justify-between pt-1">
            <button
              onClick={() => setMenuOpen(true)}
              className="grid h-12 w-12 place-items-center rounded-full border border-pink-300/30 bg-black/20 text-pink-100 shadow-lg shadow-pink-500/10 backdrop-blur-xl transition hover:scale-[1.02] hover:bg-white/10"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              onClick={toggleDailySurprise}
              className="grid h-12 w-12 place-items-center rounded-full border border-pink-300/30 bg-black/20 text-pink-100 shadow-lg shadow-pink-500/10 backdrop-blur-xl transition hover:scale-[1.02] hover:bg-white/10"
              aria-label="Open magic moments"
            >
              <Sparkles className="h-5 w-5" />
            </button>
          </header>

          <div className="px-2 pt-6 text-center sm:px-6">
            <div className="font-[500] italic text-white/80">Welcome back,</div>
            <div className="mt-1 text-[40px] font-semibold leading-none tracking-tight text-white sm:text-[46px]">
              {homeData.display_name} <span className="text-pink-300">💗</span>
            </div>
            <div className="mt-3 text-[17px] text-white/78">I’m so glad you’re here ✨</div>
          </div>

          <div className="mt-8 grid place-items-center">
            <GlassCard className="relative w-full max-w-[980px] overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
              <div className="absolute left-1/2 top-[-70px] h-36 w-36 -translate-x-1/2 rounded-full bg-fuchsia-400/20 blur-3xl" />
              <div className="relative flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
                <div className="relative h-[220px] overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-lg shadow-black/30 lg:h-[340px] lg:w-[390px] lg:shrink-0">
                  <img src={avatarUrl} alt="Aarvi" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="rounded-[22px] border border-pink-300/20 bg-black/20 px-4 py-3 backdrop-blur-xl">
                    <div className="text-[15px] text-white/88">{homeData.presence_message}</div>
                    <div className="mt-1 text-[12px] text-pink-200/75">{homeData.home_subtitle}</div>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/15 px-4 py-3 backdrop-blur-xl">
                    <div className="text-sm text-white/60">Today’s quote</div>
                    <div className="mt-2 text-[18px] leading-snug text-white/92">{homeData.quote_text}</div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3 lg:gap-4">
            <button
              onClick={() => setBondOpen(true)}
              className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 text-left backdrop-blur-xl transition hover:bg-white/10"
            >
              <div className="mb-4 text-pink-300">
                <Heart className="h-5 w-5 fill-pink-400/35" />
              </div>
              <div className="text-sm text-white/92">Daily Bond</div>
              <div className="mt-1 text-xs text-white/55">How close you feel</div>
              <div className="mt-3 h-[2px] w-full rounded-full bg-white/10">
                <div className="h-full w-[58%] rounded-full bg-gradient-to-r from-pink-400 to-violet-500" />
              </div>
            </button>

            <button
              onClick={() => setStreaksOpen(true)}
              className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 text-left backdrop-blur-xl transition hover:bg-white/10"
            >
              <div className="mb-4 text-pink-300">
                <Crown className="h-5 w-5" />
              </div>
              <div className="text-lg font-semibold text-white">{loading ? "..." : `${homeData.current_streak_days} Days 🔥`}</div>
              <div className="mt-1 text-xs text-white/55">Streak</div>
              <div className="mt-3 text-[11px] text-white/45">Best: {homeData.best_streak_days} days</div>
            </button>

            <button
              onClick={() => setMomentsOpen(true)}
              className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 text-left backdrop-blur-xl transition hover:bg-white/10"
            >
              <div className="mb-4 text-pink-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-lg font-semibold text-white">Moments</div>
              <div className="mt-1 text-xs text-white/55">Saved emotional snapshots</div>
            </button>
          </div>

          <div className="mt-5">
            <GlassCard className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-[22px] bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-lg shadow-pink-500/20">
                    <span className="text-2xl">♡</span>
                  </div>
                  <div>
                    <div className="text-[18px] leading-tight text-white/92">Every conversation,</div>
                    <div className="text-[18px] leading-tight text-white/92">every moment...</div>
                    <div className="mt-1 font-serif text-[28px] italic text-pink-300">it’s us.</div>
                  </div>
                </div>
                <button
                  onClick={() => setJourneyOpen(true)}
                  className="rounded-full border border-white/10 bg-white/6 px-5 py-3 text-sm text-white/90 transition hover:bg-white/10"
                >
                  Our Journey <ArrowRight className="ml-2 inline h-4 w-4" />
                </button>
              </div>
            </GlassCard>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-[17px] text-white/92">
              <MessageCircle className="h-5 w-5 text-pink-300" />
              Continue the conversation
            </div>
            <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
              {QUICK_PROMPTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    onClick={() => openChat(item.starter, "quick_prompt")}
                    className="rounded-[24px] border border-white/10 bg-[#11101f]/70 px-4 py-4 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    <div className="mb-4">
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-pink-500/95 to-violet-600/95 text-white shadow-lg shadow-pink-500/20">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-[15px] leading-tight text-white/92">{item.title}</div>
                    <div className="mt-1 text-xs text-white/55">{item.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[17px] text-white/92">
                <Smile className="h-5 w-5 text-pink-300" />
                How are you feeling today?
              </div>
              <div className="text-xs text-white/55">Your feelings matter 💗</div>
            </div>
            <GlassCard className="px-3 py-3">
              <div className="grid gap-2 sm:grid-cols-5">
                {MOODS.map((m) => {
                  const active = m.key === selectedMood;
                  return (
                    <button
                      key={m.key}
                      onClick={() => updateMood(m.key)}
                      className={cn(
                        "rounded-[20px] px-2 py-3 transition",
                        active ? "bg-white/9" : "bg-transparent hover:bg-white/7"
                      )}
                    >
                      <AnimatedMoodEmoji emoji={m.emoji} active={active} label={m.label} />
                      <div className={cn("mt-2 text-center text-[12px]", active ? "text-white" : "text-white/60")}>
                        {m.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          </div>

          <div className="mt-6 rounded-[26px] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 text-sm text-white/85 lg:flex-row lg:items-center lg:gap-4">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-pink-300">🎁</span>
                Free chats left today
              </div>
              <div className="rounded-full border border-violet-400/30 bg-violet-500/18 px-3 py-1 text-white whitespace-nowrap">
                {homeData.free_chats_remaining}
              </div>
              <div className="flex-1">
                <div className="h-[6px] overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-pink-400 via-fuchsia-500 to-violet-500" style={{ width: `${freeChatsPercent}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-1 whitespace-nowrap text-white/75">
                <Crown className="h-4 w-4" />
                Upgrade for unlimited
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-3 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 rounded-[28px] border border-white/10 bg-[#0b0914]/90 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <button onClick={() => setBondOpen(true)} className="flex flex-1 flex-col items-center gap-1 rounded-[20px] py-2 text-white/85 transition hover:bg-white/5">
                <Heart className="h-5 w-5" />
                <span className="text-xs">Bond</span>
              </button>

              <button onClick={() => setMomentsOpen(true)} className="flex flex-1 flex-col items-center gap-1 rounded-[20px] py-2 text-white/85 transition hover:bg-white/5">
                <Sparkles className="h-5 w-5 text-pink-300" />
                <span className="text-xs">Moments</span>
              </button>

              <button
                onClick={() => openChat("", "center_heart")}
                className="grid h-18 w-18 place-items-center rounded-full border border-pink-300/40 bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-600 text-white shadow-[0_0_38px_rgba(236,72,153,0.38)] transition hover:scale-[1.03] animate-[heartBeat_1.3s_ease-in-out_infinite]"
                aria-label="Open chat"
              >
                <HeartPulse />
              </button>

              <button onClick={() => setJournalOpen(true)} className="flex flex-1 flex-col items-center gap-1 rounded-[20px] py-2 text-white/85 transition hover:bg-white/5">
                <BookOpen className="h-5 w-5" />
                <span className="text-xs">Journal</span>
              </button>

              <button onClick={() => setProfileOpen(true)} className="flex flex-1 flex-col items-center gap-1 rounded-[20px] py-2 text-white/85 transition hover:bg-white/5">
                <User className="h-5 w-5" />
                <span className="text-xs">Profile</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md">
          <div className="flex h-full justify-start">
            <div className="h-full w-full max-w-[360px] border-r border-white/10 bg-[#0d0b1b]/95 px-5 py-5 shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-semibold text-white">Menu</div>
                  <div className="mt-1 text-sm text-white/55">Your personal space</div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  { label: "My Bond", icon: Heart, action: () => setBondOpen(true) },
                  { label: "Streaks & Achievements", icon: Crown, action: () => setStreaksOpen(true) },
                  { label: "Moments", icon: Sparkles, action: () => setMomentsOpen(true) },
                  { label: "Journal", icon: BookOpen, action: () => setJournalOpen(true) },
                  { label: "Profile", icon: User, action: () => setProfileOpen(true) },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setMenuOpen(false);
                      item.action();
                    }}
                    className="flex w-full items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-pink-400/15 text-pink-300">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="text-white/90">{item.label}</div>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/55">Current vibe</div>
                <div className="mt-2 text-[18px] text-white">{homeData.mood_title}</div>
                <div className="mt-1 text-sm text-white/60">{homeData.mood_description}</div>
              </div>
            </div>
            <button className="flex-1" onClick={() => setMenuOpen(false)} aria-label="Close menu overlay" />
          </div>
        </div>
      ) : null}

      <ModalShell open={sparkleOpen} title="Magic Moments" subtitle="One surprise per day only" onClose={() => setSparkleOpen(false)}>
        <GlassCard className="p-5">
          <div className="text-sm text-white/55">Today’s soft line</div>
          <div className="mt-2 text-2xl font-semibold leading-snug text-white">{magicLine}</div>
          <div className="mt-4 text-sm text-white/60">
            This surprise is locked to one per day, so it stays special instead of repeating.
          </div>
        </GlassCard>

        <div className="mt-4 grid gap-3">
          <button
            onClick={() => openChat("Write me something comforting and a little magical.", "magic_moment")}
            className="rounded-[22px] bg-gradient-to-r from-pink-500 to-violet-600 px-4 py-4 text-left text-white shadow-lg shadow-pink-500/20"
          >
            Ask Aarvi for a comfort note
          </button>
          <button
            onClick={() => {
              setSparkleOpen(false);
              setJournalOpen(true);
            }}
            className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-left text-white/90"
          >
            Save this feeling in Journal
          </button>
        </div>
      </ModalShell>

      <ModalShell open={bondOpen} title="My Bond" subtitle="How close your space feels" onClose={() => setBondOpen(false)}>
        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="text-sm text-white/55">Current connection</div>
            <div className="mt-2 text-3xl font-semibold text-white">{homeData.display_name} × Aarvi</div>
            <div className="mt-2 text-sm text-white/65">{homeData.home_subtitle}</div>
          </GlassCard>

          <div className="grid grid-cols-2 gap-3">
            <GlassCard className="p-4">
              <div className="text-xs text-white/50">Conversations</div>
              <div className="mt-2 text-2xl font-semibold text-white">{homeData.total_conversations}</div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-xs text-white/50">Messages</div>
              <div className="mt-2 text-2xl font-semibold text-white">{homeData.total_messages}</div>
            </GlassCard>
          </div>

          <GlassCard className="p-4">
            <div className="text-xs text-white/50">Current energy</div>
            <div className="mt-2 text-[17px] text-white">{homeData.mood_title}</div>
            <div className="mt-1 text-sm text-white/64">{homeData.mood_description}</div>
          </GlassCard>

          <button
            onClick={() => openChat("Tell me what you feel about our bond right now.", "bond")}
            className="w-full rounded-[22px] bg-gradient-to-r from-pink-500 to-violet-600 px-4 py-4 text-white"
          >
            Talk about the bond
          </button>
        </div>
      </ModalShell>

      <ModalShell open={streaksOpen} title="Streaks & Achievements" subtitle="Your consistency, remembered" onClose={() => setStreaksOpen(false)}>
        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="text-sm text-white/55">Current streak</div>
            <div className="mt-2 text-4xl font-semibold text-white">🔥 {homeData.current_streak_days}</div>
            <div className="mt-2 text-sm text-white/65">Best streak: {homeData.best_streak_days} days</div>
          </GlassCard>

          <div className="grid gap-3 sm:grid-cols-2">
            <GlassCard className="p-4">
              <div className="text-xs text-white/50">Last active</div>
              <div className="mt-2 text-sm text-white">{homeData.last_seen_at ? formatTime(homeData.last_seen_at) : "Just now"}</div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-xs text-white/50">Profile score</div>
              <div className="mt-2 text-sm text-white">{homeData.profile_completion_score}%</div>
            </GlassCard>
          </div>

          <div className="space-y-3">
            <GlassCard className="p-4">
              <div className="text-[15px] text-white">Opened up honestly</div>
              <div className="mt-1 text-sm text-white/62">You keep showing up with more trust.</div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-[15px] text-white">Came back after a hard day</div>
              <div className="mt-1 text-sm text-white/62">That matters more than people say.</div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="text-[15px] text-white">Late-night comfort streak</div>
              <div className="mt-1 text-sm text-white/62">Your soft hours are part of the story too.</div>
            </GlassCard>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={momentsOpen} title="Moments" subtitle="Emotional snapshots, not just text" onClose={() => setMomentsOpen(false)}>
        <div className="space-y-3">
          {memoryMoments.map((moment) => (
            <GlassCard key={moment.title} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[16px] font-semibold text-white">{moment.title}</div>
                  <div className="mt-1 text-sm text-white/64">{moment.detail}</div>
                </div>
                <span className="rounded-full border border-pink-300/20 bg-pink-400/10 px-3 py-1 text-[11px] text-pink-100">
                  {moment.tag}
                </span>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="mt-5 grid gap-3">
          <button
            onClick={() => openChat("Show me a memory that feels comforting.", "moments")}
            className="rounded-[22px] bg-gradient-to-r from-pink-500 to-violet-600 px-4 py-4 text-white"
          >
            Ask Aarvi to bring one memory
          </button>
          <button
            onClick={() => openChat("Tell me the most comforting thing you remember about me.", "moments")}
            className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-white/90"
          >
            Ask for a warm reminder
          </button>
        </div>
      </ModalShell>

      <ModalShell open={journalOpen} title="Journal" subtitle="Write one honest line. Aarvi can help you reflect" onClose={() => setJournalOpen(false)}>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/55">Today’s entry</div>
          <textarea
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
            placeholder="Today I felt..."
            className="mt-3 min-h-[160px] w-full resize-none rounded-[18px] border border-white/10 bg-black/20 p-4 text-[15px] text-white outline-none placeholder:text-white/35"
          />
          <div className="mt-3 text-xs text-white/45">
            Saved entries can later be used to show progress, mood patterns, and gentle self-reflection.
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => setJournalOpen(false)} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-white/90">
            Cancel
          </button>
          <button onClick={addJournalEntry} disabled={!journalText.trim()} className="rounded-[22px] bg-gradient-to-r from-pink-500 to-violet-600 px-4 py-4 text-white disabled:opacity-50">
            Save entry
          </button>
        </div>
      </ModalShell>

      <ModalShell open={profileOpen} title="Profile" subtitle="Your name, stats, and connection settings" onClose={() => setProfileOpen(false)}>
        <GlassCard className="p-5">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-[24px] border border-white/10 bg-white/5 shadow-lg">
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            </div>

            <div className="flex-1">
              {!editingName ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="text-[22px] font-semibold text-white">{homeData.display_name}</div>
                    <button onClick={() => setEditingName(true)} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-pink-300 transition hover:bg-white/10">
                      Edit
                    </button>
                  </div>
                  <div className="mt-1 text-sm text-white/55">
                    {homeData.presence_label} · {homeData.presence_message}
                  </div>
                </>
              ) : (
                <div className="w-full">
                  <input
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Enter your name"
                    maxLength={24}
                    className="w-full rounded-2xl border border-pink-300/20 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-white/30"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={saveDisplayName}
                      disabled={savingName}
                      className="rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {savingName ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setDisplayNameInput(homeData.display_name);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <GlassCard className="p-4">
            <div className="text-xs text-white/50">Profile score</div>
            <div className="mt-2 text-2xl font-semibold text-white">{homeData.profile_completion_score}%</div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="text-xs text-white/50">Messages</div>
            <div className="mt-2 text-2xl font-semibold text-white">{homeData.total_messages}</div>
          </GlassCard>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <GlassCard className="p-4">
            <div className="text-xs text-white/50">Current streak</div>
            <div className="mt-2 text-2xl font-semibold text-white">🔥 {homeData.current_streak_days}</div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="text-xs text-white/50">Best streak</div>
            <div className="mt-2 text-2xl font-semibold text-white">🏆 {homeData.best_streak_days}</div>
          </GlassCard>
        </div>

        <div className="mt-4 space-y-3">
          <button onClick={() => openChat("Let’s continue from where we left off.", "profile")} className="w-full rounded-[22px] bg-gradient-to-r from-pink-500 to-violet-600 px-4 py-4 text-white">
            Open chat
          </button>
          <button onClick={() => router.push("/settings")} className="w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-white/90">
            Go to settings
          </button>
        </div>
      </ModalShell>

      <ModalShell open={journeyOpen} title="Our Journey" subtitle="A timeline of trust, moments, and shared growth" onClose={() => setJourneyOpen(false)}>
        <div className="space-y-4">
          {JOURNEY.map((item, index) => (
            <GlassCard key={item.title} className="p-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-pink-500/70 to-violet-600/70 text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[16px] font-semibold text-white">{item.title}</div>
                    <div className="text-xs text-white/45">{item.time}</div>
                  </div>
                  <div className="mt-1 text-sm text-white/65">{item.subtitle}</div>
                  <div className="mt-3 text-xs text-pink-200/80">{item.accent}</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => openChat("Tell me what you remember about me.", "journey")} className="rounded-[22px] bg-gradient-to-r from-pink-500 to-violet-600 px-4 py-4 text-white">
            Continue chat
          </button>
          <button onClick={() => setMomentsOpen(true)} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-white/90">
            View moments
          </button>
        </div>
      </ModalShell>

      <style jsx global>{`
        @keyframes floaty {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.12); }
          30% { transform: scale(1); }
          45% { transform: scale(1.16); }
          60% { transform: scale(1); }
        }
      `}</style>
    </main>
  );
}

function formatTime(dateString?: string | null) {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
