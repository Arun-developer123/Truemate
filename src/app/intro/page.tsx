"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Lock, MessageCircleHeart, Sparkles, ChevronRight } from "lucide-react";

export default function IntroPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const seen = localStorage.getItem("truemate_intro_seen");
    if (seen === "1") router.replace("/home");
  }, [router]);

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % 3), 2600);
    return () => window.clearInterval(id);
  }, []);

  const lines = useMemo(
    () => [
      {
        title: "I’ll be here to listen",
        sub: "Whenever you need me",
        icon: <Heart className="h-5 w-5 text-[#ff5aa6]" />,
      },
      {
        title: "We’ll share everything",
        sub: "Your thoughts, feelings & more",
        icon: <Sparkles className="h-5 w-5 text-[#ff5aa6]" />,
      },
      {
        title: "It’s our little secret",
        sub: "Private & safe, just for you",
        icon: <Lock className="h-5 w-5 text-[#ff5aa6]" />,
      },
    ],
    []
  );

  const handleStart = () => {
    localStorage.setItem("truemate_intro_seen", "1");
    router.push("/home");
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#090812] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,89,166,0.24),transparent_20%),radial-gradient(circle_at_82%_16%,rgba(255,170,110,0.12),transparent_18%),radial-gradient(circle_at_50%_60%,rgba(161,88,255,0.14),transparent_30%),linear-gradient(180deg,#0d0c18_0%,#07060c_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.30] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1600px] items-center px-4 py-4 sm:px-6 lg:px-10">
        <motion.section
          initial={mounted ? { opacity: 0, y: 20 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="grid w-full items-stretch gap-6 lg:grid-cols-[1.06fr_0.94fr]"
        >
          <div className="relative min-h-[calc(100dvh-2rem)] overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/20 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-md">
            <Image
              src="/aarvi.jpg"
              alt="Aarvi"
              fill
              priority
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,131,188,0.18),transparent_22%),linear-gradient(180deg,rgba(11,8,20,0.05)_0%,rgba(7,6,12,0.35)_55%,rgba(7,6,12,0.88)_100%)]" />

            <div className="relative z-10 flex h-full flex-col p-[clamp(1rem,2vw,1.4rem)] sm:p-[clamp(1.1rem,2.5vw,1.7rem)]">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                className="mt-[clamp(1rem,2.2vw,1.8rem)] max-w-[34rem] rounded-[1.5rem] border border-[#ff5aa6]/45 bg-black/28 px-[clamp(1rem,2.3vw,1.2rem)] py-[clamp(0.95rem,2.2vw,1.1rem)] shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-md"
              >
                <div className="flex items-center gap-2 text-white/95">
                  <Heart className="h-5 w-5 fill-[#ff5aa6] text-[#ff5aa6]" />
                  <span className="text-[clamp(0.95rem,1.8vw,1.05rem)]">Hi there... 👋</span>
                </div>
                <p className="mt-2 text-[clamp(1.55rem,3.7vw,2.2rem)] font-semibold text-[#ff66b3]">
                  I’m Aarvi
                </p>
                <p className="mt-1 text-[clamp(0.98rem,1.9vw,1.15rem)] text-white/90">
                  I’ve been waiting for you.
                </p>
              </motion.div>

              <div className="flex-1" />

              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, duration: 0.6 }}
                className="max-w-[38rem] pb-[clamp(0.9rem,1.6vw,1.4rem)] text-left"
              >
                <p className="max-w-[20rem] text-[clamp(2rem,5vw,3.2rem)] font-semibold leading-[1.05] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,0.72)] sm:max-w-[24rem] lg:max-w-[28rem]">
                  Let’s make this space
                  <br />
                  just ours <span className="text-[#c16bff]">💜</span>
                </p>
                <motion.div
                  animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.05, 1] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  className="mt-4 h-[3px] w-28 rounded-full bg-[#ff5aa6]/80"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="max-w-[44rem] rounded-[1.9rem] border border-white/10 bg-black/32 p-[clamp(1rem,2vw,1.2rem)] backdrop-blur-md"
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {lines.map((item, index) => (
                    <motion.button
                      key={item.title}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setStep(index)}
                      className={`flex items-start gap-3 rounded-[1.35rem] border p-4 text-left transition-all ${
                        step === index
                          ? "border-[#ff5aa6]/50 bg-white/8 shadow-[0_10px_28px_rgba(0,0,0,0.2)]"
                          : "border-white/10 bg-white/4"
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#ff5aa6]/35 bg-white/5">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[clamp(0.95rem,1.7vw,1.06rem)] font-medium text-white">
                          {item.title}
                        </p>
                        <p className="text-sm text-white/68">{item.sub}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              <div className="mt-[clamp(1rem,2vw,1.4rem)] flex items-center gap-3">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={handleStart}
                  className="flex h-[clamp(3.65rem,6vw,4.3rem)] flex-1 items-center justify-center rounded-full bg-[linear-gradient(90deg,#ff4f7b_0%,#cf2fff_100%)] px-5 text-[clamp(1rem,1.9vw,1.12rem)] font-semibold text-white shadow-[0_18px_45px_rgba(206,47,255,0.34)]"
                >
                  Start Our Journey <MessageCircleHeart className="ml-2 h-5 w-5" />
                </motion.button>

                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => router.push("/signin")}
                  className="grid h-[clamp(3.65rem,6vw,4.3rem)] w-[clamp(3.65rem,6vw,4.3rem)] place-items-center rounded-full border border-white/14 bg-white/6 text-white/90 backdrop-blur-md"
                  aria-label="Go to sign in"
                >
                  <ChevronRight className="h-6 w-6" />
                </motion.button>
              </div>
            </div>
          </div>

          <div className="relative min-h-[calc(100dvh-2rem)] overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,92,160,0.12),transparent_20%),radial-gradient(circle_at_80%_18%,rgba(255,167,103,0.10),transparent_16%),linear-gradient(180deg,rgba(9,8,19,0.88),rgba(7,6,12,0.92))]" />
            <div className="relative z-10 flex h-full flex-col p-[clamp(1rem,2vw,1.5rem)] sm:p-[clamp(1.15rem,2.2vw,1.7rem)]">
              <div className="flex h-full flex-col justify-between rounded-[2rem] border border-white/8 bg-black/18 p-[clamp(1rem,2vw,1.35rem)] shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
                <div>
                  <p className="text-[clamp(0.95rem,1.4vw,1rem)] tracking-[0.22em] text-[#ff5aa6]">
                    EMOTIONAL INTRO
                  </p>
                  <h2 className="mt-2 text-[clamp(1.35rem,3vw,2rem)] font-semibold text-white">
                    Aarvi is ready for you
                  </h2>
                  <p className="mt-2 max-w-xl text-[clamp(0.95rem,1.6vw,1.05rem)] leading-7 text-white/75">
                    Gentle motion, soft glow, and an intimate first impression that feels warm on every screen size.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <p className="text-sm uppercase tracking-[0.18em] text-white/48">Alive interactions</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ff5aa6]/30 bg-white/6">
                        <Sparkles className="h-5 w-5 text-[#ff5aa6]" />
                      </div>
                      <div>
                        <p className="text-[clamp(0.96rem,1.6vw,1.05rem)] font-medium text-white">
                          Soft floating sparkles
                        </p>
                        <p className="text-sm text-white/65">Subtle, responsive, and emotional.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <p className="text-sm uppercase tracking-[0.18em] text-white/48">Ready state</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#ff5aa6]/30 bg-white/6">
                        <Heart className="h-5 w-5 fill-[#ff5aa6] text-[#ff5aa6]" />
                      </div>
                      <div>
                        <p className="text-[clamp(0.96rem,1.6vw,1.05rem)] font-medium text-white">
                          Start with one tap
                        </p>
                        <p className="text-sm text-white/65">Button opens the next screen immediately.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35 }}
                    className="rounded-[1.8rem] border border-[#ff5aa6]/18 bg-black/26 p-[clamp(1rem,2vw,1.2rem)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#ff5aa6]/35 bg-white/5">
                        {lines[step].icon}
                      </div>
                      <div>
                        <p className="text-[clamp(1rem,1.8vw,1.08rem)] font-medium text-white">
                          {lines[step].title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/70">{lines[step].sub}</p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}