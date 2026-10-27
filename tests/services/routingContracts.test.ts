import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { parseRouteRequest, validateRoute, isValidatedRoute } from '../../functions/src/routing/validation';
import { cumulativeDistances, projectRoute } from '../../functions/src/routing/geometry';
import type { RouteCandidateV1, RouteRequestV1 } from '../../functions/src/routing/contracts';
import { RouteCoordinator } from '../../src/services/routeCoordinator';
const hash = async (s: string) => createHash('sha256').update(s).digest('hex');
export function request(): RouteRequestV1 {
  return { version: 1, requestId: 'test-request', kind: 'destination', planning: 'standard',
    start: { lat: 52.52, lng: 13.40, source: 'manual', observedAt: 1, accuracyM: null, confirmed: true },
    destination: { lat: 52.52, lng: 13.42 }, mandatoryStops: [], interests: [],
    profile: { bike: 'bicycle', batteryPercent: 0, batteryCapacityWh: null, confirmedAt: 1, consentVersion: 'v1' },
    criteria: { hard: [], wishes: '', weights: { asphalt: 0, nature: 0, flat: 0 } } };
}
// Synthetic geometric fixture, deliberately NOT claimed as real BRouter output.
export function candidate(): RouteCandidateV1 {
  const geometry = [{ lat: 52.52, lng: 13.40 }, { lat: 52.52, lng: 13.41 }, { lat: 52.52, lng: 13.42 }];
  const distance = cumulativeDistances(geometry).at(-1)!;
  const unknown = { value: null, quality: 'unknown' as const, source: null };
  return { version: 1, id: 'fixture', requestId: 'test-request', execution: 'online', geometry,
    provenance: { engine: 'brouter', engineVersion: 'test-only', dataVersion: 'synthetic', profile: 'trekking' },
    criteriaFindings: [], maneuvers: [], metrics: { distanceM: { value: distance, source: 'geometry', quality: 'known' },
      ascentM: unknown, durationS: unknown, energyWh: unknown } };
}
describe('shared routing contract', () => {
  it('preserves zero battery and null unknowns, snapshots caller input', () => {
    const r = request(), parsed = parseRouteRequest(r);
    expect(parsed.profile.batteryPercent).toBe(0);
    expect(parsed.profile.batteryCapacityWh).toBeNull();
    expect(parsed).not.toBe(r);
  });
  it.each([null, {}, { ...request(), version: 2 }, { ...request(), planning: 'offline' },
    { ...request(), mandatoryStops: Array(6).fill({ lat: 52, lng: 13 }) },
    { ...request(), destination: { lat: NaN, lng: 13 } },
    { ...request(), start: { ...request().start, source: 'gps', accuracyM: null } },
    { ...request(), profile: { ...request().profile, batteryPercent: 101 } },
    { ...request(), criteria: { ...request().criteria, wishes: 'x'.repeat(2001) } },
    { ...request(), targetDistanceM: 5000 }, { ...request(), kind: 'roundtrip' }])('rejects invalid input %#', value => {
    expect(() => parseRouteRequest(value)).toThrow();
  });
  it('validates only track capability without source maneuvers; freezes geometry', async () => {
    const result = await validateRoute(request(), candidate(), hash);
    expect(result.guidanceCapability).toBe('track');
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(result.geometry[0])).toBe(true);
    expect(isValidatedRoute(result)).toBe(true);
    expect(isValidatedRoute(JSON.parse(JSON.stringify(result)))).toBe(false);
  });
  it('normalizes request hashes across field order and irrelevant fields', async () => {
    const first = await validateRoute(request(), candidate(), hash);
    const reordered = Object.fromEntries(Object.entries(request()).reverse());
    const second = await validateRoute({ ...reordered, ignoredMetadata: 'never hashed' } as any, candidate(), hash);
    expect(second.requestHash).toBe(first.requestHash);
  });
  it('rejects unverified corridors, bad provenance, malformed geometry, distance and endpoint errors', async () => {
    for (const value of [null, { ...candidate(), provenance: { engine: 'osrm' } }, { ...candidate(), geometry: [] },
      { ...candidate(), geometry: [{ lat: '52', lng: 13 }, { lat: 52, lng: 13 }] },
      { ...candidate(), geometry: [{ lat: 50, lng: 13 }, { lat: 50, lng: 13.01 }] },
      { ...candidate(), metrics: { ...candidate().metrics, distanceM: { value: 1, quality: 'known', source: 'test' } } }]) {
      await expect(validateRoute(request(), value as any, hash)).rejects.toThrow();
    }
  });
  it('checks vias on segments and preserves order', async () => {
    const via = (lng: number) => ({ lat: 52.52, lng });
    await expect(validateRoute({ ...request(), mandatoryStops: [via(13.405), via(13.415)] }, candidate(), hash)).resolves.toBeDefined();
    await expect(validateRoute({ ...request(), mandatoryStops: [via(13.415), via(13.405)] }, candidate(), hash)).rejects.toMatchObject({ code: 'VIA_ORDER_MISMATCH' });
  });
  it('does not treat missing evidence as satisfying a hard criterion', async () => {
    await expect(validateRoute({ ...request(), criteria: { ...request().criteria, hard: ['avoid_ferries'] } }, candidate(), hash))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_CRITERIA' });
  });
  it('rejects malformed maneuvers, accepts sourced maneuvers at matching chainage', async () => {
    const c = candidate();
    const maneuver = { geometryIndex: 1, distanceAlongM: cumulativeDistances(c.geometry)[1], action: 'straight' as const, instruction: 'Geradeaus', street: null };
    expect((await validateRoute(request(), { ...c, maneuvers: [maneuver] }, hash)).guidanceCapability).toBe('turn_by_turn');
    await expect(validateRoute(request(), { ...c, maneuvers: [{ ...maneuver, geometryIndex: 99 }] }, hash)).rejects.toThrow();
  });
  it('has point-density independent segment projection', () => {
    const p = { lat: 52.52, lng: 13.405 }, c = candidate();
    const dense = projectRoute(p, c.geometry)!;
    const sparse = projectRoute(p, [c.geometry[0], c.geometry[2]])!;
    expect(dense.distanceM).toBeLessThan(0.1);
    expect(dense.progressM).toBeCloseTo(sparse.progressM, 1);
  });
});
describe('coordinator generation and consent boundaries', () => {
  it('ignores late results after cancel, context change or a newer request', async () => {
    const route = await validateRoute(request(), candidate(), hash);
    const pending: Array<(route: typeof route) => void> = [];
    const signals: AbortSignal[] = [];
    const coordinator = new RouteCoordinator({ plan: async (_, signal) => { signals.push(signal); return new Promise(resolve => pending.push(resolve)); } });
    coordinator.setContext('uid', 'v1');
    const a = coordinator.plan(request());
    const b = coordinator.plan(request());
    pending[0](route); await a;
    expect(coordinator.state.status).toBe('planning');
    expect(signals[0].aborted).toBe(true);
    coordinator.setContext('other-uid', 'v1');
    pending[1](route); await b;
    expect(coordinator.state.status).toBe('idle');
    expect(coordinator.navigation).toBeNull();
  });
  it('blocks missing consent and premium without invoking the executor', async () => {
    let calls = 0;
    const coordinator = new RouteCoordinator({ plan: async () => { calls++; throw new Error(); } });
    await expect(coordinator.plan(request())).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    coordinator.setContext('uid', 'v1');
    await expect(coordinator.plan({ ...request(), planning: 'ai' })).rejects.toMatchObject({ code: 'PREMIUM_UNAVAILABLE' });
    expect(calls).toBe(0);
  });
  it('keeps navigation when planning a new preview; clears it on revocation', async () => {
    const route = await validateRoute(request(), candidate(), hash);
    const coordinator = new RouteCoordinator({ plan: async () => route });
    coordinator.setContext(null, 'v1');
    await coordinator.plan(request());
    coordinator.startNavigation({ version: 1, sessionId: 'session', originalRequest: request(), originalRoute: route,
      connector: null, progressM: 0, reachedMandatoryStopIndices: [], lastPosition: null, packageVersion: null });
    const active = coordinator.navigation;
    await coordinator.plan(request());
    expect(coordinator.navigation).toBe(active);
    coordinator.setContext(null, null);
    expect(coordinator.navigation).toBeNull();
  });
});
