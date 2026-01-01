"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, Variants } from "framer-motion";
import { Mail, Gamepad, Calendar, Award, Star } from "lucide-react";

interface Feature {
  id: number;
  title: string;
  desc: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;
}

const features: Feature[] = [
  { id: 1, title: "Chat", desc: "Smart, empathetic conversations anytime.", Icon: Mail },
  { id: 2, title: "Games", desc: "Short, replayable games to challenge your brain.", Icon: Gamepad },
  { id: 3, title: "Challenges", desc: "Daily micro-challenges to build momentum.", Icon: Calendar },
  { id: 4, title: "Achievements", desc: "Collect badges and celebrate wins.", Icon: Award },
  { id: 5, title: "Easter Eggs", desc: "Hidden surprises — discover and share.", Icon: Star },
];

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.08, when: "beforeChildren" } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 22 } },
  hover: { scale: 1.03, y: -6, boxShadow: "0 12px 30px rgba(0,0,0,0.35)" },
};

export default function LandingPage(): React.JSX.Element {
  const router = useRouter();

  // beforeinstallprompt handling
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // listen for the event once
    const handler = (e: Event) => {
      // The event needs to be typed as any to access prompt()/userChoice in some browsers
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);

    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      // nothing to do — maybe instruct iOS users to use "Add to Home Screen"
      return;
    }
    try {
      setInstalling(true);
      // @ts-ignore: prompt() exists on the beforeinstallprompt event object
      await (deferredPrompt as any).prompt();
      // @ts-ignore
      const choice = await (deferredPrompt as any).userChoice;
      // optional: react to userChoice.outcome === 'accepted' | 'dismissed'
      setDeferredPrompt(null);
      setCanInstall(false);
    } catch (err) {
      console.warn("Install prompt failed:", err);
    } finally {
      setInstalling(false);
    }
  };

  // Service Worker registration (client-only)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // console.log("Service worker registered:", reg);
        })
        .catch((err) => {
          console.warn("Service worker registration failed:", err);
        });
    }
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-purple-600 via-indigo-700 to-slate-900 text-white">
      {/* Subtle animated glow layers */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 w-96 h-96 rounded-full bg-pink-500 opacity-30 blur-3xl animate-blob" />
        <div className="absolute right-10 -top-10 w-72 h-72 rounded-full bg-indigo-400 opacity-20 blur-2xl animate-blob animation-delay-2000" />
        <div className="absolute left-1/2 bottom-[-120px] -translate-x-1/2 w-[45rem] h-56 rounded-3xl bg-gradient-to-r from-purple-400 to-indigo-500 opacity-10 blur-2xl" />
      </div>

      <div className="container mx-auto px-6 py-20 lg:py-32">
        <motion.section initial="hidden" animate="show" variants={containerVariants} className="max-w-5xl mx-auto text-center">
          {/* Hero Card */}
          <motion.div variants={cardVariants} whileHover="hover" className="relative overflow-hidden rounded-3xl bg-white/6 border border-white/10 backdrop-blur-md p-8 lg:p-12 shadow-2xl">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="flex-1 text-left">
                <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
                  Welcome to{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200">
                    Truemate
                  </span>
                </h1>
                <p className="mt-4 text-gray-100/90 max-w-xl">
                  Your personal AI companion for chatting, games, challenges and delightful surprises. Stay productive while having fun — daily.
                </p>

                <div className="mt-6 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => router.push("/signin")}
                    aria-label="Get started"
                    className="inline-flex items-center gap-3 rounded-2xl bg-white text-indigo-700 font-semibold px-6 py-3 shadow-lg hover:scale-[1.02] hover:shadow-2xl transition-transform"
                  >
                    Get Started →
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/about")}
                    aria-label="Learn more"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5 transition"
                  >
                    Learn more
                  </button>

                  {/* Install button appears if the browser fired beforeinstallprompt */}
                  {canInstall && (
                    <button
                      type="button"
                      onClick={installApp}
                      disabled={installing}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2 text-sm font-semibold shadow-lg hover:scale-[1.02] transition-transform"
                      aria-label="Install Truemate"
                    >
                      {installing ? "Installing..." : "Install App"}
                    </button>
                  )}
                </div>

                <div className="mt-6 text-xs text-gray-200/80">
                  <span className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-white/8 px-2 py-1" aria-hidden>
                      ✨
                    </span>
                    <span>Chat • Games • Challenges • Achievements • Easter Eggs</span>
                  </span>
                </div>
              </div>

              {/* Mini demo board */}
              <div className="w-full lg:w-96">
                <div className="rounded-2xl bg-gradient-to-br from-white/5 to-white/3 p-3 shadow-inner border border-white/6">
                  <div className="rounded-xl bg-gradient-to-b from-slate-800/60 to-transparent p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-300">Live Demo</div>
                        <div className="font-semibold">Aarvi • Your AI Friend</div>
                      </div>
                      <div className="text-xs text-green-300">Online</div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }} className="text-sm bg-white/3 rounded-lg p-3">
                        <div className="text-gray-100/90">Hey — ready for a 2-minute brain-teaser?</div>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.22 }} className="text-sm bg-white/3 rounded-lg p-3">
                        <div className="text-gray-100/90">Collect daily badges and unlock secret replies.</div>
                      </motion.div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button type="button" className="flex-1 rounded-md bg-white/8 py-2 text-sm hover:bg-white/12 transition">Start</button>
                      <button type="button" className="rounded-md bg-transparent border border-white/8 px-3 py-2 text-sm">Demo</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* subtle highlight ribbon */}
            <div className="pointer-events-none absolute -bottom-10 left-6 right-6 mx-auto h-1/6 opacity-30 blur-xl">
              <div className="h-full rounded-3xl bg-gradient-to-r from-purple-500 to-indigo-400" />
            </div>
          </motion.div>

          {/* Feature Grid */}
          <motion.div variants={containerVariants} className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <motion.article key={f.id} variants={cardVariants} whileHover={"hover"} className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/4 p-5 backdrop-blur-md">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-white/6 p-3" aria-hidden>
                    <f.Icon size={20} />
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg">{f.title}</h3>
                    <p className="mt-1 text-sm text-gray-200/90">{f.desc}</p>
                  </div>
                </div>

                <div className="absolute right-4 top-4 opacity-10 text-6xl select-none pointer-events-none">•</div>
              </motion.article>
            ))}
          </motion.div>

          {/* Board / CTA Row */}
          <motion.div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <motion.div variants={cardVariants} className="lg:col-span-2 rounded-2xl p-6 bg-gradient-to-b from-white/4 to-transparent border border-white/8">
              <h4 className="font-semibold text-xl">Interactive Board</h4>
              <p className="mt-2 text-sm text-gray-200/90">A snapshot of conversations, scores, and challenges — designed to tease curiosity.</p>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-white/6 p-3">
                  <div className="text-xs text-gray-300">Today</div>
                  <div className="font-semibold text-lg">3 Challenges</div>
                </div>

                <div className="rounded-lg bg-white/6 p-3">
                  <div className="text-xs text-gray-300">Streak</div>
                  <div className="font-semibold text-lg">7 days</div>
                </div>
              </div>
            </motion.div>

            <motion.aside variants={cardVariants} className="rounded-2xl p-6 bg-white/5 border border-white/8">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/8 p-2" aria-hidden>
                  <Star size={18} />
                </div>
                <div>
                  <div className="text-xs text-gray-300">Featured</div>
                  <div className="font-semibold">Daily Surprise</div>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-200/80">Click start to reveal today's hidden interaction and win a badge.</div>

              <button type="button" className="mt-4 w-full rounded-2xl bg-white text-indigo-700 font-semibold px-4 py-2">Reveal</button>
            </motion.aside>
          </motion.div>
        </motion.section>
      </div>

      {/* small footer */}
      <footer className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-200/60">
        © {new Date().getFullYear()} Truemate — built with ❤️
      </footer>

      {/* Tiny styles used for animation delays */}
      <style>{`
        .animate-blob { animation: blob 8s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(12px, -8px) scale(1.05); }
          66% { transform: translate(-8px, 6px) scale(0.98); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
      `}</style>
    </main>
  );
}
