import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { RoutingError, ROUTING_LIMITS } from './contracts';
import type { RouteCandidateV1, RouteRequestV1, RoutingCapabilitiesV1, ValidatedRouteV1 } from './contracts';
import { isCoordinate } from './geometry';
import { parseRouteRequest, validateRoute } from './validation';
import { routingLimiterKey, consumeRoutingLimit } from './placeSearch';
export interface OperatorRoutingConfig {
  freeEnabled: boolean; gate0Verified: boolean; engineVersion: '1.7.10'; dataVersion: string;
  coverageId: string; bounds: { south: number; north: number; west: number; east: number };
}
export function isOperatorConfig(value: unknown): value is OperatorRoutingConfig {
  const c = value as OperatorRoutingConfig | null, b = c?.bounds;
  return !!c && c.freeEnabled === true && c.gate0Verified === true && c.engineVersion === '1.7.10'
    && typeof c.dataVersion === 'string' && c.dataVersion.length > 0 && typeof c.coverageId === 'string' && c.coverageId.length > 0
    && !!b && isCoordinate({ lat: b.south, lng: b.west }) && isCoordinate({ lat: b.north, lng: b.east }) && b.south < b.north && b.west < b.east;
}
export function operatorRoutingBase(baseUrl: string): URL {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/' || base.hostname === 'brouter.de') throw new RoutingError('UNAVAILABLE');
  return base;
}
export function operatorRoutingUrl(baseUrl: string, request: RouteRequestV1): string {
  const base = operatorRoutingBase(baseUrl);
  if (request.kind !== 'destination') throw new RoutingError('NO_MATCHING_ROUTE', 'Rundtouren benötigen bestätigte Netzanker.');
  const points = [request.start, ...request.mandatoryStops, request.destination];
  const url = new URL('/brouter', base);
  url.searchParams.set('lonlats', points.map(point => `${point.lng},${point.lat}`).join('|'));
  url.searchParams.set('profile', 'trekking'); url.searchParams.set('alternativeidx', '0'); url.searchParams.set('format', 'geojson');
  return url.toString();
}
/** Only the documented existing GeoJSON geometry/track-length fields are enabled. Real maneuver fixture gate remains open. */
export function parseBRouterTrack(value: unknown, request: RouteRequestV1, config: OperatorRoutingConfig): RouteCandidateV1 {
  const data = value as any, features = data?.features;
  if (data?.type !== 'FeatureCollection' || !Array.isArray(features) || features.length !== 1 || features[0]?.geometry?.type !== 'LineString') throw new RoutingError('INVALID_GEOMETRY');
  const coordinates = features[0].geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > ROUTING_LIMITS.maxPoints) throw new RoutingError('INVALID_GEOMETRY');
  const geometry = coordinates.map((coordinate: unknown) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2 || coordinate.length > 3 || !coordinate.every(v => typeof v === 'number' && Number.isFinite(v))) throw new RoutingError('INVALID_GEOMETRY');
    const p = { lat: coordinate[1], lng: coordinate[0] };
    if (!isCoordinate(p)) throw new RoutingError('INVALID_GEOMETRY');
    return p;
  });
  const rawLength = features[0].properties?.['track-length'];
  if (!(typeof rawLength === 'number' || (typeof rawLength === 'string' && /^\d+(\.\d+)?$/.test(rawLength)))) throw new RoutingError('INVALID_GEOMETRY');
  const length = Number(rawLength);
  if (!Number.isFinite(length) || length <= 0) throw new RoutingError('INVALID_GEOMETRY');
  const unknown = { value: null, quality: 'unknown' as const, source: null };
  return { version: 1, id: request.requestId, requestId: request.requestId, execution: 'online', geometry,
    provenance: { engine: 'brouter', engineVersion: config.engineVersion, dataVersion: config.dataVersion, profile: 'trekking' },
    metrics: { distanceM: { value: length, quality: 'known', source: 'brouter:track-length' }, ascentM: unknown, durationS: unknown, energyWh: unknown },
    maneuvers: [], criteriaFindings: [] };
}
export interface FreeRouteDependencies {
  config: () => Promise<unknown>; baseUrl: () => string; fetch: typeof fetch;
  rateLimit: (caller: { auth?: { uid: string } | null; ip?: string }) => Promise<void>;
}
export function createFreeRouteHandler(deps: FreeRouteDependencies) {
  return async (caller: { app?: unknown; auth?: { uid: string } | null; ip?: string; data: unknown }): Promise<{ route: ValidatedRouteV1; tokenCost: 0 }> => {
    if (!caller.app) throw new HttpsError('unauthenticated', 'App Check required.');
    try {
      const request = parseRouteRequest(caller.data);
      if (request.planning !== 'standard') throw new RoutingError('PREMIUM_UNAVAILABLE');
      if (request.profile.consentVersion !== '2') throw new RoutingError('CONSENT_REQUIRED');
      if (request.criteria.hard.length) throw new RoutingError('UNSUPPORTED_CRITERIA');
      const config = await deps.config();
      if (!isOperatorConfig(config)) throw new RoutingError('UNAVAILABLE', 'Betreiberrouting ist noch nicht freigegeben.');
      const points = [request.start, ...request.mandatoryStops, ...(request.kind === 'destination' ? [request.destination] : [])];
      if (points.some(p => p.lat < config.bounds.south || p.lat > config.bounds.north || p.lng < config.bounds.west || p.lng > config.bounds.east)) throw new RoutingError('OUTSIDE_COVERAGE');
      const url = operatorRoutingUrl(deps.baseUrl(), request);
      await deps.rateLimit(caller);
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await deps.fetch(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new RoutingError('NO_ROUTE');
        const reader = response.body?.getReader();
        if (!reader) throw new RoutingError('INVALID_GEOMETRY');
        let size = 0, text = ''; const decoder = new TextDecoder();
        try {
          for (;;) {
            const chunk = await reader.read(); if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > ROUTING_LIMITS.maxArtifactBytes) { await reader.cancel(); throw new RoutingError('INVALID_GEOMETRY'); }
            text += decoder.decode(chunk.value, { stream: true });
          }
          text += decoder.decode();
        } finally { reader.releaseLock(); }
        const candidate = parseBRouterTrack(JSON.parse(text), request, config);
        const route = await validateRoute(request, candidate, async content => createHash('sha256').update(content).digest('hex'));
        return { route, tokenCost: 0 };
      } finally { clearTimeout(timeout); }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof RoutingError) throw new HttpsError(error.code === 'INVALID_REQUEST' ? 'invalid-argument' : 'failed-precondition', error.message, { routingCode: error.code });
      throw new HttpsError('unavailable', 'Routing unavailable.');
    }
  };
}
const baseUrl = defineString('BROUTER_BASE_URL', { default: '' });
const readConfig = async () => (await getFirestore().collection('routing_config').doc('current').get()).data();
const handler = createFreeRouteHandler({ config: readConfig, baseUrl: () => baseUrl.value(), fetch: (...args) => fetch(...args), rateLimit: caller => consumeRoutingLimit(caller, 'route') });
export const computeFreeRoute = onCall({ region: 'europe-west3', enforceAppCheck: true, secrets: [routingLimiterKey] }, request => handler({ app: request.app, auth: request.auth, ip: request.rawRequest.ip, data: request.data }));
export const getRoutingCapabilities = onCall({ region: 'europe-west3', enforceAppCheck: true }, async request => {
  if (!request.app) throw new HttpsError('unauthenticated', 'App Check required.');
  const config = await readConfig();
  let urlValid = false; try { operatorRoutingBase(baseUrl.value()); urlValid = true; } catch { /* Capability stays closed for invalid operator configuration. */ }
  const enabled = isOperatorConfig(config) && urlValid;
  const capabilities: RoutingCapabilitiesV1 = { version: 1, coverage: enabled ? [{ id: config.coverageId, dataVersion: config.dataVersion }] : [],
    profiles: enabled ? ['trekking'] : [], hardCriteria: [], localEngine: null, priceVersion: 'v1',
    freeEnabled: enabled && !!baseUrl.value(), premiumEnabled: false, offlineEnabled: false };
  return capabilities;
});
