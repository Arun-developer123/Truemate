import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SubscribeButton from "@/components/SubscribeButton";

type Role = "user" | "assistant" | "system";
type Message = {
  role: Role;
  content: string;
};

export default function FreeChatsManager({
  userEmail,
  userId,
  messages,
}: {
  userEmail: string | null;
  userId?: string | null;
  messages: Message[];
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 🔹 Fetch remaining (READ ONLY)
  useEffect(() => {
    if (!userId) return;

    fetch("/api/user/use-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, peek: true }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.remaining !== undefined) {
          setRemaining(d.remaining);
          if (d.remaining <= 5) setShowModal(true);
        }
      })
      .catch(() => setRemaining(30));
  }, [messages.length, userId]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="text-sm text-white/90">
          {remaining === null ? "Loading..." : `${remaining} free chats remaining`}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs px-2 py-1 rounded bg-white/90 text-gray-800 font-medium"
        >
          Upgrade
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="bg-white rounded-xl p-6 z-10 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Upgrade to continue</h3>
            <p className="text-sm mb-4">
              You have {remaining} free chats left.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <SubscribeButton
                priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!}
                email={userEmail || ""}
                userId={userId || ""}
                label="₹15 / month"
              />
              <SubscribeButton
                priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY!}
                email={userEmail || ""}
                userId={userId || ""}
                label="₹140 / year"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
