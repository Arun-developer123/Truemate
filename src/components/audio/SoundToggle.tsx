"use client";

import { Volume2, VolumeX, Music4 } from "lucide-react";
import { useTruemateAudio } from "./AudioProvider";

export function SoundToggle({ className = "" }: { className?: string }) {
  const { enabled, toggle } = useTruemateAudio();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Turn sound off" : "Turn sound on"}
      title={enabled ? "Sound on" : "Sound off"}
      className={`group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-white/90 backdrop-blur-xl transition-all duration-300 hover:border-pink-300/25 hover:bg-white/10 hover:shadow-[0_0_24px_rgba(236,72,153,0.12)] active:scale-[0.98] ${
        enabled ? "shadow-[0_0_22px_rgba(168,85,247,0.16)]" : ""
      } ${className}`}
    >
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20">
        {enabled ? (
          <Volume2 className="h-4 w-4 text-pink-200 transition-transform duration-300 group-hover:scale-110" />
        ) : (
          <VolumeX className="h-4 w-4 text-white/70 transition-transform duration-300 group-hover:scale-110" />
        )}
      </span>

      <span className="flex items-center gap-1.5">
        <Music4
          className={`h-4 w-4 transition-all duration-300 ${
            enabled ? "text-pink-300" : "text-white/45"
          }`}
        />
        <span className="font-medium">{enabled ? "Sound on" : "Sound off"}</span>
      </span>

      <span
        className={`ml-1 h-2 w-2 rounded-full transition-all duration-300 ${
          enabled ? "bg-pink-300 shadow-[0_0_12px_rgba(244,114,182,0.8)]" : "bg-white/20"
        }`}
      />
    </button>
  );
}