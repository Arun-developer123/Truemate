/* ===================================================================
   FILE: src/app/components/ContactForm.tsx (client)
   =================================================================== */

"use client";

import { useState } from "react";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill all fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!res.ok) {
        const body: { error?: string } = await res.json();
        throw new Error(body?.error || "Failed to send message");
      }

      setSuccess("Message sent — we’ll reply within 1–2 business days.");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Something went wrong. Please try again later.");
      } else {
        setError("Something went wrong. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="sr-only">Name</label>
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="sr-only">Email</label>
        <input
          type="email"
          className="w-full rounded-md border px-3 py-2"
          placeholder="email@you.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="sr-only">Message</label>
        <textarea
          rows={6}
          className="w-full rounded-md border px-3 py-2"
          placeholder="How can we help?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">We reply within 1–2 business days.</div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send Message"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
    </form>
  );
}
