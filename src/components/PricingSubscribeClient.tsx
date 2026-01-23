"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SubscribeButton from "@/components/SubscribeButton";

export default function PricingSubscribeClient({
  plan,
}: {
  plan: "monthly" | "yearly";
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const PRICE_IDS = {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!,
    yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY!,
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setEmail(data.user.email!);
        setUserId(data.user.id);
      }
    });
  }, []);

  if (!email || !userId) {
    return (
      <button
        disabled
        className="px-3 py-2 rounded-xl bg-gray-300 text-gray-600"
      >
        Login to subscribe
      </button>
    );
  }

  return (
    <SubscribeButton
      priceId={PRICE_IDS[plan]}
      email={email}
      userId={userId}
      label={
        plan === "monthly"
          ? "Subscribe — $15/month"
          : "Save $40 — Get Yearly"
      }
    />
  );
}
