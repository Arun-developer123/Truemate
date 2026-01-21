// ===================================================================
// FILE: src/app/privacy/page.tsx
// ===================================================================

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Truemate AI",
  description:
    "Truemate respects your privacy. Read our policy to learn what data we collect, how we use it, and how you control your information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white py-16">
      <div className="mx-auto max-w-4xl px-6">
        {/* ✅ Breadcrumbs */}
        <nav className="mb-6 text-sm text-gray-600">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="font-medium">Privacy</span>
        </nav>

        {/* ✅ Title */}
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-4 text-gray-700">
          Last updated: <strong>November 24, 2025</strong>
        </p>

        {/* ✅ Sections */}
        <section className="mt-8 space-y-8 text-gray-700">
          <div>
            <p>
              Truemate (“we”, “us”, “our”) is committed to protecting your
              privacy. This Privacy Policy explains what information we collect,
              why we collect it, and how you can manage it. Truemate is designed
              as a genuine emotional-support companion. We do not support adult
              or fantasy content and we prioritise safety and wellbeing.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              1. What we collect
            </h2>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>Account information (email, display name) when you register.</li>
              <li>
                Messages and conversation metadata necessary to provide the
                service and maintain continuity.
              </li>
              <li>
                Usage data (features used, badges earned, device info) for
                product improvements.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              2. How we use your data
            </h2>
            <p className="mt-2">
              We use data to provide and improve Truemate, personalise your
              experience (smart memory, daily challenges, badges), and to detect
              abuse or harmful activity. We may aggregate anonymised analytics
              to measure product performance and feature adoption.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              3. Data sharing & third parties
            </h2>
            <p className="mt-2">
              We never sell your personal data. We may share information with
              service providers who help run the product (hosting, analytics,
              email delivery) under strict contracts. We limit the data shared
              to the minimum necessary.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              4. Your choices
            </h2>
            <p className="mt-2">
              You can review and delete your account at any time by contacting
              us. You can also opt out of non-essential communications. For
              questions or deletion requests, use the{" "}
              <Link href="/contact" className="underline">
                contact page
              </Link>{" "}
              or email <strong>bothinnovations@gmail.com</strong>.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">5. Security</h2>
            <p className="mt-2">
              We use industry-standard security measures to protect your data in
              transit and at rest. While we work hard to keep your information
              safe, no system is 100% secure — please take care when sharing
              sensitive personal information in any chat.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">6. Children</h2>
            <p className="mt-2">
              Truemate is not intended for children under 13. We do not
              knowingly collect data from minors.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              7. Changes to this policy
            </h2>
            <p className="mt-2">
              We may update this policy occasionally. We’ll post the date of the
              latest revision and, when changes are material, notify users via
              email or in-app notice.
            </p>
          </div>
        </section>

        {/* ✅ Footer note inside privacy page */}
        <div className="pt-10 border-t mt-12 border-gray-200">
          <p className="text-sm text-gray-600">
            Questions? Contact us at{" "}
            <Link href="/contact" className="underline">
              Contact
            </Link>{" "}
            or email <strong>bothinnovations@gmail.com</strong>.
          </p>
        </div>
      </div>
    </main>
  );
}
