// Key broker for premium map features.
// Production: calls a Firebase Function that verifies subscription and issues
// a short-lived Google Maps key (hours TTL, instance-bound, rate-limited).
// Dev fallback: reads VITE_GOOGLE_MAPS_API_KEY from env.
//
// TODO (separate task): implement Firebase Function `issueGoogleMapsKey` with:
//   - Firebase Auth check (valid UID with active subscription in Firestore)
//   - Rate limit: max N key requests per hour per UID (Firestore counter + TTL doc)
//   - Instance binding: include Capacitor/Web installation ID in signed response
//   - Short TTL: key valid for 6 hours, app fetches fresh key on startup

import type { AppCheck } from 'firebase/app-check';
import { getToken } from 'firebase/app-check';

/** Error surfaced directly to the user (localised message, no stack trace). */
export class UserFacingError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'UserFacingError';
    this.code = code;
  }
}

/**
 * Register the Firebase App Check instance so this service can attach an
 * instance-bound Bearer token to each key request.
 * Call this once during app initialisation after `initializeAppCheck()`.
 */
let _appCheckInstance: AppCheck | null = null;
export function setAppCheckInstance(instance: AppCheck): void {
  _appCheckInstance = instance;
}

// --- Client-side rate limiter (max 5 requests per minute per app instance) ---
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const rateLimitTimestamps: number[] = [];

function checkRateLimit(): void {
  const now = Date.now();
  // Remove timestamps older than the window
  while (
    rateLimitTimestamps.length > 0 &&
    now - rateLimitTimestamps[0] > RATE_LIMIT_WINDOW_MS
  ) {
    rateLimitTimestamps.shift();
  }
  if (rateLimitTimestamps.length >= RATE_LIMIT_MAX) {
    throw new UserFacingError(
      'Zu viele Schlüsselanforderungen. Bitte warte eine Minute.',
      'RATE_LIMIT_EXCEEDED',
    );
  }
  rateLimitTimestamps.push(now);
}

let cachedKey: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min local cache before re-fetching

/** Calls the Firebase Function to obtain a short-lived Google Maps API key. */
async function issueGoogleMapsKey(): Promise<string> {
  const functionsUrl = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL as
    | string
    | undefined;
  if (!functionsUrl) {
    throw new UserFacingError(
      'Firebase Functions URL ist nicht konfiguriert (VITE_FIREBASE_FUNCTIONS_URL fehlt).',
      'MISSING_FUNCTIONS_URL',
    );
  }

  // Client-side rate limit check
  checkRateLimit();

  // Obtain Firebase App Check token for instance binding (Bearer schema)
  let appCheckToken: string | null = null;
  if (_appCheckInstance) {
    try {
      const tokenResult = await getToken(_appCheckInstance, /* forceRefresh */ false);
      appCheckToken = tokenResult.token;
    } catch (e) {
      // Non-fatal: proceed without token; server enforces App Check if configured.
      console.warn('[PremiumKeyService] App Check token nicht verfügbar:', e);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (appCheckToken) {
    headers['Authorization'] = `Bearer ${appCheckToken}`;
  }

  const response = await fetch(`${functionsUrl}/issueGoogleMapsKey`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (response.status === 402) {
    throw new UserFacingError(
      'Kein aktives Premium-Abonnement. Bitte Premium erwerben, um fortzufahren.',
      'PAYMENT_REQUIRED',
    );
  }
  if (response.status === 403) {
    throw new UserFacingError(
      'Zugriff verweigert. Bitte erneut anmelden und es noch einmal versuchen.',
      'FORBIDDEN',
    );
  }
  if (!response.ok) {
    throw new UserFacingError(
      `Schlüsselanforderung fehlgeschlagen (HTTP ${response.status}).`,
      'HTTP_ERROR',
    );
  }

  const data = (await response.json()) as { key?: string };
  if (!data.key) {
    throw new UserFacingError(
      'Ungültige Antwort vom Schlüssel-Service.',
      'INVALID_RESPONSE',
    );
  }
  return data.key;
}

export async function getGoogleMapsKey(): Promise<string> {
  const now = Date.now();
  if (cachedKey && now - cachedAt < CACHE_TTL_MS) {
    return cachedKey;
  }

  // Dev / local fallback — UNVERÄNDERT
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (envKey) {
    cachedKey = envKey;
    cachedAt = now;
    return envKey;
  }

  // Production: call Firebase Function
  const key = await issueGoogleMapsKey();
  cachedKey = key;
  cachedAt = now;
  return key;
}

export function clearKeyCache(): void {
  cachedKey = null;
  cachedAt = 0;
}

/** Test-only: resets both key cache and rate limiter state. */
export function _resetForTesting(): void {
  cachedKey = null;
  cachedAt = 0;
  rateLimitTimestamps.length = 0;
}
