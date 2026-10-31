import { ROUTING_CONSENT_VERSION } from './contracts';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { getFirestore, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { createHmac } from 'node:crypto';
import { isCoordinate } from './geometry';

export interface PlaceResultV1 { id: string; lat: number; lng: number; label: string; source: 'wegweiser' | 'osm' }
interface SearchCaller { app?: unknown; auth?: { uid: string } | null; data: unknown; ip?: string }
export interface SearchDependencies {
  enabled: () => Promise<boolean>;
  searchInternal?: (query: string) => Promise<PlaceResultV1[]>;
  baseUrl: () => string;
  rateLimit: (caller: SearchCaller) => Promise<void>;
  fetch: typeof fetch;
}
/** Contract: Nominatim Search jsonv2; no caller-controlled URLs and no public autocomplete. */
export function createPlaceSearchHandler(deps: SearchDependencies) {
  return async (request: SearchCaller): Promise<{ results: PlaceResultV1[]; osmAvailable: boolean }> => {
    if (!request.app) throw new HttpsError('unauthenticated', 'App Check required.');
    const data = request.data as { query?: unknown; consentVersion?: unknown } | null;
    if (!data || data.consentVersion !== ROUTING_CONSENT_VERSION) throw new HttpsError('failed-precondition', 'CONSENT_REQUIRED');
    if (typeof data.query !== 'string' || !data.query.trim() || data.query.length > 100 || Array.from(data.query).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
      throw new HttpsError('invalid-argument', 'INVALID_REQUEST');
    }
    await deps.rateLimit(request);
    // The Wegweiser catalog is authoritative for community/local destinations. Query it even
    // when the public geocoder is disabled; a geocoder outage must not hide internal places.
    let internal: PlaceResultV1[];
    try { internal = deps.searchInternal ? await deps.searchInternal(data.query.trim()) : []; }
    catch { throw new HttpsError('unavailable', 'Interne Zielsuche ist derzeit nicht verfügbar.'); }
    if (!Array.isArray(internal) || internal.length > 20 || !internal.every(item => item.source === 'wegweiser' && isCoordinate(item))) {
      throw new HttpsError('internal', 'Interne Zielsuche lieferte ungültige Ergebnisse.');
    }
    if (!await deps.enabled()) return { results: internal.slice(0, 10), osmAvailable: false };
    let url: URL;
    try {
      const base = new URL(deps.baseUrl());
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash
      || base.hostname === 'nominatim.openstreetmap.org' || base.pathname !== '/') throw new Error('invalid operator');
      url = new URL('/search', base);
    } catch { return { results: internal.slice(0, 10), osmAvailable: false }; }
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
        return { ...position, id: `osm:${row.osm_type}:${row.osm_id}`, label: row.display_name, source: 'osm' as const };
      });
      const combined = [...internal, ...results];
      const unique: PlaceResultV1[] = [];
      for (const item of combined) {
        if (unique.some(existing => existing.id === item.id
          || (Math.abs(existing.lat - item.lat) < 0.00045 && Math.abs(existing.lng - item.lng) < 0.00045))) continue;
        unique.push(item);
        if (unique.length === 10) break;
      }
      return { results: unique, osmAvailable: true };
    } catch {
      // Preserve local discovery when the external geocoder fails; surface partial coverage.
      return { results: internal.slice(0, 10), osmAvailable: false };
    } finally { clearTimeout(timer); }
  };
}
const operatorUrl = defineString('NOMINATIM_BASE_URL', { default: '' });
export const routingLimiterKey = defineSecret('ROUTING_RATE_LIMIT_KEY');
const INTERNAL_DESTINATIONS = ['points_of_interest', 'charging_stations', 'charging_stations_v2'] as const;
type InternalDestinationCollection = typeof INTERNAL_DESTINATIONS[number];
function normalizedSearchName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss')
    .toLocaleLowerCase('de-DE').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function destinationSearchPrefixes(label: string): string[] {
  const normalized = normalizedSearchName(label);
  const terms = new Set([normalized, ...normalized.split(' ')]);
  const prefixes = new Set<string>();
  for (const term of terms) for (let end = 1; end <= Math.min(term.length, 100); end++) prefixes.add(term.slice(0, end));
  return [...prefixes];
}
function destinationSearchRecord(sourceCollection: InternalDestinationCollection, value: DocumentData) {
  const label = [value.name, value.label, value.title].find(text => typeof text === 'string' && text.trim());
  const lat = value.lat ?? value.latitude, lng = value.lng ?? value.lon ?? value.longitude;
  if (typeof label !== 'string' || label.length > 200 || !isCoordinate({ lat, lng })) return null;
  return { sourceCollection, label: label.trim(), lat, lng,
    normalizedName: normalizedSearchName(label), searchPrefixes: destinationSearchPrefixes(label), schemaVersion: 1 };
}
async function syncDestinationIndex(collection: InternalDestinationCollection, id: string): Promise<void> {
  const db = getFirestore(), sourceRef = db.collection(collection).doc(id), indexRef = sourceRef.collection('destination_search').doc('v1');
  await db.runTransaction(async transaction => {
    const source = await transaction.get(sourceRef);
    const record = source.exists ? destinationSearchRecord(collection, source.data()!) : null;
    if (!record) transaction.delete(indexRef);
    else transaction.set(indexRef, record);
  });
}
export const indexPoiDestination = onDocumentWritten({ document: 'points_of_interest/{documentId}', region: 'europe-west3', maxInstances: 5 }, async event => {
  await syncDestinationIndex('points_of_interest', event.params.documentId);
});
export const indexChargingStationDestination = onDocumentWritten({ document: 'charging_stations/{documentId}', region: 'europe-west3', maxInstances: 5 }, async event => {
  await syncDestinationIndex('charging_stations', event.params.documentId);
});
export const indexChargingStationV2Destination = onDocumentWritten({ document: 'charging_stations_v2/{documentId}', region: 'europe-west3', maxInstances: 5 }, async event => {
  await syncDestinationIndex('charging_stations_v2', event.params.documentId);
});
const handler = createPlaceSearchHandler({
  enabled: async () => (await getFirestore().collection('routing_config').doc('current').get()).data()?.searchEnabled === true,
  searchInternal: async query => {
    // Canonical prefix index handles all catalog records and token-prefix search. Source documents
    // are re-read before returning hits, so deleted/stale index entries are never surfaced.
    const db = getFirestore(), normalized = normalizedSearchName(query);
    if (!normalized) return [];
    const canonical = normalized
      ? await db.collectionGroup('destination_search').where('searchPrefixes', 'array-contains', normalized).limit(20).get()
      : null;
    const indexed = canonical?.docs.flatMap(document => {
      const parent = document.ref.parent.parent;
      if (!parent || !INTERNAL_DESTINATIONS.includes(parent.parent.id as InternalDestinationCollection)) return [];
      return [{ sourceRef: parent, indexData: document.data() }];
    }) ?? [];
    const current = indexed.length ? await db.getAll(...indexed.map(item => item.sourceRef)) : [];
    const found = new Map<string, PlaceResultV1>();
    indexed.forEach((item, index) => {
      const source = current[index];
      if (!source?.exists) return;
      const collection = source.ref.parent.id as InternalDestinationCollection;
      const result = destinationSearchRecord(collection, source.data()!);
      if (result && item.indexData.schemaVersion === 1 && item.indexData.sourceCollection === collection
        && result.searchPrefixes.includes(normalized)) {
        found.set(`wegweiser:${source.ref.path}`, { id: `wegweiser:${source.ref.path}`, lat: result.lat, lng: result.lng, label: result.label, source: 'wegweiser' });
      }
    });
    // Transitional fallback ensures older collections remain discoverable before the backfill
    // finishes. Each query is capped; there is no unbounded collection scan.
    const collections = [
      { name: 'points_of_interest', fields: ['name', 'label', 'title', 'searchName'] },
      { name: 'charging_stations', fields: ['name'] },
      { name: 'charging_stations_v2', fields: ['name'] },
    ];
    const queryForms = [...new Set([query.trim(), query.trim().toLocaleLowerCase('de-DE'), query.trim().charAt(0).toLocaleUpperCase('de-DE') + query.trim().slice(1)])];
    const rows = await Promise.all(collections.flatMap(({ name, fields }) => fields.flatMap(field => queryForms.map(form =>
      db.collection(name).orderBy(field).startAt(form).endAt(`${form}\uf8ff`).limit(5).get()))));
    for (const snapshot of rows) for (const document of snapshot.docs) {
      const value = document.data();
      const label = [value.name, value.label, value.title].find(text => typeof text === 'string' && text.trim());
      const lat = value.lat ?? value.latitude, lng = value.lng ?? value.lon ?? value.longitude;
      if (typeof label !== 'string' || !isCoordinate({ lat, lng })) continue;
      // Case-folded check guards the query-field result and keeps search behavior predictable.
      if (!normalizedSearchName(label).startsWith(normalized)) continue;
      const result = { id: `wegweiser:${document.ref.path}`, lat, lng, label: label.trim(), source: 'wegweiser' as const };
      found.set(result.id, result);
    }
    return [...found.values()].slice(0, 20);
  },
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
