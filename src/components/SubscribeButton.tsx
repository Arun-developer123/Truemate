// components/SubscribeButton.tsx
import React from "react";

export default function SubscribeButton({ priceId, email, userId, label }: { priceId: string; email: string; userId: string; label: string }) {
  async function onClick() {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceId,
        email,
        userId,
        successUrl: window.location.origin + "/home?checkout=success&session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: window.location.origin + "/home?checkout=cancel",
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert("Checkout failed");
  }

  return <button onClick={onClick}>{label}</button>;
}
