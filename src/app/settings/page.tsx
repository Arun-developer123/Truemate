"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Crown,
  LogOut,
  MoonStar,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  User,
  Volume2,
  WandSparkles,
  MessageCircle,
  ImagePlus,
  CircleUserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type MoodKey = "happy" | "calm" | "tired" | "stressed" | "lonely";

type ChannelKey = "inapp" | "email" | "push";

type SettingsRow = {
  id?: string;
  email?: string | null;
  auth_user_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  background_image?: string | null;
  home_subtitle?: string | null;
  presence_label?: string | null;
  presence_message?: string | null;
  quote_text?: string | null;
  mood_key?: MoodKey | null;
  mood_title?: string | null;
  mood_description?: string | null;
  mood_emoji?: string | null;
  proactive_enabled?: boolean | null;
  preferred_channel?: ChannelKey | null;
  sound_enabled?: boolean | null;
  free_chats_remaining?: number | null;
  current_streak_days?: number | null;
  best_streak_days?: number | null;
  profile_completion_score?: number | null;
  timezone?: string | null;
};

const MOODS: Array<{
  key: MoodKey;
  title: string;
  emoji: string;
  description: string;
}> = [
  { key: "calm", title: "Soft", emoji: "🥰", description: "Warm, steady, comforting" },
  { key: "happy", title: "Happy", emoji: "🙂", description: "Lighter, brighter, playful" },
  { key: "tired", title: "Tired", emoji: "🥱", description: "Low pressure, gentle replies" },
  { key: "stressed", title: "Stressed", emoji: "😵‍💫", description: "Grounding, clear, supportive" },
  { key: "lonely", title: "Lonely", emoji: "🥺", description: "Extra close, soft, reassuring" },
];

