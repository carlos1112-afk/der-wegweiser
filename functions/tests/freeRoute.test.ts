jest.mock('firebase-functions/v2/https', () => ({
  onCall: (config: any, handler: any) => Object.assign(handler, { __config: config }),
  HttpsError: class extends Error { constructor(public code: string, message: string, public details?: unknown) { super(message); } },
}));
import { createFreeRouteHandler, isOperatorConfig } from '../src/routing/freeRoute';
import { cumulativeDistances } from '../src/routing/geometry';
import type { RouteRequestV1 } from '../src/routing/contracts';
const request: RouteRequestV1 = { version: 1, requestId: 'test', kind: 'destination', planning: 'standard',
  start: { lat: 52.52, lng: 13.4, source: 'manual', observedAt: 1, accuracyM: null, confirmed: true }, destination: { lat: 52.52, lng: 13.402 },
  mandatoryStops: [], interests: [], criteria: { hard: [], wishes: '', weights: { asphalt: 0, nature: 0, flat: 0 } },
  profile: { bike: 'bicycle', batteryPercent: 0, batteryCapacityWh: null, consentVersion: '3', confirmedAt: 1 } };
const geometry = [{ lat: 52.52, lng: 13.4 }, { lat: 52.52, lng: 13.401 }, { lat: 52.52, lng: 13.402 }];
// Synthetic fixture exercising the documented adapter fields; not a real graph acceptance test.
const fixture = () => ({ type: 'FeatureCollection', features: [{ geometry: { type: 'LineString', coordinates: geometry.map(p => [p.lng, p.lat]) }, properties: { 'track-length': String(cumulativeDistances(geometry).slice(-1)[0]) } }] });
const setup = () => {
  const config = { freeEnabled: true, gate0Verified: true, engineVersion: '1.7.10', dataVersion: 'synthetic', coverageId: 'test', bounds: { south: 52, north: 53, west: 13, east: 14 } };
  const fetch = jest.fn(async () => new Response(JSON.stringify(fixture())));
  const readConfig = jest.fn(async (): Promise<unknown> => config), rateLimit = jest.fn(async () => {});
  return { config, fetch, readConfig, rateLimit, handler: createFreeRouteHandler({ config: readConfig, baseUrl: () => 'http://operator.internal/', fetch: fetch as any, rateLimit }) };
};
it('returns validated geometry at zero cost and marks missing maneuvers/metrics unknown', async () => {
  const s = setup(), result = await s.handler({ app: {}, data: request });
  expect(result.tokenCost).toBe(0); expect(result.route.guidanceCapability).toBe('track');
  expect(result.route.metrics.ascentM).toEqual({ value: null, quality: 'unknown', source: null });
  const url = new URL(String((s.fetch.mock.calls[0] as unknown as unknown[])[0]));
  expect(url.searchParams.get('lonlats')).toBe('13.4,52.52|13.402,52.52'); expect(url.searchParams.get('profile')).toBe('trekking');
});
it('requires App Check, standard mode, current consent, coverage and verified operator config before routing', async () => {
  const s = setup();
  await expect(s.handler({ data: request })).rejects.toMatchObject({ code: 'unauthenticated' });
  for (const r of [{ ...request, planning: 'ai' }, { ...request, profile: { ...request.profile, consentVersion: 'old' } }, { ...request, destination: { lat: 60, lng: 13.4 } }, { ...request, start: { ...request.start, lat: NaN } }]) {
    await expect(s.handler({ app: {}, data: r })).rejects.toThrow();
  }
  s.readConfig.mockResolvedValue({ ...s.config, gate0Verified: false });
  await expect(s.handler({ app: {}, data: request })).rejects.toThrow(); expect(s.fetch).not.toHaveBeenCalled();
  expect(isOperatorConfig({ ...s.config, engineVersion: 'latest' })).toBe(false);
});
it('rejects missing graph, malformed response, endpoint mismatch and reversed via order without fallback', async () => {
  const s = setup();
  s.fetch.mockResolvedValueOnce(new Response('graph missing', { status: 404 }));
  await expect(s.handler({ app: {}, data: request })).rejects.toThrow(); expect(s.fetch).toHaveBeenCalledTimes(1);
  s.fetch.mockResolvedValueOnce(new Response('{}'));
  await expect(s.handler({ app: {}, data: request })).rejects.toThrow();
  const wrong = fixture(); wrong.features[0].geometry.coordinates[0] = [13.3, 52.52];
  s.fetch.mockResolvedValueOnce(new Response(JSON.stringify(wrong)));
  await expect(s.handler({ app: {}, data: request })).rejects.toThrow();
  await expect(s.handler({ app: {}, data: { ...request, mandatoryStops: [{ lat: 52.52, lng: 13.4018 }, { lat: 52.52, lng: 13.4002 }] } })).rejects.toThrow();
});
it('rejects unsupported hard constraints and roundtrips without creating geometric circles', async () => {
  const s = setup();
  await expect(s.handler({ app: {}, data: { ...request, criteria: { ...request.criteria, hard: ['avoid_ferries'] } } })).rejects.toThrow();
  const { destination: _, ...base } = request as any;
  await expect(s.handler({ app: {}, data: { ...base, kind: 'roundtrip', targetDistanceM: 10000 } })).rejects.toThrow(); expect(s.fetch).not.toHaveBeenCalled();
});
