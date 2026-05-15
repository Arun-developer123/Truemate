"use client";
import React from "react";

export default function SubscribeButton({
  priceId,
  email,
  userId,
  label,
}: {
  priceId: string;
  email: string;
  userId: string;
  label: string;
}) {
  async function onClick() {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          email,
          userId,
          // success/cancel optional; Stripe will redirect to these if provided
          successUrl: window.location.origin + "/home?checkout=success&session_id={CHECKOUT_SESSION_ID}",
          cancelUrl: window.location.origin + "/home?checkout=cancel",
        }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert(data?.error || "Checkout failed — check console.");
        console.error("checkout error", data);
      }
    } catch (e) {
      console.error("checkout network error", e);
      alert("Network error. Try again.");
    }
  }

  return (
    <button
      onClick={onClick}
      className="px-3 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl shadow hover:scale-105 transition-transform"
      title={label}
    >
      {label}
    </button>
  );
}
