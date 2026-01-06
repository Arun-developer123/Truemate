// src/lib/registerPush.ts
import { initMessaging } from "@/lib/firebase";
import { getToken, onMessage, Messaging } from "firebase/messaging";
import { supabase } from "@/lib/supabaseClient";

// Public VAPID key (Firebase Web Push)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY as string | undefined;

/**
 * Register push notifications for a signed-in user
 * - Requests permission
 * - Registers service worker
 * - Gets FCM token
 * - Saves token to Supabase
 */
export async function registerPushForUser(userId: string): Promise<string | null> {
  try {
    console.log("[push] start registerPushForUser", { userId });

    if (!userId) {
      console.error("[push] missing userId");
      return null;
    }

    if (!VAPID_KEY) {
      console.error("[push] missing NEXT_PUBLIC_FIREBASE_VAPID_KEY");
      return null;
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

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("[push] service worker registered:", reg);
      } catch (swErr) {
        console.warn("[push] service worker registration failed:", swErr);
      }
    } else {
      console.warn("[push] serviceWorker not supported");
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

    // Save token to Supabase (upsert)
    const upsertRow = [
      {
        user_id: userId,
        push_token: token,
        platform: "web",
        updated_at: new Date().toISOString(),
      },
    ];

    const { data, error } = await supabase
      .from("user_push_tokens")
      .upsert(upsertRow, { onConflict: "user_id,push_token" })
      .select();

    console.log("[push] upsert result:", { data, error });

    // Fallback insert (safety)
    if (error) {
      console.warn("[push] upsert failed, trying insert fallback");

      const { data: insData, error: insErr } = await supabase
        .from("user_push_tokens")
        .insert([
          {
            user_id: userId,
            push_token: token,
            platform: "web",
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      console.log("[push] insert fallback result:", { insData, insErr });

      if (insErr) return null;
    }

    // Foreground message handler
    onMessage(messaging, (payload) => {
      console.log("[push] foreground message:", payload);
    });

    console.log("[push] registration successful");
    return token;
  } catch (err) {
    console.error("[push] registerPushForUser fatal error:", err);
    return null;
  }
}
