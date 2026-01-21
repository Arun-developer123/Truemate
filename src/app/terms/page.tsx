/* ===================================================================
   FILE: src/app/terms/page.tsx
   =================================================================== */

import type { Metadata as Meta } from "next";
import Link from "next/link";

export const metadata: Meta = {
  title: "Terms of Service — Truemate AI",
  description: "The Terms of Service for using Truemate. Please read carefully.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white py-16">
      <div className="mx-auto max-w-4xl px-6">
        <nav className="mb-6 text-sm text-gray-600">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="font-medium">Terms</span>
        </nav>

        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-4 text-gray-700">Last updated: <strong>November 24, 2025</strong></p>

        <section className="mt-8 space-y-6 text-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">1. Acceptance</h2>
            <p className="mt-2">
              By using Truemate, you agree to these Terms. If you don’t agree, please don’t use the service. These terms
              explain what you can expect from Truemate and what we expect from you.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">2. Service description</h2>
            <p className="mt-2">
              Truemate is a proactive AI companion focused on emotional support, habit-building, and light micro-games.
              We block adult/fantasy content and prioritise user safety and wellbeing.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">3. User responsibilities</h2>
            <p className="mt-2">
              Use Truemate respectfully. Don’t attempt to bypass safety filters, upload illegal content, or impersonate
              others. You are responsible for the content you share and for keeping your account secure.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">4. Account suspension & termination</h2>
            <p className="mt-2">
              We may suspend or terminate accounts that violate these Terms or engage in harmful behaviour. We’ll provide
              notice when feasible.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">5. Intellectual property</h2>
            <p className="mt-2">
              Truemate and its content are owned by Truemate AI. You may use the service for personal, non-commercial
              use unless otherwise agreed.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">6. Disclaimers & limitation of liability</h2>
            <p className="mt-2">
              Truemate is a companion and not a substitute for professional medical, legal, or financial advice. We are
              not liable for indirect or incidental damages arising from use of the service to the fullest extent
              permitted by law.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">7. Changes to terms</h2>
            <p className="mt-2">
              We may update these Terms occasionally. Continued use of Truemate after updates means you accept the
              updated Terms. We’ll notify users of material changes when possible.
            </p>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Questions? Visit <Link href="/contact" className="underline">Contact</Link> or email <strong>bothinnovations@gmail.com</strong>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}