import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UILayoutProvider } from './contexts/UILayoutContext';

function unregisterLegacyServiceWorkers(): void {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

function registerServiceWorker(): void {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
  });
}

function initializeServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (Capacitor.isNativePlatform()) {
    unregisterLegacyServiceWorkers();
  } else {
    registerServiceWorker();
  }
}

initializeServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <UILayoutProvider>
        <App />
      </UILayoutProvider>
    </ErrorBoundary>
  </StrictMode>,
);
