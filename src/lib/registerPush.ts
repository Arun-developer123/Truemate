// src/lib/registerPush.ts
import { initMessaging } from "@/lib/firebase";
import { getToken, onMessage, Messaging } from "firebase/messaging";
import { supabase } from "@/lib/supabaseClient";

// support both env names (some places expect different names)
const VAPID_KEY = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY as string | undefined)
  || (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string | undefined);

export async function registerPushForUser(userId: string): Promise<string | null> {
  try {
    console.log("[push] start registerPushForUser", { userId });
    if (!userId) { console.error("[push] missing userId"); return null; }

    if (!VAPID_KEY) {
      console.warn("[push] VAPID key not found in env (NEXT_PUBLIC_FIREBASE_VAPID_KEY or NEXT_PUBLIC_VAPID_PUBLIC_KEY)");
      // continuing, as getToken sometimes works in dev without it
    }

    const messaging: Messaging = initMessaging();

    const permission = await Notification.requestPermission();
    console.log("[push] notification permission:", permission);
    if (permission !== "granted") return null;

    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("[push] serviceWorker registered:", reg);
      } catch (swErr) {
        console.warn("[push] serviceWorker register failed:", swErr);
      }
    }

    let token: string | null = null;
    try {
      token = await getToken(messaging, { vapidKey: VAPID_KEY });
      console.log("[push] FCM token:", token);
    } catch (err) {
      console.error("[push] getToken error:", err);
      return null;
    }
    if (!token) { console.warn("[push] token is null/empty"); return null; }

    // --------- NEW: ensure users_data row exists before inserting token ---------
    const { data: userRow, error: userRowErr } = await supabase
      .from("users_data")
      .select("id")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (userRowErr) {
      console.error("[push] users_data lookup error:", userRowErr);
      return null;
    }
    if (!userRow) {
      console.warn("[push] users_data row NOT found for userId:", userId, " → skipping save to avoid FK error.");
      // still return token to caller in case they want to use it elsewhere
      return token;
    }

    // ---------- Safe DB flow: SELECT -> UPDATE or INSERT ----------
    const { data: existingRows, error: selErr } = await supabase
      .from("user_push_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "web")
      .limit(1);

    if (selErr) console.error("[push] select existing error:", selErr);

    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

    if (existing) {
      if (existing.push_token === token) {
        const { data: udata, error: uerr } = await supabase
          .from("user_push_tokens")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select();
        console.log("[push] token unchanged; updated_at result:", { udata, uerr });
      } else {
        const { data: udata, error: uerr } = await supabase
          .from("user_push_tokens")
          .update({ push_token: token, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select();
        console.log("[push] updated existing token result:", { udata, uerr });
      }
    } else {
      const { data: insData, error: insErr } = await supabase
        .from("user_push_tokens")
        .insert([
          {
            user_id: userId,
            push_token: token,
            platform: "web",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select();
      console.log("[push] insert result:", { insData, insErr });
      if (insErr) console.error("[push] insert error:", insErr);
    }

    onMessage(messaging, (payload) => console.log("[push] foreground payload:", payload));
    console.log("[push] registration finished");
    return token;
  } catch (err) {
    console.error("[push] registerPushForUser fatal:", err);
    return null;
  }
}
