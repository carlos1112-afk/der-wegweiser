import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { RoutingError, ROUTING_LIMITS, ROUTING_CONSENT_VERSION } from './contracts';
import type { RouteCandidateV1, RouteRequestV1, RoutingCapabilitiesV1, ValidatedRouteV1 } from './contracts';
import { isCoordinate } from './geometry';
import { parseRouteRequest, validateRoute } from './validation';
import { routingLimiterKey, consumeRoutingLimit } from './placeSearch';
import { routeAiApiKey, routeAiModel, routeAiProvider, routeAiSecrets, routePremiumRelease } from './aiProvider';
import { routeEngine, routeProviderApiKey, routeProviderSecrets } from './openRouteService';
const MAX_FLAT_ROUTE_DETOUR_RATIO = 1.1;
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
export function operatorRoutingUrl(baseUrl: string, request: RouteRequestV1, alternativeIndex = 0): string {
  if (!Number.isInteger(alternativeIndex) || alternativeIndex < 0 || alternativeIndex > 3) throw new RoutingError('INVALID_REQUEST');
  const base = operatorRoutingBase(baseUrl);
  if (request.kind !== 'destination') throw new RoutingError('NO_MATCHING_ROUTE', 'Rundtouren benötigen bestätigte Netzanker.');
  const points = [request.start, ...request.mandatoryStops, request.destination];
  const url = new URL('/brouter', base);
  url.searchParams.set('lonlats', points.map(point => `${point.lng},${point.lat}`).join('|'));
  url.searchParams.set('profile', 'trekking'); url.searchParams.set('alternativeidx', String(alternativeIndex)); url.searchParams.set('format', 'geojson');
  return url.toString();
}
function brouterMetric(value: unknown, source: string): RouteCandidateV1['metrics']['ascentM'] {
  const parsed = typeof value === 'number' ? value
    : typeof value === 'string' && /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0
    ? { value: parsed, quality: 'known', source }
    : { value: null, quality: 'unknown', source: null };
}
/** Parses the pinned BRouter GeoJSON shape. Optional measurements stay unknown when absent. */
export function parseBRouterTrack(value: unknown, request: RouteRequestV1, config: OperatorRoutingConfig, alternativeIndex = 0): RouteCandidateV1 {
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
  const properties = features[0].properties;
  return { version: 1, id: `${request.requestId}:alternative-${alternativeIndex}`, requestId: request.requestId, execution: 'online', geometry,
    provenance: { engine: 'brouter', engineVersion: config.engineVersion, dataVersion: config.dataVersion, profile: 'trekking' },
    metrics: { distanceM: { value: length, quality: 'known', source: 'brouter:track-length' },
      ascentM: brouterMetric(properties?.['filtered ascend'], 'brouter:filtered-ascend'),
      durationS: brouterMetric(properties?.['total-time'], 'brouter:total-time'),
      // BRouter's total-energy is not a validated e-bike battery-consumption measure.
      energyWh: { value: null, quality: 'unknown', source: null } },
    maneuvers: [], criteriaFindings: [] };
}

