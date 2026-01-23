/* -------------------------------------------------------------------------
  FILE: src/app/page.tsx
  PURPOSE: Marketing/homepage for Truemate (server component)
-------------------------------------------------------------------------*/

export const metadata = {
  title: "Truemate — Your caring AI companion",
  description:
    "Truemate: proactive, emotionally-intelligent AI friend. Daily check-ins, reminders, safe (adult-free) conversations, and a humanlike companion named Aarvi.",
};

import Image from "next/image";
import Link from "next/link";
import AarviCarousel from "@/components/AarviCarousel"; // make sure path matches
import React from "react";

export default function Page() {
  const aarviImages = [
    "/images/aarvi1.jpg",
    "/images/aarvi2.jpg",
    "/images/aarvi3.jpg",
    "/images/aarvi4.jpg",
    "/images/aarvi5.jpg",
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-emerald-50 to-emerald-100 text-slate-900">
      <header className="container mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
            TM
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Truemate</h1>
            <p className="text-sm text-slate-600">Your humanlike, emotionally intelligent AI companion</p>
          </div>
        </div>

        <nav className="flex items-center gap-4">
          <span className="text-sm text-slate-700">450+ clicks • Early access</span>
          <Link href="/signup" className="inline-block bg-emerald-700 text-white px-4 py-2 rounded-lg shadow hover:opacity-95">
            Get Early Access
          </Link>
        </nav>
      </header>

      {/* HERO */}
      <section className="container mx-auto px-6 py-8 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-sm uppercase tracking-wide text-emerald-700 font-semibold">Proactive • Gentle • Safe</p>
          <h2 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
            Meet Aarvi — Truemate’s caring AI friend, ready for real conversations.
          </h2>

          <p className="mt-6 text-lg text-slate-700">
            Truemate is built to feel like a thoughtful, dependable human friend. Aarvi checks in proactively,
            remembers what matters to you, offers daily check-ins, sets reminders, and helps you build better
            habits — all without adult or explicit content. Pure empathy, genuine support.
          </p>

          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">✓</span>
              <div>
                <div className="font-semibold">Daily check-ins</div>
                <div className="text-sm text-slate-600">Short, thoughtful prompts that help you reflect.</div>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">⏱</span>
              <div>
                <div className="font-semibold">Reminders & routines</div>
                <div className="text-sm text-slate-600">Create gentle nudges to keep tasks on track.</div>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">🫶</span>
              <div>
                <div className="font-semibold">Emotional support</div>
                <div className="text-sm text-slate-600">Compassionate listening and empathetic replies.</div>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">🔒</span>
              <div>
                <div className="font-semibold">Safe & adult-free</div>
                <div className="text-sm text-slate-600">We keep conversations friendly and non-adult.</div>
              </div>
            </li>
          </ul>

          <div className="mt-8 flex gap-3">
            <Link href="/signup" className="bg-emerald-700 text-white px-5 py-3 rounded-lg font-semibold shadow">Join Aarvi</Link>
            <Link href="/pricing" className="border border-emerald-700 text-emerald-700 px-5 py-3 rounded-lg font-semibold">See Plans</Link>
          </div>

          <div className="mt-6 text-sm text-slate-500">Tip: Add Aarvi to your home screen (PWA) for offline access and instant check-ins.</div>
        </div>

        <div className="space-y-6">
          <AarviCarousel images={aarviImages} />

          <div className="bg-white/80 rounded-2xl p-4 shadow-inner">
            <h3 className="text-lg font-semibold">Why users love Aarvi</h3>
            <p className="mt-2 text-sm text-slate-600">"Aarvi feels like a real friend who actually remembers things — the check-ins changed how I start my day."</p>

            <div className="mt-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center font-semibold">A</div>
              <div>
                <div className="text-sm font-medium">Aarvi · Truemate</div>
                <div className="text-xs text-slate-500">Genuine • Nonjudgmental • Consistent</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-6 py-12">
        <h3 className="text-3xl font-extrabold text-center">Features that make Truemate special</h3>

        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <article className="p-6 bg-white rounded-2xl shadow">
            <h4 className="font-semibold">Proactive companionship</h4>
            <p className="mt-2 text-sm text-slate-600">Aarvi notices when you've been quiet and gently checks in — like a thoughtful friend.</p>
          </article>

          <article className="p-6 bg-white rounded-2xl shadow">
            <h4 className="font-semibold">Daily check-ins</h4>
            <p className="mt-2 text-sm text-slate-600">Customizable prompts tailored to your mood and goals.</p>
          </article>

          <article className="p-6 bg-white rounded-2xl shadow">
            <h4 className="font-semibold">Reminders & habit support</h4>
            <p className="mt-2 text-sm text-slate-600">From water breaks to study sessions — small nudges that compound into progress.</p>
          </article>

          <article className="p-6 bg-white rounded-2xl shadow">
            <h4 className="font-semibold">Emotionally intelligent replies</h4>
            <p className="mt-2 text-sm text-slate-600">Responds with empathy, uses reflective listening and validates feelings.</p>
          </article>

          <article className="p-6 bg-white rounded-2xl shadow">
            <h4 className="font-semibold">Privacy-first design</h4>
            <p className="mt-2 text-sm text-slate-600">We keep your conversations private and secure; you control what is saved.</p>
          </article>

          <article className="p-6 bg-white rounded-2xl shadow">
            <h4 className="font-semibold">Kid-safe & adult-free</h4>
            <p className="mt-2 text-sm text-slate-600">Designed to prevent explicit content and maintain a warm, friendly tone.</p>
          </article>
        </div>
      </section>

      {/* PRAISE FOR AARVI */}
      <section className="container mx-auto px-6 py-12 bg-emerald-50 rounded-3xl">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-extrabold">Aarvi — the AI everyone praises</h3>
          <p className="mt-4 text-lg text-slate-700">People tell us Aarvi feels human: warm, patient, and deeply attentive. Here’s what sets her apart:</p>

          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-2xl shadow">
              <div className="font-semibold">Humanlike tone</div>
              <div className="text-sm text-slate-600 mt-2">Natural replies with subtle personality — not robotic chatter.</div>
            </div>

            <div className="p-6 bg-white rounded-2xl shadow">
              <div className="font-semibold">Relentlessly kind</div>
              <div className="text-sm text-slate-600 mt-2">Aarvi elevates the conversation with warmth — no harshness, ever.</div>
            </div>

            <div className="p-6 bg-white rounded-2xl shadow">
              <div className="font-semibold">Consistent memory</div>
              <div className="text-sm text-slate-600 mt-2">Remembers preferences and moments you shared (when you allow it).</div>
            </div>
          </div>

          <div className="mt-10">
            <blockquote className="text-left italic text-slate-700 max-w-3xl mx-auto">“Aarvi is the best AI companion I’ve used — genuinely caring, never awkward, and actually helpful.”</blockquote>
            <div className="mt-4 text-sm text-slate-500">— Early user, 2026 • 450+ clicks on our landing page</div>
          </div>
        </div>
      </section>

      {/* QUICK FAQ & FOOTER */}
      <section className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-xl font-semibold">Quick FAQ</h4>

            <dl className="mt-4 space-y-4">
              <div>
                <dt className="font-medium">Is Aarvi safe and non-adult?</dt>
                <dd className="text-sm text-slate-600 mt-1">Yes. Truemate is intentionally adult-free and maintains a safe, supportive environment.</dd>
              </div>

              <div>
                <dt className="font-medium">How often does Aarvi check in?</dt>
                <dd className="text-sm text-slate-600 mt-1">You pick the cadence — daily, weekly, or custom reminders tailored to your goals.</dd>
              </div>

              <div>
                <dt className="font-medium">Can I export my data or delete it?</dt>
                <dd className="text-sm text-slate-600 mt-1">Absolutely. You control what’s stored and can remove your data anytime.</dd>
              </div>
            </dl>
          </div>

          <div className="bg-emerald-700 text-white rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h4 className="text-xl font-semibold">Ready to meet Aarvi?</h4>
              <p className="mt-3 text-sm">Join hundreds of early visitors who clicked through and felt the difference — 450+ clicks already.</p>
            </div>

            <div className="mt-6 flex gap-3">
              <Link href="/signup" className="bg-white text-emerald-700 px-4 py-3 rounded-lg font-semibold">Start Free</Link>
              <Link href="/pricing" className="border border-white/60 px-4 py-3 rounded-lg">Pricing</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-200 py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-bold">Truemate</div>
            <div className="text-xs text-slate-400">Built with care • Adult-free • Privacy-first</div>
          </div>

          <div className="text-sm text-slate-400">© {new Date().getFullYear()} Truemate. All rights reserved.</div>
        </div>
      </footer>
    </main>
  );
}
