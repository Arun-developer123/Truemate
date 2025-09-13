// src/lib/pushClient.ts
export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function registerServiceWorkerAndSubscribe(vapidPublicKey: string, email: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push messaging not supported");
    return null;
  }

  try {
    // 1) register service worker
    const registration = await navigator.serviceWorker.register("/sw.js");
    // 2) get existing subscription if exists
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    // 3) send subscription to server
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, email }),
    });

    return subscription;
  } catch (err) {
    console.error("subscribe failed", err);
    return null;
  }
}
