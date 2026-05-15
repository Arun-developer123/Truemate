"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  Camera,
  ChevronRight,
  CircleUser,
  Heart,
  LogOut,
  MoonStar,
  Settings,
  Shield,
  Sparkles,
  User,
  Volume2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type UserData = {
  name: string;
  email: string;
  avatarUrl: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserData>({
    name: "Arun",
    email: "",
    avatarUrl: "/aarvi.jpg",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);

      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/signin");
        return;
      }

      const metaName =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        data.user.user_metadata?.display_name;

      const emailName = data.user.email ? data.user.email.split("@")[0] : "Arun";

      setUser({
        name: metaName || emailName || "Arun",
        email: data.user.email || "",
        avatarUrl: data.user.user_metadata?.avatar_url || "/aarvi.jpg",
      });

      setLoading(false);
    };

    boot();
  }, [router]);

  const stats = useMemo(
    () => [
      { label: "Chats", value: "128" },
      { label: "Mood logs", value: "24" },
      { label: "Days active", value: "31" },
    ],
    []
  );

  const handleLogout = async () => {
    setSaving(true);
    await supabase.auth.signOut();
    router.replace("/signin");
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#090812] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,92,160,0.18),transparent_18%),radial-gradient(circle_at_85%_18%,rgba(161,88,255,0.12),transparent_20%),linear-gradient(180deg,#0d0c18_0%,#07060c_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.26] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto min-h-dvh w-full max-w-[1200px] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <motion.div
          initial={mounted ? { opacity: 0, y: 16 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="rounded-[2.3rem] border border-white/10 bg-white/5 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <div className="border-b border-white/10 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => router.back()}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="text-center">
                <p className="text-xs tracking-[0.22em] text-[#ff5aa6]">PROFILE</p>
                <h1 className="text-lg font-semibold sm:text-xl">Your Space</h1>
              </div>

              <button
                onClick={() => router.push("/home")}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
                aria-label="Go home"
              >
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
            </div>
          </div>

          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
            <section className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-col items-center text-center">
                <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white/80 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                  <Image
                    src={user.avatarUrl}
                    alt={user.name}
                    fill
                    className="object-cover object-center"
                  />
                  <button
                    className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/60 backdrop-blur-md"
                    aria-label="Change profile photo"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4">
                  <h2 className="text-2xl font-semibold">
                    {loading ? "Loading..." : user.name}
                  </h2>
                  <p className="mt-1 text-sm text-white/65">
                    {loading ? "Fetching account..." : user.email || "No email found"}
                  </p>
                </div>

                <div className="mt-5 grid w-full grid-cols-3 gap-3">
                  {stats.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[1.35rem] border border-white/10 bg-white/5 p-3"
                    >
                      <p className="text-lg font-semibold">{item.value}</p>
                      <p className="mt-1 text-xs text-white/60">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 w-full space-y-3">
                  <button
                    onClick={() => router.push("/home")}
                    className="flex w-full items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-left transition-transform hover:-translate-y-[1px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ff5aa6]/35 bg-white/5 text-[#ff5aa6]">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Home</p>
                        <p className="text-sm text-white/62">Back to the dashboard</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/50" />
                  </button>

                  <button
                    onClick={() => router.push("/chat")}
                    className="flex w-full items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-left transition-transform hover:-translate-y-[1px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ff5aa6]/35 bg-white/5 text-[#ff5aa6]">
                        <Heart className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Chat</p>
                        <p className="text-sm text-white/62">Open Aarvi conversation</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/50" />
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm tracking-[0.18em] text-[#ff5aa6]">ACCOUNT</p>
                    <h3 className="mt-1 text-xl font-semibold">Profile Settings</h3>
                  </div>
                  <CircleUser className="h-6 w-6 text-white/70" />
                </div>

                <div className="mt-5 space-y-3">
                  <SettingRow
                    icon={<User className="h-5 w-5" />}
                    title="Name"
                    sub={user.name}
                    onClick={() => router.push("/profile/edit")}
                  />
                  <SettingRow
                    icon={<Sparkles className="h-5 w-5" />}
                    title="Style"
                    sub="Mood, tone and visual feel"
                    onClick={() => router.push("/home")}
                  />
                  <SettingRow
                    icon={<Volume2 className="h-5 w-5" />}
                    title="Sound"
                    sub="Voice cues and effects"
                    onClick={() => router.push("/home")}
                  />
                  <SettingRow
                    icon={<MoonStar className="h-5 w-5" />}
                    title="Theme"
                    sub="Dark, soft and future-ready"
                    onClick={() => router.push("/home")}
                  />
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm tracking-[0.18em] text-[#ff5aa6]">APP</p>
                    <h3 className="mt-1 text-xl font-semibold">Quick Actions</h3>
                  </div>
                  <Settings className="h-6 w-6 text-white/70" />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <QuickButton
                    icon={<Bell className="h-5 w-5" />}
                    title="Notifications"
                    sub="Manage reminders"
                    onClick={() => router.push("/home")}
                  />
                  <QuickButton
                    icon={<Shield className="h-5 w-5" />}
                    title="Privacy"
                    sub="Security and access"
                    onClick={() => router.push("/home")}
                  />
                  <QuickButton
                    icon={<Sparkles className="h-5 w-5" />}
                    title="Memories"
                    sub="See saved moments"
                    onClick={() => router.push("/home")}
                  />
                  <QuickButton
                    icon={<LogOut className="h-5 w-5" />}
                    title={saving ? "Logging out..." : "Logout"}
                    sub="Sign out safely"
                    onClick={handleLogout}
                    danger
                  />
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function SettingRow({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-left transition-transform hover:-translate-y-[1px]"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ff5aa6]/35 bg-white/5 text-[#ff5aa6]">
          {icon}
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-white/62">{sub}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-white/50" />
    </button>
  );
}

function QuickButton({
  icon,
  title,
  sub,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[1.35rem] border p-4 text-left transition-transform hover:-translate-y-[1px] ${
        danger
          ? "border-red-500/15 bg-red-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${
            danger
              ? "border-red-500/20 bg-red-500/10 text-red-300"
              : "border-[#ff5aa6]/35 bg-white/5 text-[#ff5aa6]"
          }`}
        >
          {icon}
        </div>
        <div>
          <p className={`font-medium ${danger ? "text-red-200" : "text-white"}`}>
            {title}
          </p>
          <p className="mt-1 text-sm text-white/62">{sub}</p>
        </div>
      </div>
    </button>
  );
}