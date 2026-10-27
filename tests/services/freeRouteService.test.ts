import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import { FreeRouteService } from '../../src/services/freeRouteService';
import { PlaceSearchService } from '../../src/services/placeSearchService';
import { ConsentService } from '../../src/services/consentService';
import { validateRoute } from '../../functions/src/routing/validation';
import { cumulativeDistances } from '../../functions/src/routing/geometry';
import type { RouteCandidateV1, RouteRequestV1 } from '../../src/types/routing';
const mocks = vi.hoisted(() => ({ call: vi.fn(), auth: { currentUser: null as { uid: string } | null } }));
vi.mock('../../src/firebase', () => ({ functions: {}, auth: mocks.auth }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => mocks.call }));
const request: RouteRequestV1 = { version: 1, requestId: 'free-client', kind: 'destination', planning: 'standard',
  start: { lat: 52.52, lng: 13.4, source: 'manual', observedAt: 1, accuracyM: null, confirmed: true }, destination: { lat: 52.52, lng: 13.402 },
  mandatoryStops: [], interests: [], criteria: { hard: [], wishes: '', weights: { asphalt: 0, nature: 0, flat: 0 } },
  profile: { bike: 'bicycle', batteryPercent: 0, batteryCapacityWh: null, confirmedAt: 1, consentVersion: '2' } };
async function result() {
  const geometry = [request.start, { lat: 52.52, lng: 13.401 }, { lat: 52.52, lng: 13.402 }].map(p => ({ lat: p.lat, lng: p.lng }));
  const unknown = { value: null, source: null, quality: 'unknown' as const };
  const candidate: RouteCandidateV1 = { version: 1, id: 'free', requestId: request.requestId, execution: 'online', geometry, maneuvers: [], criteriaFindings: [],
    provenance: { engine: 'brouter', engineVersion: 'synthetic', dataVersion: 'synthetic', profile: 'trekking' },
    metrics: { distanceM: { value: cumulativeDistances(geometry).at(-1)!, quality: 'known', source: 'synthetic' }, ascentM: unknown, energyWh: unknown, durationS: unknown } };
  const route = await validateRoute(request, candidate, async text => createHash('sha256').update(text).digest('hex'));
  return { data: { route, tokenCost: 0 } };
}
beforeEach(() => { mocks.call.mockReset(); mocks.auth.currentUser = null; vi.stubGlobal('crypto', webcrypto); ConsentService.save({ essential: true, analytics: false, surveys: false, personalizedAds: false }); });
afterEach(() => vi.unstubAllGlobals());
it('revalidates server geometry and hashes without converting missing metrics to zero', async () => {
  mocks.call.mockResolvedValue(await result()); const route = await FreeRouteService.plan(request);
  expect(route.metrics.ascentM.value).toBeNull(); expect(route.guidanceCapability).toBe('track'); expect(route.requestId).toBe(request.requestId);
});
it('rejects paid free results, changed hashes and invalid endpoint geometry', async () => {
  const valid = await result();
  for (const data of [{ ...valid.data, tokenCost: 1 }, { ...valid.data, route: { ...valid.data.route, contentHash: 'a'.repeat(64) } },
    { ...valid.data, route: { ...valid.data.route, geometry: [{ lat: 0, lng: 0 }, { lat: 0, lng: .01 }] } }]) {
    mocks.call.mockResolvedValue({ data }); await expect(FreeRouteService.plan(request)).rejects.toThrow();
  }
});
it.each(['abort', 'consent', 'auth'])('ignores a late callable answer after %s', async reason => {
  let resolve: (value: unknown) => void = () => {}; mocks.call.mockImplementation(() => new Promise(done => { resolve = done; }));
  const controller = new AbortController(); const pending = FreeRouteService.plan(request, controller.signal);
  if (reason === 'abort') controller.abort(); if (reason === 'consent') await ConsentService.withdraw(); if (reason === 'auth') mocks.auth.currentUser = { uid: 'other' };
  resolve(await result()); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
it('coordinates are selected locally and malformed remote search results are refused', async () => {
  const signal = new AbortController().signal;
  expect(await PlaceSearchService.search('52.52, 13.4', signal)).toMatchObject([{ lat: 52.52, lng: 13.4 }]); expect(mocks.call).not.toHaveBeenCalled();
  await expect(PlaceSearchService.search('91, 13.4', signal)).rejects.toThrow();
  mocks.call.mockResolvedValue({ data: { results: [{ lat: '52.52', lng: 13.4, label: 'Wrong' }] } });
  await expect(PlaceSearchService.search('Berlin', signal)).rejects.toThrow();
});