const CHANNELS: Array<{
  key: ChannelKey;
  title: string;
  hint: string;
}> = [
  { key: "inapp", title: "In-app", hint: "Best for real-time home chat" },
  { key: "email", title: "Email", hint: "Send nudges to email" },
  { key: "push", title: "Push", hint: "Use browser / PWA notifications" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function Pill({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs",
        active ? "border-pink-300/30 bg-pink-400/15 text-pink-100" : "border-white/10 bg-white/5 text-white/65"
      )}
    >
      {children}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[28px] border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.25)]", className)}>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [authUserId, setAuthUserId] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [backgroundImage, setBackgroundImage] = useState("");
  const [homeSubtitle, setHomeSubtitle] = useState("");
  const [presenceMessage, setPresenceMessage] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [moodKey, setMoodKey] = useState<MoodKey>("calm");
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [preferredChannel, setPreferredChannel] = useState<ChannelKey>("inapp");

  const [freeChatsRemaining, setFreeChatsRemaining] = useState<number>(0);
  const [currentStreakDays, setCurrentStreakDays] = useState<number>(0);
  const [bestStreakDays, setBestStreakDays] = useState<number>(0);
  const [profileScore, setProfileScore] = useState<number>(0);
  const [timezone, setTimezone] = useState<string>("Asia/Kolkata");

  const selectedMood = useMemo(() => MOODS.find((m) => m.key === moodKey) || MOODS[0], [moodKey]);
  const selectedChannel = useMemo(() => CHANNELS.find((c) => c.key === preferredChannel) || CHANNELS[0], [preferredChannel]);

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      setMessage("");

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      if (!authUser) {
        router.replace("/sign-in");
        return;
      }

      setUserEmail(authUser.email || "");
      setAuthUserId(authUser.id || "");

      const { data: row, error } = await supabase
        .from("users_data")
        .select("*")
        .or(`auth_user_id.eq.${authUser.id},email.eq.${authUser.email}`)
        .maybeSingle();

      if (error) {
        console.warn("settings fetch error:", error);
      }

      const localMood = loadJson<MoodKey>("truemate_selected_mood", "calm");
      const localHome = loadJson<any>("truemate_home_data", null);

      const data: SettingsRow = row || {};
      const display = data.display_name || localHome?.display_name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Friend";

      const resolvedMood = (data.mood_key || localMood || "calm") as MoodKey;

      setDisplayName(display);
      setAvatarUrl(data.avatar_url || localHome?.avatar_url || "");
      setBackgroundImage(data.background_image || localHome?.background_image || "");
      setHomeSubtitle(data.home_subtitle || localHome?.home_subtitle || "Close, warm & private conversations");
      setPresenceMessage(data.presence_message || localHome?.presence_message || "I’m here, ready to talk 💜");
      setQuoteText(data.quote_text || localHome?.quote_text || "Every day is better when we talk with each other.");
      setMoodKey(resolvedMood);
      setProactiveEnabled(Boolean(data.proactive_enabled ?? true));
      setSoundEnabled(Boolean(data.sound_enabled ?? true));
      setPreferredChannel((data.preferred_channel as ChannelKey) || "inapp");
      setFreeChatsRemaining(Number(data.free_chats_remaining ?? 0));
      setCurrentStreakDays(Number(data.current_streak_days ?? 0));
      setBestStreakDays(Number(data.best_streak_days ?? 0));
      setProfileScore(Number(data.profile_completion_score ?? 0));
      setTimezone(data.timezone || "Asia/Kolkata");

      saveJson("truemate_selected_mood", resolvedMood);
      saveJson("truemate_home_data", {
        ...(localHome || {}),
        display_name: display,
        avatar_url: data.avatar_url || localHome?.avatar_url || "",
        background_image: data.background_image || localHome?.background_image || "",
        home_subtitle: data.home_subtitle || localHome?.home_subtitle || "Close, warm & private conversations",
        presence_message: data.presence_message || localHome?.presence_message || "I’m here, ready to talk 💜",
        quote_text: data.quote_text || localHome?.quote_text || "Every day is better when we talk with each other.",
        mood_key: resolvedMood,
        mood_title: data.mood_title || selectedMood.title,
        mood_description: data.mood_description || selectedMood.description,
        mood_emoji: data.mood_emoji || selectedMood.emoji,
        free_chats_remaining: Number(data.free_chats_remaining ?? localHome?.free_chats_remaining ?? 0),
        current_streak_days: Number(data.current_streak_days ?? localHome?.current_streak_days ?? 0),
        best_streak_days: Number(data.best_streak_days ?? localHome?.best_streak_days ?? 0),
        profile_completion_score: Number(data.profile_completion_score ?? localHome?.profile_completion_score ?? 0),
        timezone: data.timezone || localHome?.timezone || "Asia/Kolkata",
      });
    } catch (err) {
      console.error(err);
      setMessage("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setMessage("");

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      if (!authUser) {
        router.replace("/auth/sign-in");
        return;
      }

      const mood = MOODS.find((m) => m.key === moodKey) || MOODS[0];
      const payload = {
        display_name: displayName.trim(),
        avatar_url: avatarUrl.trim(),
        background_image: backgroundImage.trim(),
        home_subtitle: homeSubtitle.trim(),
        presence_message: presenceMessage.trim(),
        quote_text: quoteText.trim(),
        mood_key: mood.key,
        mood_title: `${mood.title} ${mood.emoji}`,
        mood_description: mood.description,
        mood_emoji: mood.emoji,
        proactive_enabled: proactiveEnabled,
        preferred_channel: preferredChannel,
        sound_enabled: soundEnabled,
        timezone,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("users_data")
        .upsert(
          {
            auth_user_id: authUser.id,
            email: authUser.email,
            ...payload,
          },
          { onConflict: "auth_user_id" }
        );

      if (error) {
        console.error("settings save error:", error);
        setMessage("Save failed. Check Supabase columns / RLS.");
        return;
      }

      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: displayName.trim(), name: displayName.trim() },
      });
      if (authErr) console.warn("auth metadata update warning:", authErr);

      saveJson("truemate_selected_mood", mood.key);
      saveJson("truemate_mood_context", {
        mood: mood.key,
        label: mood.title,
        hint: mood.description,
        changedAt: new Date().toISOString(),
      });
      saveJson("truemate_home_data", {
        ...loadJson<any>("truemate_home_data", {}),
        display_name: displayName.trim(),
        avatar_url: avatarUrl.trim(),
        background_image: backgroundImage.trim(),
        home_subtitle: homeSubtitle.trim(),
        presence_message: presenceMessage.trim(),
        quote_text: quoteText.trim(),
        mood_key: mood.key,
        mood_title: `${mood.title} ${mood.emoji}`,
        mood_description: mood.description,
        mood_emoji: mood.emoji,
        free_chats_remaining: freeChatsRemaining,
        current_streak_days: currentStreakDays,
        best_streak_days: bestStreakDays,
        profile_completion_score: profileScore,
        timezone,
      });

      setMessage("Saved successfully.");
    } catch (err) {
      console.error(err);
      setMessage("Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/sign-in");
  }

  function resetToDefault() {
    setDisplayName(displayName || "Friend");
    setAvatarUrl("");
    setBackgroundImage("");
    setHomeSubtitle("Close, warm & private conversations");
    setPresenceMessage("I’m here, ready to talk 💜");
    setQuoteText("Every day is better when we talk with each other.");
    setMoodKey("calm");
    setProactiveEnabled(true);
    setPreferredChannel("inapp");
    setSoundEnabled(true);
    setMessage("Reset locally. Press Save to store it in Supabase.");
  }

  return (
    <main className="min-h-screen w-full bg-[#07060d] text-white">
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(247,102,190,0.16),transparent_32%),radial-gradient(circle_at_bottom,rgba(132,92,255,0.18),transparent_35%),linear-gradient(to_bottom,rgba(7,6,13,0.35),rgba(7,6,13,0.96))]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />

        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 pb-10 pt-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => router.back()}
              className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl transition hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-white/70">
              <Shield className="h-4 w-4" />
              Settings
            </div>

            <button
              onClick={loadSettings}
              className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl transition hover:bg-white/10"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <Card className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-semibold text-white">Your profile & vibe</div>
                  <div className="mt-1 text-sm text-white/60">Edit what the home screen and chat personality show.</div>
                </div>
                <Pill active>{selectedMood.title} {selectedMood.emoji}</Pill>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm text-white/70">Display name</label>
                  <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3">
                    <CircleUserRound className="h-5 w-5 text-pink-300" />
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-transparent outline-none placeholder:text-white/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/70">Avatar URL</label>
                  <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3">
                    <ImagePlus className="h-5 w-5 text-pink-300" />
                    <input
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-transparent outline-none placeholder:text-white/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/70">Background image URL</label>
                  <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3">
                    <ImagePlus className="h-5 w-5 text-pink-300" />
                    <input
                      value={backgroundImage}
                      onChange={(e) => setBackgroundImage(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-transparent outline-none placeholder:text-white/30"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm text-white/70">Home subtitle</label>
                  <input
                    value={homeSubtitle}
                    onChange={(e) => setHomeSubtitle(e.target.value)}
                    className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-white/30"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm text-white/70">Presence message</label>
                  <input
                    value={presenceMessage}
                    onChange={(e) => setPresenceMessage(e.target.value)}
                    className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-white/30"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm text-white/70">Quote text</label>
                  <textarea
                    value={quoteText}
                    onChange={(e) => setQuoteText(e.target.value)}
                    className="min-h-[110px] w-full resize-none rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-white/30"
                  />
                </div>
              </div>
            </Card>

            <div className="grid gap-6">
              <Card className="p-5 sm:p-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Sparkles className="h-5 w-5 text-pink-300" />
                  Mood
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {MOODS.map((m) => {
                    const active = m.key === moodKey;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setMoodKey(m.key)}
                        className={cn(
                          "rounded-[22px] border px-4 py-4 text-left transition",
                          active ? "border-pink-300/30 bg-pink-400/15" : "border-white/10 bg-white/5 hover:bg-white/10"
                        )}
                      >
                        <div className="text-2xl">{m.emoji}</div>
                        <div className="mt-2 text-sm text-white">{m.title}</div>
                        <div className="mt-1 text-xs text-white/55">{m.description}</div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-5 sm:p-6">
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Bell className="h-5 w-5 text-pink-300" />
                  Behaviour
                </div>
                <div className="mt-4 space-y-3">
                  <button
                    onClick={() => setProactiveEnabled((v) => !v)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[22px] border px-4 py-4 text-left transition",
                      proactiveEnabled ? "border-pink-300/30 bg-pink-400/15" : "border-white/10 bg-white/5"
                    )}
                  >
                    <div>
                      <div className="font-medium text-white">Proactive reminders</div>
                      <div className="text-xs text-white/55">Let Aarvi nudge the user with gentle messages.</div>
                    </div>
                    <Pill active={proactiveEnabled}>{proactiveEnabled ? "On" : "Off"}</Pill>
                  </button>

                  <button
                    onClick={() => setSoundEnabled((v) => !v)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[22px] border px-4 py-4 text-left transition",
                      soundEnabled ? "border-pink-300/30 bg-pink-400/15" : "border-white/10 bg-white/5"
                    )}
                  >
                    <div>
                      <div className="font-medium text-white">Sound / effects</div>
                      <div className="text-xs text-white/55">Enable soft UI sound feedback.</div>
                    </div>
                    <Pill active={soundEnabled}>{soundEnabled ? "On" : "Off"}</Pill>
                  </button>
                </div>
              </Card>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2 text-lg font-semibold text-white">
                <MessageCircle className="h-5 w-5 text-pink-300" />
                Notification channel
              </div>
              <div className="mt-4 space-y-3">
                {CHANNELS.map((c) => {
                  const active = c.key === preferredChannel;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setPreferredChannel(c.key)}
                      className={cn(
                        "w-full rounded-[22px] border px-4 py-4 text-left transition",
                        active ? "border-pink-300/30 bg-pink-400/15" : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-white">{c.title}</div>
                          <div className="mt-1 text-xs text-white/55">{c.hint}</div>
                        </div>
                        <Pill active={active}>{active ? "Selected" : "Choose"}</Pill>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2 text-lg font-semibold text-white">
                <WandSparkles className="h-5 w-5 text-pink-300" />
                Account snapshot
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Email</div>
                  <div className="mt-1 break-all text-sm text-white">{userEmail || "—"}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Timezone</div>
                  <div className="mt-1 text-sm text-white">{timezone}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Free chats</div>
                  <div className="mt-1 text-sm text-white">{freeChatsRemaining}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Profile score</div>
                  <div className="mt-1 text-sm text-white">{profileScore}%</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Current streak</div>
                  <div className="mt-1 text-sm text-white">🔥 {currentStreakDays}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Best streak</div>
                  <div className="mt-1 text-sm text-white">🏆 {bestStreakDays}</div>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm text-white/65">
                Home page aur chat page ye values read kar sakte hain. Display name bhi yahin se update hoga.
              </div>
            </Card>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={saveSettings}
              disabled={saving || loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[24px] bg-gradient-to-r from-pink-500 to-violet-600 px-5 py-4 font-medium text-white shadow-lg shadow-pink-500/20 transition hover:scale-[1.01] disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              {saving ? "Saving..." : "Save settings"}
            </button>

            <button
              onClick={resetToDefault}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 font-medium text-white/90 transition hover:bg-white/10"
            >
              <MoonStar className="h-5 w-5" />
              Reset local
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 font-medium text-white/90 transition hover:bg-white/10"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
              {message}
            </div>
          ) : null}

          <div className="mt-6 text-center text-xs text-white/40">
            Keep the vibe aligned with home, chat, and notifications.
          </div>
        </div>
      </div>
    </main>
  );
}
