import type { FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import { setAppCheckInstance } from './services/PremiumKeyService';

type Env = Record<string, string | undefined>;

export function initAppCheck(app: FirebaseApp, env: Env, isDev: boolean): AppCheck | null {
  const siteKey = env.VITE_APPCHECK_SITE_KEY;
  if (!siteKey || !app.options.appId) return null;

  if (isDev) {
    (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }

  try {
    const provider = env.VITE_APPCHECK_PROVIDER === 'enterprise'
      ? new ReCaptchaEnterpriseProvider(siteKey)
      : new ReCaptchaV3Provider(siteKey);
    const instance = initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
    setAppCheckInstance(instance);
    return instance;
  } catch (e) {
    console.warn('[AppCheck] Initialisierung fehlgeschlagen:', e);
    return null;
  }
}
