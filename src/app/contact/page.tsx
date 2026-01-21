/* ===================================================================
   FILE: src/app/contact/page.tsx
   =================================================================== */

import type { Metadata } from "next";
import ContactForm from "../components/ContactForm";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — Truemate AI",
  description: "Get in touch with the Truemate team for support, press, or partnerships.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white py-16">
      <div className="mx-auto max-w-3xl px-6">
        <nav className="mb-6 text-sm text-gray-600">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="font-medium">Contact</span>
        </nav>

        <h1 className="text-3xl font-bold text-gray-900">Contact Us</h1>
        <p className="mt-3 text-gray-700">We’re here to help — whether you need support, press assets, or partnership info.</p>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Send us a message</h3>
            <p className="mt-2 text-gray-600">Use the form and we’ll get back within 1–2 business days.</p>
            <div className="mt-4">
              <ContactForm />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">Other ways to reach us</h3>
            <ul className="mt-2 space-y-3 text-gray-700">
              <li>
                <strong>Email:</strong> <a href="mailto:bothinnovations@gmail.com" className="underline">bothinnovations@gmail.com</a>
              </li>
              <li>
                <strong>Press:</strong> <a href="mailto:bothinnovations@gmail.com" className="underline">bothinnovations@gmail.com</a>
              </li>
              <li>
                <strong>Partnerships:</strong> <a href="mailto:bothinnovations@gmail.com" className="underline">bothinnovations@gmail.com</a>
              </li>
            </ul>

            <div className="mt-6 rounded-lg border bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Prefer not to use the form? Email us directly or send a short message on our socials.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 text-sm text-gray-600">
          <p>
            For privacy-related requests (data access or deletion), please use the <Link href="/privacy" className="underline">Privacy</Link> page or email <strong>bothinnovations@gmail.com</strong>.
          </p>
        </div>
      </div>
    </main>
  );
}