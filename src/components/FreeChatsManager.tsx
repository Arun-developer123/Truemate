// C:\Users\aruna\truemate\src\components\FreeChatsManager.tsx
import React, { useEffect, useState } from "react";

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
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "yearly" | null>(null);

  // 🔥 REALTIME SYNC FROM PARENT (chat page)
  useEffect(() => {
    if (externalRemaining !== undefined) {
      setRemaining(externalRemaining);

      if (typeof externalRemaining === "number" && externalRemaining <= 5) {
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
      .catch((err: any) => {
        // If fetch was aborted (cleanup), ignore silently.
        if (err && (err.name === "AbortError" || err?.message === "The user aborted a request.")) {
          return;
        }

        console.error("use-chat peek failed:", err);
        setRemaining(undefined);
      });

    return () => controller.abort();
  }, [userId, externalRemaining]);

  // 🔹 Text to show in header
  const remainingText =
    remaining === undefined ? "Loading..." : remaining === null ? "Unlimited chats (Subscribed)" : `${remaining} free chats remaining`;

  // Fallback hosted links (only used if server fails) — safe to keep but we prefer create-subscription flow
  const PAYPAL_MONTHLY_LINK = process.env.NEXT_PUBLIC_PAYPAL_MONTHLY_LINK || "https://www.paypal.com/";
  const PAYPAL_YEARLY_LINK = process.env.NEXT_PUBLIC_PAYPAL_YEARLY_LINK || "https://www.paypal.com/";

  // New: call server to create a PayPal subscription and redirect to approve url
  const handleSubscribe = async (plan: "monthly" | "yearly") => {
    if (!userEmail) {
      alert("Please sign in to subscribe.");
      return;
    }

    try {
      setLoadingPlan(plan);
      const res = await fetch("/api/paypal/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email: userEmail }),
      });

      const data = await res.json();

      if (res.ok && data.approve_url) {
        // redirect user to PayPal approval page
        window.location.href = data.approve_url;
      } else {
        console.error("create-sub failed", data);
        // fallback to hosted link if present
        const fallback = plan === "monthly" ? PAYPAL_MONTHLY_LINK : PAYPAL_YEARLY_LINK;
        if (fallback && fallback.includes("paypal.com")) {
          const tryFallback = confirm(
            "Could not start subscription automatically. Try the PayPal hosted link instead?"
          );
          if (tryFallback) window.open(fallback, "_blank", "noreferrer");
        } else {
          alert("Failed to start subscription. Try again or contact support.");
        }
      }
    } catch (err) {
      console.error("subscribe error:", err);
      alert("Network error. Try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="text-sm text-white/90">{remainingText}</div>

        {/* Upgrade button: curved corners, yellow background, black text */}
        {remaining !== null && (
          <button
            onClick={() => setShowModal(true)}
            className="text-xs px-3 py-1 rounded-xl bg-yellow-400 text-black font-medium shadow-sm hover:brightness-95 transition"
            title="Upgrade"
          >
            Upgrade
          </button>
        )}
      </div>

      {/* 🔹 Upgrade Modal (FREE USERS ONLY) */}
      {showModal && remaining !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />

          <div className="bg-white rounded-xl p-6 z-10 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Upgrade to continue</h3>

            <p className="text-sm mb-4">
              You have <b>{String(remaining)}</b> free chats left.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSubscribe("monthly")}
                disabled={loadingPlan !== null}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:brightness-95 transition text-center disabled:opacity-60"
                title="Pay monthly via PayPal"
              >
                {loadingPlan === "monthly" ? "Opening PayPal..." : "$15 / month"}
              </button>

              <button
                onClick={() => handleSubscribe("yearly")}
                disabled={loadingPlan !== null}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:brightness-95 transition text-center disabled:opacity-60"
                title="Pay yearly via PayPal"
              >
                {loadingPlan === "yearly" ? "Opening PayPal..." : "$140 / year"}
              </button>
            </div>

            <div className="mt-4 text-xs text-slate-600">
              Tip: After approving the subscription on PayPal, the webhook will update your account automatically.
            </div>

            <div className="mt-4 text-right">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1 text-sm rounded-md bg-gray-100 hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}