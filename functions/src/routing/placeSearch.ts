import { ROUTING_CONSENT_VERSION } from './contracts';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createHmac } from 'node:crypto';
import { isCoordinate } from './geometry';

export interface PlaceResultV1 { id: string; lat: number; lng: number; label: string }
interface SearchCaller { app?: unknown; auth?: { uid: string } | null; data: unknown; ip?: string }
export interface SearchDependencies {
  enabled: () => Promise<boolean>;
  baseUrl: () => string;
  rateLimit: (caller: SearchCaller) => Promise<void>;
  fetch: typeof fetch;
}
/** Contract: Nominatim Search jsonv2; no caller-controlled URLs and no public autocomplete. */
export function createPlaceSearchHandler(deps: SearchDependencies) {
  return async (request: SearchCaller): Promise<{ results: PlaceResultV1[] }> => {
    if (!request.app) throw new HttpsError('unauthenticated', 'App Check required.');
    const data = request.data as { query?: unknown; consentVersion?: unknown } | null;
    if (!data || data.consentVersion !== ROUTING_CONSENT_VERSION) throw new HttpsError('failed-precondition', 'CONSENT_REQUIRED');
    if (typeof data.query !== 'string' || !data.query.trim() || data.query.length > 100 || Array.from(data.query).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
      throw new HttpsError('invalid-argument', 'INVALID_REQUEST');
    }
    if (!await deps.enabled()) throw new HttpsError('unavailable', 'Betreibersuche ist noch nicht freigegeben.');
    let url: URL;
    try {
      const base = new URL(deps.baseUrl());
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash
        || base.hostname === 'nominatim.openstreetmap.org' || base.pathname !== '/') throw new Error('invalid operator');
      url = new URL('/search', base);
    } catch { throw new HttpsError('unavailable', 'Operator geocoder is not configured.'); }
    await deps.rateLimit(request);
    url.searchParams.set('q', data.query.trim()); url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5'); url.searchParams.set('addressdetails', '0');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await deps.fetch(url.toString(), { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('upstream HTTP error');
      // Bound the decoded payload before parsing; never log request URLs or upstream bodies.
      const reader = response.body?.getReader();
      if (!reader) throw new Error('missing response');
      const decoder = new TextDecoder(); let body = ''; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 128 * 1024) { await reader.cancel(); throw new Error('response too large'); }
          body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
      } finally { reader.releaseLock(); }
      const rows: unknown = JSON.parse(body);
      if (!Array.isArray(rows) || rows.length > 5) throw new Error('invalid results');
      const results: PlaceResultV1[] = rows.map(row => {
        if (!row || typeof row !== 'object' || typeof row.lat !== 'string' || !row.lat.trim() || typeof row.lon !== 'string' || !row.lon.trim()) throw new Error('invalid result');
        const position = { lat: Number(row.lat), lng: Number(row.lon) };
        if (!isCoordinate(position) || typeof row.display_name !== 'string' || !row.display_name.trim() || row.display_name.length > 1000
          || !['node', 'way', 'relation'].includes(row.osm_type) || !Number.isSafeInteger(row.osm_id) || row.osm_id < 1) throw new Error('invalid result');
        return { ...position, id: `osm:${row.osm_type}:${row.osm_id}`, label: row.display_name };
      });
      return { results };
    } catch {
      if (controller.signal.aborted) throw new HttpsError('deadline-exceeded', 'Place search timed out.');
      throw new HttpsError('unavailable', 'Place search failed.');
    } finally { clearTimeout(timer); }
  };
}
const operatorUrl = defineString('NOMINATIM_BASE_URL', { default: '' });
export const routingLimiterKey = defineSecret('ROUTING_RATE_LIMIT_KEY');
const handler = createPlaceSearchHandler({
  enabled: async () => (await getFirestore().collection('routing_config').doc('current').get()).data()?.searchEnabled === true,
  baseUrl: () => operatorUrl.value(), fetch: (...args) => fetch(...args),
  rateLimit: caller => consumeRoutingLimit(caller, 'search'),
});
export const searchPlaces = onCall({ region: 'europe-west3', enforceAppCheck: true, secrets: [routingLimiterKey] }, request =>
  handler({ app: request.app, auth: request.auth, data: request.data, ip: request.rawRequest.ip }));

export function createRoutingLimiter(db: Firestore, secretValue: () => string, clock: () => number = Date.now) {
  return async (caller: { auth?: { uid: string } | null; ip?: string }, kind: 'search' | 'route'): Promise<void> => {
    const secret = secretValue();
    if (!secret || (!caller.auth?.uid && !caller.ip)) throw new HttpsError('unavailable', 'Routing rate limiter unavailable.');
    const now = clock(), hour = Math.floor(now / 3600000);
    const subject = caller.auth?.uid ? `uid:${caller.auth.uid}` : `ip:${caller.ip}`;
    const key = (bucket: number) => createHmac('sha256', secret).update(`${kind}:${bucket}:${subject}`).digest('hex');
    const ref = db.collection('routing_rate_limits').doc(key(hour));
    const previousRef = db.collection('routing_rate_limits').doc(key(hour - 1));
    await db.runTransaction(async tx => {
      const [current, previous] = await Promise.all([tx.get(ref), tx.get(previousRef)]);
      const recent = (stored: unknown): number[] => (Array.isArray(stored) ? stored : []).filter(time => typeof time === 'number' && Number.isFinite(time) && time <= now && now - time < 60000);
      const currentTimes = recent(current.data()?.timestamps), previousTimes = recent(previous.data()?.timestamps);
      if (currentTimes.length + previousTimes.length >= 15) throw new HttpsError('resource-exhausted', 'RATE_LIMITED');
      tx.set(ref, { timestamps: [...currentTimes, now], expiresAt: new Date(now + 2 * 3600000) });
    });
  };
}
export async function consumeRoutingLimit(caller: { auth?: { uid: string } | null; ip?: string }, kind: 'search' | 'route'): Promise<void> {
  await createRoutingLimiter(getFirestore(), () => routingLimiterKey.value())(caller, kind);
}
