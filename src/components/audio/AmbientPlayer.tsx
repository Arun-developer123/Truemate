"use client";

import { useEffect } from "react";
import { useTruemateAudio } from "./AudioProvider";

export function AmbientPlayer() {
  const { audioRef } = useTruemateAudio();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0.05;
  }, [audioRef]);

  return (
    <audio
      ref={audioRef}
      src="/sounds/ambience-loop.mp3"
      preload="auto"
      loop
      playsInline
      aria-hidden="true"
      className="hidden"
    />
  );
}