import { createHash } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';
import { ROUTING_LIMITS, RoutingError } from './contracts';
import type { Coordinate, RouteCandidateV1, RouteRequestV1 } from './contracts';
import { isCoordinate } from './geometry';

const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/cycling-regular/geojson';
const ORS_REQUEST_TIMEOUT_MS = 20_000;
// The public ORS API limits alternative routes to 100 km; do not treat a longer result as supported.
const ORS_MAX_ALTERNATIVE_DISTANCE_M = 100_000;
export const routeEngine = defineString('ROUTE_ENGINE', { default: 'brouter' });
export const routeProviderApiKey = defineSecret('ROUTE_PROVIDER_API_KEY');
export const routeProviderSecrets = [routeProviderApiKey];

function metric(value: unknown, source: string): RouteCandidateV1['metrics']['distanceM'] {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? { value, quality: 'known', source }
    : { value: null, quality: 'unknown', source: null };
}

export class OpenRouteServiceError extends Error {
  constructor(readonly retryable: boolean, readonly status: number) {
    super(`ORS_HTTP_${status}`);
    this.name = 'OpenRouteServiceError';
  }
}

function versionText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() && value.length <= 128 ? value : fallback;
}

/** Parses only ORS GeoJSON route features; every candidate still passes the common route validator. */
export function parseOpenRouteServiceGeoJson(value: unknown, request: RouteRequestV1): RouteCandidateV1[] {
  const response = value as any;
  const features = response?.type === 'FeatureCollection' ? response.features : null;
  if (!Array.isArray(features) || features.length < 2 || features.length > 3) throw new RoutingError('INVALID_GEOMETRY');
  const engineVersion = versionText(response.metadata?.engine?.version, 'openrouteservice-v2');
  const dataVersion = versionText(response.metadata?.engine?.build_date, 'unreported');
  const idPrefix = `ors-${createHash('sha256').update(request.requestId).digest('hex').slice(0, 20)}`;

  return features.map((feature: any, index: number) => {
    if (feature?.type !== 'Feature' || feature.geometry?.type !== 'LineString'
      || !Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length < 2
      || feature.geometry.coordinates.length > ROUTING_LIMITS.maxPoints) throw new RoutingError('INVALID_GEOMETRY');
    let hasElevation = true;
    const elevations: number[] = [];
    const geometry: Coordinate[] = feature.geometry.coordinates.map((coordinate: unknown) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2 || coordinate.length > 3
        || !coordinate.every(item => typeof item === 'number' && Number.isFinite(item))) throw new RoutingError('INVALID_GEOMETRY');
      const point = { lat: coordinate[1], lng: coordinate[0] };
      if (!isCoordinate(point)) throw new RoutingError('INVALID_GEOMETRY');
      if (coordinate.length === 3) elevations.push(coordinate[2]);
      else hasElevation = false;
      return point;
    });
    if (hasElevation && elevations.length !== geometry.length) throw new RoutingError('INVALID_GEOMETRY');

    const summary = feature.properties?.summary;
    if (typeof summary?.distance === 'number' && summary.distance > ORS_MAX_ALTERNATIVE_DISTANCE_M) throw new RoutingError('NO_MATCHING_ROUTE');
    const distanceM = metric(summary?.distance, 'openrouteservice:summary.distance');
    const durationS = typeof summary?.duration === 'number' && Number.isFinite(summary.duration) && summary.duration > 0
      ? { value: summary.duration, quality: 'estimated' as const, source: 'openrouteservice:summary.duration' }
      : { value: null, quality: 'unknown' as const, source: null };
    let ascentM: RouteCandidateV1['metrics']['ascentM'] = { value: null, quality: 'unknown', source: null };
    if (hasElevation) {
      const ascent = elevations.slice(1).reduce((sum, elevation, position) => sum + Math.max(0, elevation - elevations[position]), 0);
      ascentM = { value: ascent, quality: 'estimated', source: 'openrouteservice:geojson-elevation-positive-delta' };
    }
    return {
      version: 1,
      id: `${idPrefix}-${index + 1}`,
      requestId: request.requestId,
      execution: 'online',
      geometry,
      provenance: { engine: 'openrouteservice', engineVersion, dataVersion, profile: 'cycling-regular' },
      metrics: { distanceM, ascentM, durationS, energyWh: { value: null, quality: 'unknown', source: null } },
      maneuvers: [],
      criteriaFindings: [],
    };
  });
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new OpenRouteServiceError(response.status === 429 || response.status >= 500, response.status);
  if (!response.body) throw new Error('ORS_RESPONSE_MISSING');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, body = '';
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > ROUTING_LIMITS.maxArtifactBytes) {
        await reader.cancel();
        throw new Error('ORS_RESPONSE_TOO_LARGE');
      }
      body += decoder.decode(item.value, { stream: true });
    }
    body += decoder.decode();
  } finally { reader.releaseLock(); }
  return JSON.parse(body);
}

/** Uses one fixed vendor endpoint; the host cannot come from caller or Firestore input. */
export async function fetchOpenRouteServiceCandidates(request: RouteRequestV1, apiKey: string,
  fetchImpl: typeof fetch = fetch): Promise<RouteCandidateV1[]> {
  if (!apiKey || apiKey.length > 4096 || request.kind !== 'destination') throw new RoutingError('UNAVAILABLE');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), ORS_REQUEST_TIMEOUT_MS);
  try {
    const coordinates = [request.start, ...request.mandatoryStops, request.destination].map(point => [point.lng, point.lat]);
    const response = await fetchImpl(ORS_DIRECTIONS_URL, { method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { Authorization: apiKey, 'Content-Type': 'application/json', Accept: 'application/geo+json, application/json' },
      body: JSON.stringify({ coordinates, elevation: true, instructions: false,
        alternative_routes: { target_count: 3, share_factor: 0.6, weight_factor: 1.4 } }) });
    return parseOpenRouteServiceGeoJson(await readBoundedJson(response), request);
  } finally { clearTimeout(timer); }
}

export const OPENROUTESERVICE_ENDPOINT = ORS_DIRECTIONS_URL;
