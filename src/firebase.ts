import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration for project der-wegweiser
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'der-wegweiser',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAH-TY9WiTKtKPWW3bTVTKZrv66D5bjro4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'der-wegweiser.firebaseapp.com',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'der-wegweiser.firebasestorage.app',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:430891513864:web:6e7dedec657640a139f9bd',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '430891513864',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-ZVRKQK2NZ8',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
