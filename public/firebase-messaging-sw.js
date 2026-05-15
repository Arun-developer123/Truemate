importScripts("https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBR9MDrF7nPE1Ro5zMsX9XO2jkaTTSPCbM",
  authDomain: "truemate-a91be.firebaseapp.com",
  projectId: "truemate-a91be",
  storageBucket: "truemate-a91be.firebasestorage.app",
  messagingSenderId: "90950680946",
  appId: "1:90950680946:web:b3c2f2c580893d318a9deb",
});

const messaging = firebase.messaging();

// ✅ DATA-ONLY HANDLER
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};

  const title = data.title || "Truemate";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.png",
    badge: data.icon || "/icon.png",
    data: {
      url: data.url || "/chat",
      ...data,
    },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/chat";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          client.focus();
          if (client.navigate) client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
