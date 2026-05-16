"use client";

import { Headphones, Sparkles, Volume2, MoonStar } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTruemateAudio } from "./AudioProvider";

const INTRO_KEY = "truemate:headphone-seen";
const SHOW_ON_ROUTES = ["/home", "/chat", "/settings"];

function shouldShowOnRoute(pathname: string) {
  return SHOW_ON_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function HeadphoneIntro() {
  const pathname = usePathname();
  const { setEnabled } = useTruemateAudio();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (!pathname) return;

    if (!shouldShowOnRoute(pathname)) {
      setOpen(false);
      return;
    }

    try {
      const seen = window.localStorage.getItem(INTRO_KEY);
      setOpen(seen !== "true");
    } catch {
      setOpen(true);
    }
  }, [pathname]);

  const markSeen = () => {
    try {
      window.localStorage.setItem(INTRO_KEY, "true");
    } catch {
      // ignore storage errors
    }
  };

  const handleContinueWithSound = () => {
    markSeen();
    setEnabled(true);
    setOpen(false);
  };

  const handleStartMuted = () => {
    markSeen();
    setEnabled(false);
    setOpen(false);
  };

  if (!mounted || !open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/85 px-4 backdrop-blur-2xl">
      {/* ambient glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.20),transparent_30%),radial-gradient(circle_at_bottom,rgba(124,58,237,0.20),transparent_35%),linear-gradient(to_bottom,rgba(0,0,0,0.65),rgba(8,7,16,0.98))]" />
      <div className="absolute left-1/2 top-[-120px] h-64 w-64 -translate-x-1/2 rounded-full bg-pink-500/20 blur-3xl" />
      <div className="absolute bottom-[-140px] right-[-60px] h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />

      <div className="relative w-full max-w-md overflow-hidden rounded-[34px] border border-white/10 bg-[#0b0a12]/92 text-white shadow-[0_30px_120px_rgba(0,0,0,0.75)]">
        <div className="h-1 w-full bg-gradient-to-r from-pink-400 via-fuchsia-500 to-violet-500" />

        <div className="p-6 sm:p-7">
          <div className="mb-5 flex items-start gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 bg-white/6 shadow-lg shadow-pink-500/10">
              <div className="absolute inset-0 rounded-[22px] bg-gradient-to-br from-pink-400/20 to-violet-500/20" />
              <Headphones className="relative z-10 h-7 w-7 text-white/95" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-white">
                Best with sound
                <Sparkles className="h-4 w-4 text-pink-300" />
              </div>
              <p className="mt-1 text-sm leading-6 text-white/60">
                Truemate feels warmer, softer, and more alive with ambient audio.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-inner shadow-black/40">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.26em] text-white/35">
              <MoonStar className="h-4 w-4 text-violet-300/80" />
              gentle immersion
            </div>

            <p className="mt-4 text-[15px] leading-7 text-white/78">
              Use headphones if possible. The sound is designed to feel close,
              soft, and emotionally present — like the app is quietly with you.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-white/85">
                  <Volume2 className="h-4 w-4 text-pink-300" />
                  subtle ambience
                </div>
                <div className="mt-1 text-xs text-white/45">
                  low, soft, and non-distracting
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-white/85">
                  <Headphones className="h-4 w-4 text-violet-300" />
                  best in headphones
                </div>
                <div className="mt-1 text-xs text-white/45">
                  deeper emotional presence
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleContinueWithSound}
              className="flex-1 rounded-[22px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-3.5 text-sm font-medium text-white shadow-[0_14px_40px_rgba(168,85,247,0.25)] transition hover:brightness-110 active:scale-[0.99]"
            >
              Continue with sound
            </button>

            <button
              type="button"
              onClick={handleStartMuted}
              className="flex-1 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium text-white/88 transition hover:bg-white/10 active:scale-[0.99]"
            >
              Start muted
            </button>
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-white/35">
            You can change this anytime from the sound button.
          </p>
        </div>
      </div>
    </div>
  );
}