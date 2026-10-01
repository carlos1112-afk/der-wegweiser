import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAI, GoogleAIBackend } from 'firebase/ai';

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

// Auth initialization — no fake stand-in object. Wenn kein apiKey vorhanden ist
// (z.B. CI-Build ohne injizierte VITE_FIREBASE_API_KEY), bleibt `auth` explizit
// `null` statt eines Mock-Objekts mit `currentUser: null`, das echte Firebase-Auth
// vortäuschen würde. AuthService prüft `!auth || !auth.app` vor jedem Sign-In und
// wirft dann einen echten, sichtbaren Fehler statt eines stillen No-Ops.
let realAuth: ReturnType<typeof getAuth> | null = null;
if (firebaseConfig.apiKey) {
  try {
    realAuth = getAuth(app);
  } catch (e) {
    console.error('[Firebase] Auth-Initialisierung fehlgeschlagen trotz vorhandenem apiKey:', e);
  }
} else {
  console.error(
    '[Firebase] VITE_FIREBASE_API_KEY fehlt — Auth ist deaktiviert. ' +
    'Bei einem Production-Build bedeutet das: GitHub Actions hat die VITE_FIREBASE_*-Secrets ' +
    'nicht in den Build-Step injiziert (siehe .github/workflows/deploy.yml).'
  );
}
export const auth = realAuth;

// Resilient Storage initialization
let safeStorage: ReturnType<typeof getStorage> | null = null;
try {
  safeStorage = getStorage(app);
} catch (e) {
  console.warn('[Firebase] Safe fallback: Storage initialization deferred:', e);
}
export const storage = safeStorage;

// Firebase AI Logic (Gemini Developer API via Firebase — kein eigener Client-API-Key,
// kein separater Backend-Proxy nötig). Siehe AGENTS.md: "In-App Co-Pilot" nutzt
// explizit "Firebase AI Logic" als Framework.
let realAi: ReturnType<typeof getAI> | null = null;
try {
  realAi = getAI(app, { backend: new GoogleAIBackend() });
} catch (e) {
  console.error('[Firebase] AI-Logic-Initialisierung fehlgeschlagen:', e);
}
export const ai = realAi;
