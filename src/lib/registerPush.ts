// src/lib/registerPush.ts
import { initMessaging } from "@/lib/firebase";
import { getToken, onMessage, Messaging } from "firebase/messaging";
import { supabase } from "@/lib/supabaseClient";

// Public VAPID key (Firebase Web Push)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY as string | undefined;

/**
 * Safe registerPushForUser (no upsert, robust)
 *
 * Flow:
 *  - requests notification permission
 *  - registers service worker
 *  - gets FCM token
 *  - SELECT existing (user_id + platform)
 *    -> if exists and token unchanged: update updated_at
 *    -> if exists and token changed: update push_token
 *    -> if not exists: insert new row
 */
export async function registerPushForUser(userId: string): Promise<string | null> {
  try {
    console.log("[push] start registerPushForUser", { userId });

    if (!userId) {
      console.error("[push] missing userId");
      return null;
    }

    // Warn if VAPID missing but continue because getToken sometimes works without it in dev
    if (!VAPID_KEY) {
      console.warn("[push] missing NEXT_PUBLIC_FIREBASE_VAPID_KEY (VAPID_KEY). Continuing but check env.");
    }

    // Init Firebase Messaging
    const messaging: Messaging = initMessaging();

    // Ask notification permission
    const permission = await Notification.requestPermission();
    console.log("[push] notification permission:", permission);
    if (permission !== "granted") {
      console.warn("[push] notification permission not granted");
      return null;
    }

    // Register Service Worker at root
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("[push] serviceWorker registered:", reg);
      } catch (swErr) {
        console.warn("[push] serviceWorker register failed (may be already registered):", swErr);
      }
    } else {
      console.warn("[push] serviceWorker not supported in this browser");
    }

    // Get FCM token
    let token: string | null = null;
    try {
      token = await getToken(messaging, { vapidKey: VAPID_KEY });
      console.log("[push] FCM token:", token);
    } catch (err) {
      console.error("[push] getToken error:", err);
      return null;
    }

    if (!token) {
      console.warn("[push] token is null or empty");
      return null;
    }

    // ---------- Safe DB flow: SELECT -> UPDATE or INSERT ----------
    const { data: existingRows, error: selErr } = await supabase
      .from("user_push_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "web")
      .limit(1);

    if (selErr) {
      console.error("[push] select existing error:", selErr);
      // We'll still attempt insert below if no existing found
    }

    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

    if (existing) {
      // If token unchanged, just update updated_at and skip heavy ops
      if (existing.push_token === token) {
        const { data: udata, error: uerr } = await supabase
          .from("user_push_tokens")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select();
        console.log("[push] token unchanged; updated_at result:", { udata, uerr });
      } else {
        // token changed -> update record by id
        const { data: udata, error: uerr } = await supabase
          .from("user_push_tokens")
          .update({ push_token: token, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select();
        console.log("[push] updated existing token result:", { udata, uerr });
        if (uerr) {
          console.error("[push] update error:", uerr);
          // Fall through to insert attempt if update is blocked
          // (rare, but ensures we don't silently fail)
          try {
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
            console.log("[push] insert fallback after update error:", { insData, insErr });
          } catch (e) {
            console.error("[push] insert fallback fatal:", e);
          }
        }
      }
    } else {
      // No existing row: insert new
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
      if (insErr) {
        console.error("[push] insert error:", insErr);
      }
    }

    // Foreground message handler
    onMessage(messaging, (payload) => console.log("[push] foreground payload:", payload));

    console.log("[push] registration finished");
    return token;
  } catch (err) {
    console.error("[push] registerPushForUser fatal:", err);
    return null;
  }
}
