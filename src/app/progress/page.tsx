"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Flame,
  Heart,
  Loader2,
  MessageCircle,
  Shield,
  Sparkles,
  Trophy,
  Zap,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type UserRow = {
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  chat_summary: string | null;
  achievements: unknown[] | null;
  easter_eggs: unknown[] | null;
  created_at: string | null;
  updated_at: string | null;
  chat: unknown[] | null;
  timezone: string | null;
  proactive_enabled: boolean | null;
  preferred_channel: string | null;
  unlocked_backgrounds: string[] | null;
  background_image: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  free_chats_remaining: number | null;
  ai_summary: unknown[] | null;
  merged_memory: string | null;
  subconscious_summary: string | null;
  subconscious_meta: Record<string, unknown> | null;
  total_conversations: number | null;
  total_user_messages: number | null;
  total_ai_messages: number | null;
  total_messages: number | null;
  current_streak_days: number | null;
  best_streak_days: number | null;
  streak_last_date: string | null;
  last_message_at: string | null;
  last_chat_at: string | null;
  last_seen_at: string | null;
  profile_completion_score: number | null;
  profile_completed_at: string | null;
};

export default function ProgressPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [filter, setFilter] = useState<"week" | "month" | "all">("month");
  const [row, setRow] = useState<UserRow | null>(null);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setErrorMsg("");

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/signin");
        return;
      }

      const email = authData.user.email;
      if (!email) {
        setErrorMsg("No email found in session.");
        setLoading(false);
        return;
      }

      let { data, error } = await supabase
        .from("users_data")
        .select("*")
        .eq("email", email)
        .maybeSingle<UserRow>();

      if (error) {
        setErrorMsg(error.message || "Failed to load progress data.");
        setLoading(false);
        return;
      }

      if (!data) {
        const inserted = await supabase
          .from("users_data")
          .upsert({ email }, { onConflict: "email" })
          .select("*")
          .maybeSingle<UserRow>();

        if (inserted.error || !inserted.data) {
          setErrorMsg(inserted.error?.message || "Could not create users_data row.");
          setLoading(false);
          return;
        }

        data = inserted.data;
      }

      setRow(data);
      setLoading(false);
    };

    boot();
  }, [router]);

  const metrics = useMemo(() => {
    const totalUserMessages = row?.total_user_messages ?? 0;
    const totalAiMessages = row?.total_ai_messages ?? 0;
    const totalMessages = row?.total_messages ?? totalUserMessages + totalAiMessages;
    const conversations = row?.total_conversations ?? 0;
    const currentStreak = row?.current_streak_days ?? 0;
    const bestStreak = row?.best_streak_days ?? 0;
    const completion = row?.profile_completion_score ?? 0;
    const freeChats = row?.free_chats_remaining ?? 0;

    return [
      {
        title: "Conversation streak",
        value: `${currentStreak} day${currentStreak === 1 ? "" : "s"}`,
        desc: `Best streak: ${bestStreak} day${bestStreak === 1 ? "" : "s"}.`,
        icon: <Flame className="h-5 w-5" />,
      },
      {
        title: "Chat conversations",
        value: String(conversations),
        desc: "Direct counter from backend.",
        icon: <MessageCircle className="h-5 w-5" />,
      },
      {
        title: "Total messages",
        value: String(totalMessages),
        desc: `${totalUserMessages} user • ${totalAiMessages} AI`,
        icon: <Zap className="h-5 w-5" />,
      },
      {
        title: "Profile completeness",
        value: `${completion}%`,
        desc: "Stored as a backend score.",
        icon: <BarChart3 className="h-5 w-5" />,
      },
    ] as const;
  }, [row]);

  const milestones = useMemo(() => {
    const currentStreak = row?.current_streak_days ?? 0;
    const totalConversations = row?.total_conversations ?? 0;
    const completion = row?.profile_completion_score ?? 0;
    const totalMessages = row?.total_messages ?? 0;

    return [
      {
        title: "First conversation",
        sub: "You started saving chat progress.",
        done: totalConversations > 0 || totalMessages > 0,
      },
      {
        title: "7-day streak",
        sub: "Consistency over one full week.",
        done: currentStreak >= 7,
      },
      {
        title: "20 conversations",
        sub: "Regular usage unlocked.",
        done: totalConversations >= 20,
      },
      {
        title: "Complete profile",
        sub: "All key profile fields are filled.",
        done: completion >= 100,
      },
    ];
  }, [row]);

  const bars = useMemo(() => {
    const chatConsistency = Math.min(100, (row?.total_messages ?? 0) * 2);
    const moodBalance = Math.min(100, ((row?.achievements?.length ?? 0) * 8) + 20);
    const profile = row?.profile_completion_score ?? 0;
    const exploration = Math.min(100, (row?.best_streak_days ?? 0) * 10);

    return [
      { label: "Chat consistency", value: chatConsistency },
      { label: "Mood balance", value: moodBalance },
      { label: "Profile completeness", value: profile },
      { label: "Feature exploration", value: exploration },
    ];
  }, [row]);

  const recentText = useMemo(() => {
    const t = row?.last_message_at || row?.last_chat_at || row?.last_seen_at;
    if (!t) return "No activity yet";

    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return "No activity yet";

    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;

    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  }, [row]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#090812] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(255,92,160,0.18),transparent_18%),radial-gradient(circle_at_82%_20%,rgba(161,88,255,0.12),transparent_20%),linear-gradient(180deg,#0d0c18_0%,#07060c_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.24] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto min-h-dvh w-full max-w-[1200px] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="rounded-[2.3rem] border border-white/10 bg-white/5 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
            <button
              onClick={() => router.back()}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="text-center">
              <p className="text-xs tracking-[0.22em] text-[#ff5aa6]">PROGRESS</p>
              <h1 className="text-lg font-semibold sm:text-xl">Your journey</h1>
            </div>

            <button
              onClick={() => router.push("/home")}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
              aria-label="Go home"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
          </div>

          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
            <section className="space-y-6">
              {loading ? (
                <div className="rounded-[2rem] border border-white/10 bg-black/20 p-8">
                  <div className="flex items-center gap-3 text-white/75">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading real progress data...
                  </div>
                </div>
              ) : errorMsg ? (
                <div className="rounded-[2rem] border border-red-500/20 bg-red-500/10 p-5 text-red-100">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5" />
                    <div>
                      <p className="font-medium">Could not load progress</p>
                      <p className="mt-1 text-sm text-red-100/75">{errorMsg}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {metrics.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-[1.8rem] border border-white/10 bg-black/20 p-5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ff5aa6]/35 bg-white/5 text-[#ff5aa6]">
                            {item.icon}
                          </div>
                          <span className="text-sm text-white/50">Live</span>
                        </div>
                        <p className="mt-4 text-sm text-white/60">{item.title}</p>
                        <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                        <p className="mt-2 text-sm leading-6 text-white/65">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm tracking-[0.18em] text-[#ff5aa6]">ANALYTICS</p>
                        <h2 className="mt-1 text-xl font-semibold">Engagement trend</h2>
                      </div>

                      <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
                        {(["week", "month", "all"] as const).map((item) => (
                          <button
                            key={item}
                            onClick={() => setFilter(item)}
                            className={`rounded-full px-4 py-2 text-sm transition ${
                              filter === item
                                ? "bg-[#ff5aa6] text-white"
                                : "text-white/70 hover:text-white"
                            }`}
                          >
                            {item === "week" ? "Week" : item === "month" ? "Month" : "All"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-white/55">
                      Last activity: {recentText}
                    </div>

                    <div className="mt-5 space-y-4">
                      {bars.map((bar) => (
                        <div key={bar.label}>
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-white/75">{bar.label}</span>
                            <span className="text-white/55">{bar.value}%</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-white/8">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${bar.value}%` }}
                              transition={{ duration: 0.9, ease: "easeOut" }}
                              className="h-full rounded-full bg-[linear-gradient(90deg,#ff4f7b_0%,#cf2fff_100%)]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#ff5aa6]/35 bg-white/5 text-[#ff5aa6]">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">Backend snapshot</p>
                          <p className="mt-1 text-sm leading-6 text-white/65">
                            Email: {row?.email || "-"}
                            <br />
                            Free chats remaining: {row?.free_chats_remaining ?? 0}
                            <br />
                            Current streak: {row?.current_streak_days ?? 0}
                            <br />
                            Best streak: {row?.best_streak_days ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm tracking-[0.18em] text-[#ff5aa6]">ACTIVITY</p>
                        <h2 className="mt-1 text-xl font-semibold">Recent moments</h2>
                      </div>
                      <MessageCircle className="h-6 w-6 text-white/60" />
                    </div>

                    <div className="mt-5 space-y-3">
                      <RecentRow
                        icon={<Sparkles className="h-5 w-5" />}
                        title="users_data row loaded"
                        time="Now"
                      />
                      <RecentRow
                        icon={<Zap className="h-5 w-5" />}
                        title={`Total messages: ${row?.total_messages ?? 0}`}
                        time="Now"
                      />
                      <RecentRow
                        icon={<Flame className="h-5 w-5" />}
                        title={`Streak: ${row?.current_streak_days ?? 0} day(s)`}
                        time="Now"
                      />
                      <RecentRow
                        icon={<Trophy className="h-5 w-5" />}
                        title={`Profile score: ${row?.profile_completion_score ?? 0}%`}
                        time="Now"
                      />
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm tracking-[0.18em] text-[#ff5aa6]">MILESTONES</p>
                    <h2 className="mt-1 text-xl font-semibold">Unlocked journey</h2>
                  </div>
                  <Trophy className="h-6 w-6 text-white/60" />
                </div>

                <div className="mt-5 space-y-3">
                  {milestones.map((item) => (
                    <div
                      key={item.title}
                      className="flex items-start gap-3 rounded-[1.35rem] border border-white/10 bg-white/5 p-4"
                    >
                      <div
                        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border ${
                          item.done
                            ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                            : "border-white/10 bg-white/5 text-white/40"
                        }`}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${item.done ? "text-white" : "text-white/70"}`}>
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm text-white/58">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm tracking-[0.18em] text-[#ff5aa6]">NEXT STEP</p>
                    <h2 className="mt-1 text-xl font-semibold">What to do now</h2>
                  </div>
                  <Sparkles className="h-6 w-6 text-white/60" />
                </div>

                <div className="mt-5 grid gap-3">
                  <button
                    onClick={() => router.push("/chat")}
                    className="flex items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-left transition-transform hover:-translate-y-[1px]"
                  >
                    <div>
                      <p className="font-medium">Continue chatting</p>
                      <p className="text-sm text-white/60">Keep the streak alive</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/45" />
                  </button>

                  <button
                    onClick={() => router.push("/profile")}
                    className="flex items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-left transition-transform hover:-translate-y-[1px]"
                  >
                    <div>
                      <p className="font-medium">Update profile</p>
                      <p className="text-sm text-white/60">Keep your identity fresh</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/45" />
                  </button>

                  <button
                    onClick={() => router.push("/home")}
                    className="flex items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-left transition-transform hover:-translate-y-[1px]"
                  >
                    <div>
                      <p className="font-medium">Back to home</p>
                      <p className="text-sm text-white/60">Return to dashboard</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/45" />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function RecentRow({
  icon,
  title,
  time,
}: {
  icon: React.ReactNode;
  title: string;
  time: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#ff5aa6]/35 bg-white/5 text-[#ff5aa6]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-white/55">{time}</p>
      </div>
    </div>
  );
}