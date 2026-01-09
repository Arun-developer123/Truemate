importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Replace these with your public Firebase client config values
firebase.initializeApp({
  apiKey: 'AIzaSyBR9MDrF7nPE1Ro5zMsX9XO2jkaTTSPCbM',
  authDomain: 'truemate-a91be.firebaseapp.com',
  projectId: 'truemate-a91be',
  storageBucket: 'truemate-a91be.firebasestorage.app',
  messagingSenderId: '90950680946',
  appId: '1:90950680946:web:b3c2f2c580893d318a9deb',
  measurementId: 'G-G4TFX5HFVN'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || 'Truemate';
  const options = {
    body: notification.body || '',
    icon: notification.icon || '/icon.png',
    badge: notification.badge || '/icon.png',
    image: notification.image || undefined,
    data: {
      url: data.url || (payload && payload.fcmOptions && payload.fcmOptions.link) || '/chat',
      ...data
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/chat';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        try {
          const c = client;
          if ('focus' in c) {
            c.focus();
            // Try to navigate (some clients support navigate())
            if (typeof c.navigate === 'function') {
              c.navigate(url);
            } else {
              c.postMessage({ type: 'navigate', url });
            }
            return;
          }
        } catch (e) { /* ignore */ }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
