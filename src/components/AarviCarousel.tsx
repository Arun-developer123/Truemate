"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  images: string[];
};

export default function AarviCarousel({ images }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!images || images.length === 0) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), 4000);
    return () => clearInterval(t);
  }, [images]);

  if (!images || images.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-xl bg-slate-100 flex items-center justify-center p-8">
        <div className="text-slate-600">No images provided</div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-xl">
      <div className="aspect-[16/10] relative">
        <Image
          src={images[index]}
          alt={`Aarvi ${index + 1}`}
          fill
          sizes="(max-width: 1024px) 90vw, 800px"
          className="object-cover"
        />
      </div>

      <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/70 rounded-full p-1">
        <button
          aria-label="Previous"
          onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
          className="px-3 py-2 rounded-full"
        >
          ‹
        </button>
      </div>

      <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/70 rounded-full p-1">
        <button
          aria-label="Next"
          onClick={() => setIndex((i) => (i + 1) % images.length)}
          className="px-3 py-2 rounded-full"
        >
          ›
        </button>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Show image ${i + 1}`}
            className={`w-2 h-2 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
