import React, { useEffect, useState } from "react";
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
  remaining: externalRemaining, // 🔥 parent se aane wala realtime remaining
}: {
  userEmail: string | null;
  userId?: string | null;
  messages: Message[];
  remaining?: number | null;
}) {
  /**
   * remaining meanings:
   * null       -> unlimited (subscribed)
   * number     -> free chats remaining
   * undefined  -> still loading
   */
  const [remaining, setRemaining] = useState<number | null | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);

  // 🔥 REALTIME SYNC FROM PARENT (chat page)
  useEffect(() => {
    if (externalRemaining !== undefined) {
      setRemaining(externalRemaining);

      if (
        typeof externalRemaining === "number" &&
        externalRemaining <= 5
      ) {
        setShowModal(true);
      }
    }
  }, [externalRemaining]);

  // 🔹 Peek API (READ ONLY) → only for first load / fallback
  useEffect(() => {
    if (!userId) return;

    // 🔒 agar parent already truth de raha hai, peek skip
    if (externalRemaining !== undefined) return;

    const controller = new AbortController();

    fetch("/api/user/use-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, peek: true }),
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((d) => {
        // 🟢 Subscribed user → unlimited
        if (d.remaining === null) {
          setRemaining(null);
          return;
        }

        // 🟢 Free user
        if (typeof d.remaining === "number") {
          setRemaining(d.remaining);

          if (d.remaining <= 5) {
            setShowModal(true);
          }
        }
      })
      .catch((err) => {
        console.error("use-chat peek failed:", err);
        setRemaining(undefined);
      });

    return () => controller.abort();
  }, [userId, externalRemaining]);

  // 🔹 Text to show in header
  const remainingText =
    remaining === undefined
      ? "Loading..."
      : remaining === null
      ? "Unlimited chats (Subscribed)"
      : `${remaining} free chats remaining`;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="text-sm text-white/90">
          {remainingText}
        </div>

        {/* Upgrade button hidden for subscribed users */}
        {remaining !== null && (
          <button
            onClick={() => setShowModal(true)}
            className="text-xs px-2 py-1 rounded bg-white/90 text-gray-800 font-medium"
          >
            Upgrade
          </button>
        )}
      </div>

      {/* 🔹 Upgrade Modal (FREE USERS ONLY) */}
      {showModal && remaining !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />

          <div className="bg-white rounded-xl p-6 z-10 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">
              Upgrade to continue
            </h3>

            <p className="text-sm mb-4">
              You have <b>{remaining}</b> free chats left.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <SubscribeButton
                priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!}
                email={userEmail || ""}
                userId={userId || ""}
                label="$15 / month"
              />
              <SubscribeButton
                priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY!}
                email={userEmail || ""}
                userId={userId || ""}
                label="$140 / year"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
