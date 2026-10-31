import { parseOpenRouteServiceGeoJson, fetchOpenRouteServiceCandidates, OPENROUTESERVICE_ENDPOINT } from './openRouteService';
import type { RouteRequestV1 } from './contracts';
import { validateRoute } from './validation';

const request: RouteRequestV1 = {
  version: 1, requestId: 'test-request-ors', planning: 'ai', kind: 'destination',
  start: { lat: 0, lng: 0, source: 'manual', observedAt: 1, accuracyM: null, confirmed: true },
  destination: { lat: 0, lng: 0.02 }, mandatoryStops: [], interests: [],
  criteria: { hard: [], surfacePreference: 'any', wishes: '', weights: { asphalt: 0, nature: 0, flat: 0 } },
  profile: { bike: 'bicycle', batteryPercent: null, batteryCapacityWh: null, confirmedAt: 1, consentVersion: '3' },
};

function response(features: unknown[]) {
  return { type: 'FeatureCollection', metadata: { engine: { version: '9.10.0', build_date: '2026-10-30' } },
    features: features.map((coordinates, index) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates },
      properties: { summary: { distance: 2224 + index, duration: 600 + index } } })) };
}

describe('OpenRouteService directions adapter', () => {
  it('parses no more than three alternatives and marks elevation as estimated', () => {
    const candidates = parseOpenRouteServiceGeoJson(response([
      [[0, 0, 10], [0.01, 0, 13], [0.02, 0, 12]],
      [[0, 0, 10], [0.01, 0.001, 15], [0.02, 0, 10]],
    ]), request);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].provenance.engine).toBe('openrouteservice');
    expect(candidates[0].metrics.ascentM).toEqual({ value: 3, quality: 'estimated', source: 'openrouteservice:geojson-elevation-positive-delta' });
    expect(candidates[0].metrics.energyWh.quality).toBe('unknown');
  });

  it('passes an ORS candidate through the same endpoint and distance validator as BRouter', async () => {
    const candidate = parseOpenRouteServiceGeoJson(response([
      [[0, 0], [0.01, 0], [0.02, 0]], [[0, 0], [0.01, 0.001], [0.02, 0]],
    ]), request)[0];
    const validated = await validateRoute(request, candidate, async () => 'a'.repeat(64));
    expect(validated.provenance.engine).toBe('openrouteservice');
    expect(validated.guidanceCapability).toBe('track');
  });

  it('rejects fewer than two routes, unsupported geometry and too many alternatives', () => {
    expect(() => parseOpenRouteServiceGeoJson(response([[[0, 0], [0.02, 0]]]), request)).toThrow();
    expect(() => parseOpenRouteServiceGeoJson({ ...response([[[0, 0], [0.02, 0]], [[0, 0], [0.02, 0]]]),
      features: [{ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [] }, properties: {} }] }, request)).toThrow();
    expect(() => parseOpenRouteServiceGeoJson(response([
      [[0, 0], [0.02, 0]], [[0, 0], [0.02, 0]], [[0, 0], [0.02, 0]], [[0, 0], [0.02, 0]],
    ]), request)).toThrow();
  });

  it('posts only to the pinned HTTPS endpoint with explicit coordinates and alternatives', async () => {
    let observedUrl = '';
    let observedInit: RequestInit | undefined;
    const fakeFetch: typeof fetch = async (input, init) => {
      observedUrl = String(input); observedInit = init;
      return new Response(JSON.stringify(response([
        [[0, 0], [0.01, 0], [0.02, 0]], [[0, 0], [0.01, 0.001], [0.02, 0]],
      ])), { status: 200, headers: { 'content-type': 'application/geo+json' } });
    };
    const candidates = await fetchOpenRouteServiceCandidates(request, 'test-server-key', fakeFetch);
    expect(observedUrl).toBe(OPENROUTESERVICE_ENDPOINT);
    expect(observedUrl.startsWith('https://')).toBe(true);
    expect(new Headers(observedInit?.headers).get('Authorization')).toBe('test-server-key');
    const body = JSON.parse(String(observedInit?.body));
    expect(body.coordinates).toEqual([[0, 0], [0.02, 0]]);
    expect(body.alternative_routes.target_count).toBe(3);
    expect(candidates).toHaveLength(2);
  });

  it('classifies provider authentication errors as permanent and upstream failures as retryable', async () => {
    const unauthorized: typeof fetch = async () => new Response('ignored upstream body', { status: 401 });
    const unavailable: typeof fetch = async () => new Response('ignored upstream body', { status: 503 });
    await expect(fetchOpenRouteServiceCandidates(request, 'test-key', unauthorized)).rejects.toMatchObject({ retryable: false, status: 401 });
    await expect(fetchOpenRouteServiceCandidates(request, 'test-key', unavailable)).rejects.toMatchObject({ retryable: true, status: 503 });
  });
});
