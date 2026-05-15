// src/app/faq/page.tsx
"use client";

import { useState } from "react";

type FAQ = {
  q: string;
  a: string;
};

const faqs: FAQ[] = [
  {
    q: "What is Truemate AI?",
    a: "Truemate AI is an AI companion platform where you can chat with intelligent personalities for conversations, advice, and fun.",
  },
  {
    q: "How many free chats do I get?",
    a: "Free users receive 30 free chats to try Truemate. After that you can upgrade to continue unlimited conversations.",
  },
  {
    q: "What do I get with Premium?",
    a: "Premium gives you unlimited chats, faster responses, and access to all AI personalities.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes. You can cancel your PayPal subscription anytime from your PayPal account.",
  },
  {
    q: "Is my chat data private?",
    a: "Yes. Your chats are private and securely processed. We do not sell personal data.",
  },
  {
    q: "How do I upgrade?",
    a: "Click the Upgrade button in the chat interface and choose a monthly or yearly plan via PayPal.",
  },
  {
    q: "What happens if I run out of free chats?",
    a: "You will be asked to upgrade to continue chatting with Truemate AI.",
  },
];

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-20">
      <div className="max-w-3xl mx-auto">

        <h1 className="text-4xl font-bold mb-6">
          Frequently Asked Questions
        </h1>

        <p className="text-white/70 mb-10">
          Everything you need to know about using Truemate AI.
        </p>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-white/10 rounded-xl p-5 bg-white/5"
            >
              <button
                className="w-full text-left flex justify-between items-center"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-semibold">{faq.q}</span>
                <span className="text-xl">
                  {open === i ? "-" : "+"}
                </span>
              </button>

              {open === i && (
                <p className="mt-3 text-white/70 text-sm">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}