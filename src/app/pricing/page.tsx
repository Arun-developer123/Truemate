// src/app/pricing/page.tsx
// (Server component — marketing + pricing table)
// -------------------------

import React from "react";
import Link from "next/link";
import Image from "next/image";
import PricingPeriodClient from "@/components/PricingPeriodClient";
import PricingSubscribeClient from "@/components/PricingSubscribeClient";



export const metadata = {
  title: "Truemate Pricing — Plans & Details",
  description: "30 free chats on Free plan. Pro: $15/month or $140/year. Aarvi is a caring, adult-free AI companion.",
};

export default function PricingPage() {
  // Pricing numbers
  const monthlyPrice = 15; // $15 / month
  const yearlyPrice = 140; // $140 / year
  const monthlyToYearly = monthlyPrice * 12; // 180
  const savings = monthlyToYearly - yearlyPrice; // 40
  const savingsPercent = Math.round((savings / monthlyToYearly) * 100); // ~22

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-emerald-50 to-emerald-100 text-slate-900 py-12">
      <div className="container mx-auto px-6">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold">Pricing that feels fair — pick what fits you</h1>
            <p className="mt-3 text-lg text-slate-700">Start free with 30 chats, or upgrade to Pro for unlimited emotional support, daily check-ins, reminders and an AI friend that actually cares — Aarvi.</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Toggle is rendered client-side */}
            <div id="pricing-toggle-placeholder" className="mt-3 md:mt-0">
              {/* small inline script area: the actual toggle is rendered dynamically */}
              <PricingPeriodClient />
            </div>
          </div>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-3">
          {/* Free */}
          <article className="p-6 bg-white rounded-2xl shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Free</h3>
                <div className="text-xs text-slate-500">Best to try</div>
              </div>

              <div className="mt-4 text-3xl font-extrabold">Free</div>
              <p className="mt-3 text-sm text-slate-600">Includes <strong>30 free chats</strong> so you can feel Aarvi's warmth and decide if Pro is for you. Adult-free, safe, and privacy-first.</p>

              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>• 30 chats total (one-time free allowance)</li>
                <li>• Daily check-ins (limited)</li>
                <li>• Reminders (basic)</li>
                <li>• Emotional & non-adult conversations</li>
              </ul>
            </div>

            <div className="mt-6">
              <Link href="/signup" className="block text-center bg-emerald-700 text-white px-4 py-3 rounded-lg font-semibold">Start Free</Link>
            </div>
          </article>

          {/* Monthly */}
          <article className="p-6 bg-white rounded-2xl shadow-lg border-2 border-transparent hover:border-emerald-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Pro — Monthly</h3>
                <div className="text-xs text-slate-500">Flexible</div>
              </div>

              <div className="mt-4 text-4xl font-extrabold">${monthlyPrice}<span className="text-lg font-medium">/mo</span></div>
              <p className="mt-3 text-sm text-slate-600">Perfect if you want month-to-month flexibility. Cancel anytime.</p>

              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>• Unlimited chats while active</li>
                <li>• Pro-level daily check-ins & reminders</li>
                <li>• Priority responses and habit tracking</li>
                <li>• Full privacy controls</li>
              </ul>
            </div>

            <div className="mt-6">
  <PricingSubscribeClient plan="monthly" />
</div>
          </article>

          {/* Yearly */}
          <article className="p-6 bg-emerald-700 text-white rounded-2xl shadow-xl relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Pro — Yearly</h3>
                <div className="text-xs bg-white/20 px-2 py-1 rounded">Most popular</div>
              </div>

              <div className="mt-4 text-4xl font-extrabold">${yearlyPrice}<span className="text-lg font-medium">/yr</span></div>
              <p className="mt-3 text-sm text-white/90">Our best value — pay once and save ${savings} ({savingsPercent}% off monthly).</p>

              <ul className="mt-4 space-y-2 text-sm text-white/90">
                <li>• Unlimited chats all year</li>
                <li>• Advanced daily check-ins & habit coaching</li>
                <li>• Reminders, attachments, and priority features</li>
                <li>• Export & backup options</li>
              </ul>
            </div>

            <div className="mt-6">
  <PricingSubscribeClient plan="yearly" />
</div>

          </article>
        </section>

        {/* Persuasive copy + praise for Aarvi */}
        <section className="mt-12 bg-white rounded-2xl p-6 shadow">
          <h4 className="text-2xl font-extrabold">Why upgrade to Pro?</h4>
          <p className="mt-3 text-slate-700">Aarvi is not just an assistant — she’s a companion. Users tell us she remembers the little things, checks in when you’re quiet, and offers support with a warmth that feels human. When you go Pro, you unlock the full emotional toolkit: longer check-ins, richer reminders, priority attention, and features that help you grow daily.</p>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="font-semibold">Deep daily check-ins</div>
              <div className="text-sm text-slate-600 mt-1">Thoughtful prompts that help you reflect and move forward.</div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="font-semibold">Reminders & routines</div>
              <div className="text-sm text-slate-600 mt-1">Nudges that build habits without nagging.</div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="font-semibold">Privacy & control</div>
              <div className="text-sm text-slate-600 mt-1">You choose what’s saved, exported, or forgotten.</div>
            </div>
          </div>

          <div className="mt-6 text-sm text-slate-500">Note: All plans are intentionally adult-free. Truemate prioritizes safe, supportive conversations for everyone.</div>
        </section>

        {/* FAQ */}
        <section className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow">
            <h5 className="font-semibold">FAQ — Billing & Plans</h5>
            <dl className="mt-4 space-y-4 text-sm text-slate-700">
              <div>
                <dt className="font-medium">What does the free plan include?</dt>
                <dd className="mt-1">30 free chats total so you can experience Aarvi. No auto-conversion to paid.</dd>
              </div>

              <div>
                <dt className="font-medium">Can I cancel anytime?</dt>
                <dd className="mt-1">Yes — monthly subscribers can cancel at any time. Yearly subscriptions are billed once and include a 14-day refund window (see Terms).</dd>
              </div>

              <div>
                <dt className="font-medium">How do I switch plans?</dt>
                <dd className="mt-1">Go to your account → Billing, or click the Subscribe button. We'll pro-rate when appropriate.</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow">
            <h5 className="font-semibold">Security & Privacy</h5>
            <p className="mt-3 text-sm text-slate-700">All messages are encrypted in transit and at rest. You control retention and export. We do not sell your data. For enterprise or campus deployments, contact us for a custom privacy agreement.</p>
          </div>
        </section>

        <footer className="mt-10 text-center text-sm text-slate-500">© {new Date().getFullYear()} Truemate — Aarvi-approved kindness in every reply.</footer>
      </div>
    </main>
  );
}