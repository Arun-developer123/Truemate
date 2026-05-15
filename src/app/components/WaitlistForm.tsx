"use client";
import { useState } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch("/api/waitlist", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setStatus("success");
      setEmail("");
    } else {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        className="border rounded-xl px-4 py-2 w-72"
      />
      <button
        type="submit"
        className="bg-purple-600 text-white px-5 py-2 rounded-xl hover:bg-purple-700 transition"
      >
        Join Waitlist
      </button>
      {status === "success" && <p className="text-green-600">You’re in!</p>}
      {status === "error" && <p className="text-red-600">Something went wrong.</p>}
    </form>
  );
}
