import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration for project der-wegweiser
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'der-wegweiser',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'der-wegweiser.firebaseapp.com',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'der-wegweiser.firebasestorage.app',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Resilient Auth initialization (prevents startup crash if apiKey is missing in offline/local mode)
let safeAuth: any = { currentUser: null };
try {
  if (firebaseConfig.apiKey) {
    safeAuth = getAuth(app);
  }
} catch (e) {
  console.warn('[Firebase] Safe fallback: Auth initialization deferred:', e);
}
export const auth = safeAuth;

// Resilient Storage initialization
let safeStorage: any = null;
try {
  safeStorage = getStorage(app);
} catch (e) {
  console.warn('[Firebase] Safe fallback: Storage initialization deferred:', e);
}
export const storage = safeStorage;
