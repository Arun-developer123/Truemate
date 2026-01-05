// src/lib/registerPush.ts
import { initMessaging } from "@/lib/firebase";
import { getToken, onMessage, Messaging } from "firebase/messaging";
import { supabase } from "@/lib/supabaseClient"; // adjust path if needed

// Ensure environment variable typing - may be undefined in some envs
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY as string | undefined;

/**
 * Register push for a signed-in user and save the FCM token to Supabase.
 * Returns the token string or null on failure.
 */
export async function registerPushForUser(userId: string): Promise<string | null> {
  try {
    if (!VAPID_KEY) {
      console.warn("Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY in env. Push registration skipped.");
      return null;
    }

    const messaging: Messaging = initMessaging();

    // Ask permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    // Register service worker at root (ensure /firebase-messaging-sw.js exists)
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      } catch (swErr) {
        console.warn("Service worker registration failed", swErr);
        // continue — getToken may still work if sw already registered
      }
    }

    // Get FCM token (vapidKey required for web)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return null;

    // Upsert token into Supabase (pass array and onConflict as comma-separated string)
    const upsertRow = [
      {
        user_id: userId,
        push_token: token,
        platform: "web",
        updated_at: new Date().toISOString(),
      },
    ];

    const { error } = await supabase
      .from("user_push_tokens")
      .upsert(upsertRow, { onConflict: "user_id,push_token" });

    if (error) {
      console.error("Failed to save push token", error);
      return null;
    }

    // Handle foreground messages (app open)
    onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      // Show in-app toast or update local state here
    });

    return token;
  } catch (err) {
    console.error("registerPushForUser error", err);
    return null;
  }
}
