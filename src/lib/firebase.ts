import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (useEmulators ? 'demo-key' : ''),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (useEmulators ? 'demo-callerlog' : ''),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (useEmulators ? 'demo-app' : ''),
};

/** Ohne Firebase-Werte gibt es keinen Betrieb – Caller Log hat bewusst keinen Demo-Modus. */
export const firebaseConfigured = config.apiKey !== '' && config.projectId !== '' && config.appId !== '';
export const firebaseProjectId = config.projectId;

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: FirebaseServices | null = null;

export function getFirebase(): FirebaseServices {
  if (!firebaseConfigured) throw new Error('Firebase ist nicht konfiguriert (.env fehlt).');
  if (services === null) {
    const app = initializeApp(config);
    const auth = getAuth(app);
    // Lokaler Zwischenspeicher: schneller Start und Weiterarbeiten bei kurzem Netzausfall.
    // Maßgeblich bleibt Firestore – der Speicher gleicht sich beim Wiederverbinden ab.
    const db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (useEmulators) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    services = { app, auth, db };
  }
  return services;
}
