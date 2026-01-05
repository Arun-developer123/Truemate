// src/lib/firebase.ts
import { initializeApp, FirebaseApp, getApps } from "firebase/app";
import { getMessaging, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Keep a typed app reference so TS is happy
let app: FirebaseApp | null = null;

export function initFirebase(): FirebaseApp {
  // If running in an environment where firebase may already be initialized (HMR / dev),
  // prefer existing app instance.
  if (!app) {
    if (getApps().length > 0) {
      app = getApps()[0];
    } else {
      app = initializeApp(firebaseConfig);
    }
  }
  return app;
}

export function initMessaging(): Messaging {
  const application = initFirebase();
  return getMessaging(application);
}
