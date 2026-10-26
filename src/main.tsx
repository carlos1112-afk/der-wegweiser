import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import './i18n/config';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UILayoutProvider } from './contexts/UILayoutContext';
import { logger } from './utils/logger';

// Register Service Worker only for browser PWA mode, NEVER in native Capacitor mobile apps!
// In native Android/iOS, Capacitor serves local assets directly from the APK/IPA container.
if ('serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    // In native WebView: Unregister any legacy service workers to prevent stale asset cache locks
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  } else {
    // In standard web browser: Register SW for offline PWA capabilities
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => logger.log('[PWA] Service Worker registered:', reg.scope))
        .catch((err) => logger.warn('[PWA] Service Worker registration failed:', err));
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <UILayoutProvider>
        <App />
      </UILayoutProvider>
    </ErrorBoundary>
  </StrictMode>,
);
import './i18n/config';
