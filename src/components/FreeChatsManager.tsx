import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SubscribeButton from "@/components/SubscribeButton";

// --- Types (keep in sync with your HomePage Message type) ---
type Role = "user" | "assistant" | "system";
type Message = {
  role: Role;
  content: string;
  created_at?: string;
  proactive?: boolean;
  scheduled_message_id?: string;
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
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [level10Shown, setLevel10Shown] = useState(false);
  const [level5Shown, setLevel5Shown] = useState(false);
  const prevUserCountRef = useRef<number>(0);

  // convenience: count how many user messages exist (only messages in-memory)
  const countUserMessages = (arr: Message[]) => arr.filter((m) => m.role === "user").length;

  // fetch remaining from DB on mount and when userEmail changes
  useEffect(() => {
    if (!userEmail) return;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.from("users_data").select("free_chats_remaining").eq("email", userEmail).maybeSingle();
        if (error) throw error;
        const r = (data?.free_chats_remaining ?? 30) as number;
        setRemaining(r);
      } catch (e) {
        console.warn("FreeChatsManager: failed to fetch remaining", e);
        setRemaining(30);
      } finally {
        setLoading(false);
      }
    })();
  }, [userEmail]);

  // initialize prevUserCountRef when messages or remaining loads
  useEffect(() => {
    prevUserCountRef.current = countUserMessages(messages);
  }, [messages.length]);

  // When messages change, detect new user messages and consume free chats in DB
  useEffect(() => {
    if (!userEmail) return;
    const newCount = countUserMessages(messages);
    const prev = prevUserCountRef.current;
    const delta = newCount - prev;
    if (delta > 0) {
      // optimistic local adjust
      setRemaining((r) => (r === null ? null : Math.max(0, r - delta)));
      // attempt to decrement in DB safely
      consumeFreeChats(delta).catch((e) => console.warn("consumeFreeChats failed:", e));
    }
    prevUserCountRef.current = newCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Show modal/banner when thresholds crossed
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 5 && !level5Shown) {
      setShowModal(true);
      setLevel5Shown(true);
    } else if (remaining <= 10 && !level10Shown) {
      // show softer prompt (non-blocking)
      setShowModal(true);
      setLevel10Shown(true);
    }
  }, [remaining, level10Shown, level5Shown]);

  async function consumeFreeChats(n: number) {
    if (!userEmail) return;
    try {
      // fetch latest value server-side to avoid races
      const { data, error } = await supabase.from("users_data").select("free_chats_remaining").eq("email", userEmail).maybeSingle();
      if (error) throw error;
      const current = (data?.free_chats_remaining ?? 30) as number;
      const next = Math.max(0, current - n);
      const upd = await supabase.from("users_data").update({ free_chats_remaining: next, updated_at: new Date().toISOString() }).eq("email", userEmail);
      if (upd.error) console.warn("FreeChatsManager: update failed", upd.error);
      setRemaining(next);
    } catch (e) {
      console.warn("FreeChatsManager.consumeFreeChats error", e);
    }
  }

  const openUpgrade = () => setShowModal(true);
  const closeUpgrade = () => setShowModal(false);

  return (
    <div className="w-full">
      {/* Inline compact banner - place this where you want (e.g., header area) */}
      <div className="flex items-center gap-3">
        <div className="text-sm text-white/90">{remaining !== null ? `${remaining} free chats remaining` : "Loading free chats..."}</div>
        <button onClick={openUpgrade} className="text-xs px-2 py-1 rounded bg-white/90 text-gray-800 font-medium shadow">
          Upgrade
        </button>
      </div>

      {/* Modal: Upgrade (ChatGPT-style two choices) */}
      {showModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeUpgrade} />
          <div className="relative z-10 max-w-md w-full bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Upgrade to continue chatting</h3>
                <p className="text-sm text-gray-600 mt-1">You have {remaining} free chat{remaining === 1 ? "" : "s"} left. Choose a plan to remove limits.</p>
              </div>
              <button onClick={closeUpgrade} className="text-gray-500 rounded hover:bg-gray-100 p-1">
                ×
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              {/* Monthly */}
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-semibold">$15</div>
                <div className="text-xs text-gray-500">per month</div>
                <div className="mt-3 text-sm">Best if you're trying us out</div>
                <div className="mt-4">
                  <SubscribeButton
                    priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || "PRICE_MONTHLY_ID"}
                    email={userEmail || ""}
                    userId={userId || ""}
                    label="Subscribe $15/mo"
                  />
                </div>
              </div>

              {/* Yearly */}
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-semibold">$140</div>
                <div className="text-xs text-gray-500">per year</div>
                <div className="mt-3 text-sm">Great value — save across the year</div>
                <div className="mt-4">
                  <SubscribeButton
                    priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || "PRICE_YEARLY_ID"}
                    email={userEmail || ""}
                    userId={userId || ""}
                    label="Subscribe $140/yr"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500 text-center">By upgrading you won't lose your existing chats — credits apply immediately.</div>
          </div>
        </div>
      )}
    </div>
  );
}
