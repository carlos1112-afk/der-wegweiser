import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { NavigationProgress } from '../../src/services/navigationProgress';
import { validateRoute } from '../../functions/src/routing/validation';
import { cumulativeDistances } from '../../functions/src/routing/geometry';
import type { RouteCandidateV1, RouteLocation, RouteRequestV1 } from '../../src/types/routing';
const start = { lat: 52.52, lng: 13.4 };
const fix = (time: number, lat = start.lat, lng = start.lng, accuracyM = 5): RouteLocation =>
  ({ lat, lng, source: 'gps', observedAt: time, accuracyM, confirmed: true });
async function route(loop = false) {
  const geometry = [start, { lat: 52.52, lng: 13.41 }, { lat: 52.53, lng: 13.41 }, ...(loop ? [start] : [])];
  const r: RouteRequestV1 = { version: 1, kind: 'destination', planning: 'standard', requestId: 'test', start: fix(0),
    destination: geometry.at(-1)!, mandatoryStops: [], interests: [], criteria: { hard: [], wishes: '', weights: { asphalt: 0, nature: 0, flat: 0 } },
    profile: { bike: 'bicycle', batteryPercent: null, batteryCapacityWh: null, confirmedAt: 0, consentVersion: 'v1' } };
  const unknown = { value: null, quality: 'unknown' as const, source: null };
  const c: RouteCandidateV1 = { version: 1, id: 'test', requestId: 'test', execution: 'online', geometry, maneuvers: [], criteriaFindings: [],
    provenance: { engine: 'brouter', engineVersion: 'synthetic', dataVersion: 'synthetic', profile: 'trekking' },
    metrics: { distanceM: { value: cumulativeDistances(geometry).at(-1)!, quality: 'known', source: 'geometry' },
      ascentM: unknown, durationS: unknown, energyWh: unknown } };
  return validateRoute(r, c, async s => createHash('sha256').update(s).digest('hex'));
}
describe('progress preparation, synthetic geometry only', () => {
  it('does not arrive at start of loop', async () => {
    const tracker = new NavigationProgress(await route(true));
    expect(tracker.update(fix(1000), 1000).status).toBe('on_route');
    expect(tracker.update(fix(6000), 6000).progressM).toBe(0);
  });
  it('projects sparse segments without spurious offroute alerts', async () => {
    const tracker = new NavigationProgress(await route());
    tracker.update(fix(0), 0);
    expect(tracker.update(fix(5000, start.lat, 13.4005), 5000).distanceFromRouteM).toBeLessThan(1);
  });
  it('needs three good fixes over eight seconds, one request and a cooldown', async () => {
    const tracker = new NavigationProgress(await route());
    expect(tracker.update(fix(0, 52.5195), 0).shouldRequestRejoin).toBe(false);
    expect(tracker.update(fix(4000, 52.5195), 4000).shouldRequestRejoin).toBe(false);
    expect(tracker.update(fix(8000, 52.5195), 8000).shouldRequestRejoin).toBe(true);
    expect(tracker.update(fix(12000, 52.5195), 12000).shouldRequestRejoin).toBe(false);
    tracker.finishRejoin();
    expect(tracker.update(fix(16000, 52.5195), 16000).shouldRequestRejoin).toBe(false);
    expect(tracker.update(fix(28000, 52.5195), 28000).shouldRequestRejoin).toBe(true);
  });
  it('stale, inaccurate or jumping fixes reset evidence', async () => {
    const tracker = new NavigationProgress(await route());
    tracker.update(fix(0), 0);
    expect(tracker.update(fix(1000, 52.6), 1000).status).toBe('position_uncertain');
    expect(tracker.update(fix(2000, 52.5195, start.lng, 100), 2000).status).toBe('position_uncertain');
    expect(tracker.update(fix(3000), 14000).status).toBe('position_uncertain');
  });
  it('two fixes for five seconds confirm return and candidate chainage never skips next mandatory stop', async () => {
    const tracker = new NavigationProgress(await route());
    tracker.update(fix(0, 52.5195), 0); tracker.update(fix(4000, 52.5195), 4000); tracker.update(fix(8000, 52.5195), 8000);
    expect(tracker.update(fix(13000), 13000).status).toBe('off_route');
    expect(tracker.update(fix(18000), 18000).status).toBe('on_route');
    expect(tracker.rejoinCandidates(200)).toHaveLength(5);
    expect(tracker.rejoinCandidates(200).every(c => c.progressM <= 200)).toBe(true);
    expect(tracker.rejoinCandidates(0)).toEqual([]);
  });
});