function selectCandidate(request: RouteRequestV1, candidates: readonly RouteCandidateV1[]): RouteCandidateV1 {
  const flatPreference = request.criteria.weights.flat;
  const primary = candidates.find(candidate => candidate.id.endsWith(':alternative-0')) ?? candidates[0];
  let selected = primary;
  const findings: RouteCandidateV1['criteriaFindings'][number][] = [];
  if (flatPreference > 0) {
    const unique = candidates.filter((candidate, index) => candidates.findIndex(other =>
      JSON.stringify(other.geometry) === JSON.stringify(candidate.geometry)) === index);
    const measured = unique.filter(candidate => candidate.metrics.ascentM.value !== null && candidate.metrics.distanceM.value !== null);
    if (measured.length >= 2) {
      const shortestM = Math.min(...measured.map(candidate => candidate.metrics.distanceM.value!));
      const eligible = measured.filter(candidate => candidate.metrics.distanceM.value! <= shortestM * MAX_FLAT_ROUTE_DETOUR_RATIO);
      selected = [...eligible].sort((a, b) => a.metrics.ascentM.value! - b.metrics.ascentM.value!
        || a.metrics.distanceM.value! - b.metrics.distanceM.value! || a.id.localeCompare(b.id))[0] ?? primary;
      findings.push({ criterion: 'prefer_flatter_route', status: 'satisfied', source: 'brouter:lowest-filtered-ascend-within-10-percent-of-shortest-candidate' });
    } else {
      findings.push({ criterion: 'prefer_flatter_route', status: 'unknown', source: measured.length
        ? 'brouter:only-one-distinct-measured-candidate' : 'brouter:filtered-ascend-unavailable-for-candidates' });
    }
  }
  if (request.criteria.surfacePreference && request.criteria.surfacePreference !== 'any') {
    findings.push({ criterion: 'surface_preference', status: 'unknown', source: 'brouter:surface-breakdown-unavailable' });
  }
  if (request.criteria.wishes.trim()) {
    findings.push({ criterion: 'free_text_wishes', status: 'unknown', source: 'free-routing-does-not-interpret-free-text' });
  }
  return { ...selected, criteriaFindings: findings };
}
export interface FreeRouteDependencies {
  config: () => Promise<unknown>; baseUrl: () => string; fetch: typeof fetch;
  rateLimit: (caller: { auth?: { uid: string } | null; ip?: string }) => Promise<void>;
}
/** Reject premium personalization at the callable boundary, including forged/old clients. */
function assertFreeRequestBoundary(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RoutingError('INVALID_REQUEST');
  const request = value as Record<string, any>;
  const criteria = request.criteria;
  const profile = request.profile;
  if (!criteria || typeof criteria !== 'object' || !profile || typeof profile !== 'object'
    || !Array.isArray(request.interests) || request.interests.length !== 0
    || !Array.isArray(criteria.hard) || criteria.hard.length !== 0
    || (criteria.surfacePreference !== undefined && criteria.surfacePreference !== 'any')
    || criteria.wishes !== '' || !criteria.weights || criteria.weights.asphalt !== 0 || criteria.weights.nature !== 0
    || ![0, 1].includes(criteria.weights.flat)
    || profile.batteryPercent !== null || profile.batteryCapacityWh !== null) {
    throw new RoutingError('PREMIUM_REQUIRED', 'Personalisierte Kriterien sind Premiumfunktionen.');
  }
}
export function createFreeRouteHandler(deps: FreeRouteDependencies) {
  return async (caller: { app?: unknown; auth?: { uid: string } | null; ip?: string; data: unknown }): Promise<{ route: ValidatedRouteV1; tokenCost: 0 }> => {
    if (!caller.app) throw new HttpsError('unauthenticated', 'App Check required.');
    try {
      assertFreeRequestBoundary(caller.data);
      const request = parseRouteRequest(caller.data);
      if (request.planning !== 'standard') throw new RoutingError('PREMIUM_UNAVAILABLE');
      if (request.profile.consentVersion !== String(ROUTING_CONSENT_VERSION)) throw new RoutingError('CONSENT_REQUIRED');
      if (request.criteria.hard.length) throw new RoutingError('UNSUPPORTED_CRITERIA');
      const config = await deps.config();
      if (!isOperatorConfig(config)) throw new RoutingError('UNAVAILABLE', 'Betreiberrouting ist noch nicht freigegeben.');
      const points = [request.start, ...request.mandatoryStops, ...(request.kind === 'destination' ? [request.destination] : [])];
      if (points.some(p => p.lat < config.bounds.south || p.lat > config.bounds.north || p.lng < config.bounds.west || p.lng > config.bounds.east)) throw new RoutingError('OUTSIDE_COVERAGE');
      const url = operatorRoutingUrl(deps.baseUrl(), request);
      await deps.rateLimit(caller);
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
      const alternativeControllers: AbortController[] = [];
      try {
        // Alternative requests run alongside the mandatory first route, share its time budget,
        // and are individually bounded. Their failure never discards a valid primary route.
        const alternativesPromise = request.criteria.weights.flat > 0
          ? Promise.allSettled([1].map(async alternativeIndex => {
              const alternativeController = new AbortController(); alternativeControllers.push(alternativeController);
              const alternativeTimeout = setTimeout(() => alternativeController.abort(), 3000);
              try {
                const alternativeResponse = await deps.fetch(operatorRoutingUrl(deps.baseUrl(), request, alternativeIndex), {
                  signal: alternativeController.signal, redirect: 'error', headers: { Accept: 'application/json' },
                });
                if (!alternativeResponse.ok || !alternativeResponse.body) return null;
                const reader = alternativeResponse.body.getReader();
                let size = 0, body = ''; const decoder = new TextDecoder();
                try {
                  for (;;) {
                    const chunk = await reader.read(); if (chunk.done) break;
                    size += chunk.value.byteLength;
                    if (size > ROUTING_LIMITS.maxArtifactBytes) { await reader.cancel(); return null; }
                    body += decoder.decode(chunk.value, { stream: true });
                  }
                  body += decoder.decode();
                } finally { reader.releaseLock(); }
                const parsed = parseBRouterTrack(JSON.parse(body), request, config, alternativeIndex);
                await validateRoute(request, parsed, async content => createHash('sha256').update(content).digest('hex'));
                return parsed;
              } finally { clearTimeout(alternativeTimeout); }
            }))
          : Promise.resolve([] as PromiseSettledResult<RouteCandidateV1 | null>[]);
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
        const primary = parseBRouterTrack(JSON.parse(text), request, config, 0);
        const sha256 = async (content: string) => createHash('sha256').update(content).digest('hex');
        // Only make extra bounded router calls when the user asked for a flatter route.
        // The primary route is mandatory; missing optional alternatives never invalidate it.
        const candidates: RouteCandidateV1[] = [primary];
        const alternatives = await alternativesPromise;
        for (const result of alternatives) if (result.status === 'fulfilled' && result.value) candidates.push(result.value);
        const chosen = selectCandidate(request, candidates);
        const route = await validateRoute(request, chosen, sha256);
        return { route, tokenCost: 0 };
      } finally { clearTimeout(timeout); for (const alternative of alternativeControllers) alternative.abort(); }
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
export const getRoutingCapabilities = onCall({ region: 'europe-west3', enforceAppCheck: true,
  // Capability reporting must be available when configuration changes, so bind all provider
  // credentials here rather than deriving bindings from startup-time parameter values.
  secrets: [...routeAiSecrets, ...routeProviderSecrets] }, async request => {
  if (!request.app) throw new HttpsError('unauthenticated', 'App Check required.');
  const config = ((await readConfig()) ?? {}) as Record<string, any>;
  const featureFlags: Record<string, any> = { ...config };
  let urlValid = false; try { operatorRoutingBase(baseUrl.value()); urlValid = true; } catch { /* Capability stays closed for invalid operator configuration. */ }
  const operatorSettings = isOperatorConfig(config) ? config : null;
  const enabled = !!operatorSettings && urlValid;
  const premiumRouterEnabled = routeEngine.value() === 'brouter' ? enabled
    : routeEngine.value() === 'openrouteservice' && featureFlags.premiumRouterVerified === true && !!routeProviderApiKey.value();
  const premiumAiEnabled = ['vertex', 'gemini', 'openai', 'anthropic'].includes(routeAiProvider.value())
    && !!routeAiModel.value() && (routeAiProvider.value() === 'vertex' || !!routeAiApiKey.value());
  const capabilities: RoutingCapabilitiesV1 = { version: 1, coverage: enabled && operatorSettings ? [{ id: operatorSettings.coverageId, dataVersion: operatorSettings.dataVersion }] : [],
    profiles: enabled ? ['trekking'] : [], hardCriteria: [], localEngine: null, priceVersion: 'v1',
    freeEnabled: enabled && !!baseUrl.value(),
    premiumEnabled: premiumRouterEnabled && routePremiumRelease.value() === 'true' && featureFlags.premiumEnabled === true
      && featureFlags.premiumProviderVerified === true && !!routeAiProvider.value() && premiumAiEnabled,
    offlineEnabled: false };
  return capabilities;
});
