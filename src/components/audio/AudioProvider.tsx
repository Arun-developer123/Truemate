"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SOUND_KEY = "truemate:ambient-sound";

type TruemateAudioContextValue = {
  enabled: boolean;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  setEnabled: (value: boolean) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
};

const TruemateAudioContext = createContext<TruemateAudioContextValue | null>(
  null
);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SOUND_KEY);
      if (saved === "on") setEnabled(true);
      if (saved === "off") setEnabled(false);
    } catch {
      // ignore storage errors
    }
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.volume = 0.16;
      await audio.play();
    } catch {
      // Browser may block autoplay until user interacts.
    }
  }, []);

  const persist = useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(SOUND_KEY, value ? "on" : "off");
    } catch {
      // ignore storage errors
    }
  }, []);

  const setEnabledAndPersist = useCallback(
    (value: boolean) => {
      setEnabled(value);
      persist(value);

      if (value) {
        void play();
      } else {
        pause();
      }
    },
    [persist, play, pause]
  );

  const toggle = useCallback(() => {
    setEnabledAndPersist(!enabled);
  }, [enabled, setEnabledAndPersist]);

  useEffect(() => {
    if (enabled) {
      void play();
    } else {
      pause();
    }
  }, [enabled, play, pause]);

  useEffect(() => {
    if (!enabled) return;

    const resumeAudio = () => {
      void play();
    };

    window.addEventListener("pointerdown", resumeAudio, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", resumeAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
    };
  }, [enabled, play]);

  const value = useMemo<TruemateAudioContextValue>(
    () => ({
      enabled,
      play,
      pause,
      toggle,
      setEnabled: setEnabledAndPersist,
      audioRef,
    }),
    [enabled, play, pause, toggle, setEnabledAndPersist]
  );

  return (
    <TruemateAudioContext.Provider value={value}>
      {children}
    </TruemateAudioContext.Provider>
  );
}

export function useTruemateAudio() {
  const ctx = useContext(TruemateAudioContext);
  if (!ctx) {
    throw new Error("useTruemateAudio must be used inside AudioProvider");
  }
  return ctx;
}