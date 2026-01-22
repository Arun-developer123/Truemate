// src/lib/pushClient.ts

// ✅ Type guard (narrows to string)
function hasValidVapidKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    key.length > 0 &&
    /^[A-Za-z0-9\-_]+$/.test(key)
  );
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorkerAndSubscribe(
  vapidPublicKey: string | undefined,
  email: string
) {
  // 🛑 Browser support guard
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push not supported in this browser");
    return null;
  }

  // 🛑 Type-safe VAPID check
  if (!hasValidVapidKey(vapidPublicKey)) {
    console.warn("Invalid or missing VAPID public key. Skipping push subscribe.");
    return null;
  }

  try {
    // 1️⃣ Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js");

    // 2️⃣ Get or create subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey), // ✅ TS now knows it's string
      });
    }

    // 3️⃣ Send subscription to backend
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, email }),
    });

    return subscription;
  } catch (err) {
    console.error("Push subscribe failed:", err);
    return null;
  }
}
