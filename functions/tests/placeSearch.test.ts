jest.mock('firebase-functions/v2/https', () => ({
  onCall: (config: any, handler: any) => Object.assign(handler, { __config: config }),
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } },
}));
import { createPlaceSearchHandler, searchPlaces } from '../src/routing/placeSearch';
const row = { lat: '52.52', lon: '13.4', display_name: 'Berlin', osm_type: 'node', osm_id: 1 };
const caller = (query: unknown = 'Berlin') => ({ app: { appId: 'test' }, data: { query, consentVersion: 3 } });
const setup = (rows: unknown = [row], base = 'http://operator.internal/') => {
  const fetch = jest.fn(async () => new Response(JSON.stringify(rows), { status: 200 }));
  const rateLimit = jest.fn(async () => {});
  const enabled = jest.fn(async () => true);
  const handler = createPlaceSearchHandler({ baseUrl: () => base, enabled, rateLimit, fetch: fetch as any });
  return { fetch, handler, enabled, rateLimit };
};
it('uses operator jsonv2 search with five results only, no caller-controlled upstream', async () => {
  const { handler, fetch, rateLimit } = setup();
  expect(await handler(caller())).toEqual({ results: [{ id: 'osm:node:1', lat: 52.52, lng: 13.4, label: 'Berlin', source: 'osm' }], osmAvailable: true });
  const url = new URL(String((fetch.mock.calls[0] as unknown as unknown[])[0]));
  expect(url.origin).toBe('http://operator.internal'); expect(url.searchParams.get('limit')).toBe('5');
  expect(url.searchParams.get('format')).toBe('jsonv2'); expect(url.searchParams.get('q')).toBe('Berlin');
  expect(rateLimit).toHaveBeenCalledTimes(1);
  expect((searchPlaces as any).__config.enforceAppCheck).toBe(true);
});
it('rejects unauthenticated app, absent consent and invalid input before upstream requests', async () => {
  const { handler, fetch } = setup();
  await expect(handler({ ...caller(), app: null })).rejects.toMatchObject({ code: 'unauthenticated' });
  await expect(handler({ ...caller(), data: { query: 'Berlin' } })).rejects.toThrow('CONSENT_REQUIRED');
  for (const query of ['', '\x01Berlin', 'a'.repeat(101), 4, null]) await expect(handler(caller(query))).rejects.toMatchObject({ code: 'invalid-argument' });
  expect(fetch).not.toHaveBeenCalled();
});
it('keeps a missing/disabled/public operator closed and never falls back', async () => {
  for (const base of ['', 'file:///tmp/data', 'https://nominatim.openstreetmap.org/', 'http://user:pass@host/']) {
    const { handler, fetch } = setup([], base); await expect(handler(caller())).resolves.toEqual({ results: [], osmAvailable: false }); expect(fetch).not.toHaveBeenCalled();
  }
  const deps = setup(); deps.enabled.mockResolvedValue(false);
  await expect(deps.handler(caller())).resolves.toEqual({ results: [], osmAvailable: false }); expect(deps.fetch).not.toHaveBeenCalled();
});
it('handles empty results; rejects invalid coordinates, malformed JSON shapes and oversized payloads', async () => {
  expect(await setup([]).handler(caller())).toEqual({ results: [], osmAvailable: true });
  for (const result of [{}, [null], [{ ...row, lat: '' }], [{ ...row, lon: '181' }], [{ ...row, osm_type: 'unknown' }], Array(6).fill(row), 'x'.repeat(130000)]) {
    await expect(setup(result).handler(caller())).resolves.toEqual({ results: [], osmAvailable: false });
  }
});
it('keeps internal Wegweiser destinations visible when the public geocoder is malformed', async () => {
  const internal = { id: 'wegweiser:points_of_interest/1', lat: 52.52, lng: 13.4, label: 'Gemeinschaftsgarten', source: 'wegweiser' as const };
  const deps = setup([null]);
  const handler = createPlaceSearchHandler({ baseUrl: () => 'http://operator.internal/', enabled: async () => true,
    searchInternal: async () => [internal], rateLimit: async () => {}, fetch: deps.fetch as any });
  await expect(handler(caller())).resolves.toEqual({ results: [internal], osmAvailable: false });
});
it('propagates rate limit errors without querying operator', async () => {
  const deps = setup(); deps.rateLimit.mockRejectedValue(new Error('limit'));
  await expect(deps.handler(caller())).rejects.toThrow('limit'); expect(deps.fetch).not.toHaveBeenCalled();
});
