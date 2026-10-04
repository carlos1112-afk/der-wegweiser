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

let cachedKey: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min local cache before re-fetching

export async function getGoogleMapsKey(): Promise<string> {
  const now = Date.now();
  if (cachedKey && now - cachedAt < CACHE_TTL_MS) {
    return cachedKey;
  }

  // Dev / local fallback
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (envKey) {
    cachedKey = envKey;
    cachedAt = now;
    return envKey;
  }

  // TODO: replace stub with real Firebase Function call
  // import { getFunctions, httpsCallable } from 'firebase/functions';
  // const fn = httpsCallable<void, { key: string }>(getFunctions(), 'issueGoogleMapsKey');
  // const result = await fn();
  // cachedKey = result.data.key;
  // cachedAt = now;
  // return cachedKey;

  throw new Error('Premium Maps key nicht konfiguriert (VITE_GOOGLE_MAPS_API_KEY fehlt)');
}

export function clearKeyCache(): void {
  cachedKey = null;
  cachedAt = 0;
}
