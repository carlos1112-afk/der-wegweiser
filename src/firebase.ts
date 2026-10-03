import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const env = (import.meta as any)?.env || {};

// Firebase configuration for project der-wegweiser
const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'der-wegweiser',
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'der-wegweiser.firebaseapp.com',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'der-wegweiser.firebasestorage.app',
  appId: env.VITE_FIREBASE_APP_ID || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
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
// Resilient Functions initialization
let safeFunctions: any = null;
try {
  safeFunctions = getFunctions(app, 'europe-west3');
} catch (e) {
  console.warn('[Firebase] Safe fallback: Functions initialization deferred:', e);
}
export const functions = safeFunctions;
