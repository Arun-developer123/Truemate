// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// === IMPORTANT: Use your Firebase project public config here ===
// These are public client config values (safe to include in the SW).
// Replace values below with those from your Firebase console / .env (NEXT_PUBLIC_...).
firebase.initializeApp({
  apiKey: 'AIzaSyBR9MDrF7nPE1Ro5zMsX9XO2jkaTTSPCbM',
  authDomain: 'truemate-a91be.firebaseapp.com',
  projectId: 'truemate-a91be',             // <-- THIS MUST BE PRESENT
  storageBucket: 'truemate-a91be.firebasestorage.app',
  messagingSenderId: '90950680946',
  appId: '1:90950680946:web:b3c2f2c580893d318a9deb',
  measurementId: 'G-G4TFX5HFVN'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = (payload && payload.notification && payload.notification.title) || 'Truemate';
  const options = {
    body: (payload && payload.notification && payload.notification.body) || 'You have a new message',
    icon: '/icon.png',
    badge: '/icon.png',
    data: payload && payload.data ? payload.data : {}
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/chat';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
