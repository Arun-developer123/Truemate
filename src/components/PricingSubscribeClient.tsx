"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PricingSubscribeClient({
  plan,
}: {
  plan: "monthly" | "yearly";
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setEmail(data.user.email ?? null);
        setUserId(data.user.id ?? null);
      }
    });
  }, []);

  const handleSubscribe = async () => {
    if (!email || !userId) {
      alert("Please sign in to subscribe.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/paypal/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email, userId }),
      });

      const data = await res.json();

      if (res.ok && data.approve_url) {
        // Redirect to PayPal approval URL (approve page)
        window.location.href = data.approve_url;
      } else {
        console.error("create-sub failed", data);
        alert("Failed to start subscription. Try again or contact support.");
      }
    } catch (err) {
      console.error("subscribe error:", err);
      alert("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!email || !userId) {
    return (
      <button disabled className="px-3 py-2 rounded-xl bg-gray-300 text-gray-600">
        Login to subscribe
      </button>
    );
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
    >
      {loading ? "Opening PayPal..." : plan === "monthly" ? "Subscribe — $15/month" : "Save $40 — Get Yearly"}
    </button>
  );
}