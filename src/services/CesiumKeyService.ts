// Key broker for the CesiumJS premium 3D map modes (satellite-3d, topo-premium, cycle-premium).
// Production: calls the Firebase Function `issueCesiumIonToken` (httpsCallable — NOT raw fetch,
// see note below) which verifies auth + App Check + subscription and returns a Cesium ion access
// token (short TTL, rate-limited, instance-bound via App Check).
// Dev fallback: reads VITE_CESIUM_ION_TOKEN from env.
//
// WICHTIG — bewusst NICHT das Muster aus PremiumKeyService.ts (issueGoogleMapsKey) kopiert:
// Die Google-Variante ruft die onCall-Function per rohem fetch() mit manuell zusammengebauten
// onCall-Protokoll-Headern/Body auf. `onCall` erwartet aber echte Firebase-Callable-Semantik
// (Auth-Context aus dem SDK-Request, nicht aus einem von Hand gesetzten Authorization-Header),
// weshalb dieses Muster fehlerhaft ist. Dieser Service nutzt stattdessen die Firebase-Client-SDK
// (`getFunctions()` + `httpsCallable()`), die Auth- und App-Check-Token korrekt anhängt.

import type { FunctionsError } from 'firebase/functions';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { logger } from '../utils/logger';

/** Error surfaced directly to the user (localised message, no stack trace). */
export class UserFacingError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'UserFacingError';
    this.code = code;
  }
}

// --- Client-side rate limiter (max 5 requests per minute per app instance) ---
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const rateLimitTimestamps: number[] = [];

function checkRateLimit(): void {
  const now = Date.now();
  while (
    rateLimitTimestamps.length > 0 &&
    now - rateLimitTimestamps[0] > RATE_LIMIT_WINDOW_MS
  ) {
    rateLimitTimestamps.shift();
  }
  if (rateLimitTimestamps.length >= RATE_LIMIT_MAX) {
    throw new UserFacingError(
      'Zu viele Anfragen für die Premium-3D-Karte. Bitte warte eine Minute.',
      'RATE_LIMIT_EXCEEDED',
    );
  }
  rateLimitTimestamps.push(now);
}

let cachedToken: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min local cache before re-fetching

/** Maps a FunctionsError's `functions/<code>` to the same UserFacingError codes/messages
 *  issueGoogleMapsKey's HTTP-status mapping used, so calling UI can stay error-code-agnostic. */
function mapFunctionsError(err: FunctionsError): UserFacingError {
  switch (err.code) {
    case 'functions/unauthenticated':
      return new UserFacingError(
        'Bitte melde dich an, um die Premium-3D-Karte zu nutzen.',
        'UNAUTHENTICATED',
      );
    case 'functions/permission-denied':
      return new UserFacingError(
        'Kein aktives Premium-Abonnement. Bitte Premium erwerben, um fortzufahren.',
        'PAYMENT_REQUIRED',
      );
    case 'functions/resource-exhausted':
      return new UserFacingError(
        'Zu viele Anfragen für die Premium-3D-Karte. Bitte warte eine Minute.',
        'RATE_LIMIT_EXCEEDED',
      );
    default:
      return new UserFacingError(
        `Premium-3D-Karte derzeit nicht verfügbar (${err.code}).`,
        'FUNCTIONS_ERROR',
      );
  }
}

/** Calls the Firebase Function to obtain a short-lived Cesium ion access token. */
async function issueCesiumIonToken(): Promise<string> {
  if (!functions) {
    throw new UserFacingError(
      'Firebase Functions sind nicht initialisiert.',
      'MISSING_FUNCTIONS',
    );
  }

  // Client-side rate limit check
  checkRateLimit();

  try {
    const callable = httpsCallable<Record<string, never>, { token?: string }>(
      functions,
      'issueCesiumIonToken',
    );
    const result = await callable({});
    const token = result.data?.token;
    if (!token) {
      throw new UserFacingError(
        'Ungültige Antwort vom Cesium-Token-Service.',
        'INVALID_RESPONSE',
      );
    }
    return token;
  } catch (e) {
    if (e instanceof UserFacingError) throw e;
    throw mapFunctionsError(e as FunctionsError);
  }
}

export async function getCesiumIonToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now - cachedAt < CACHE_TTL_MS) {
    return cachedToken;
  }

  // Dev / local fallback
  const envToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
  if (envToken) {
    cachedToken = envToken;
    cachedAt = now;
    return envToken;
  }

  // Production: call Firebase Function
  const token = await issueCesiumIonToken();
  cachedToken = token;
  cachedAt = now;
  return token;
}

export function clearTokenCache(): void {
  cachedToken = null;
  cachedAt = 0;
}

/** Test-only: resets both token cache and rate limiter state. */
export function _resetForTesting(): void {
  cachedToken = null;
  cachedAt = 0;
  rateLimitTimestamps.length = 0;
}
