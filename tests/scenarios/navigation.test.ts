// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { haversineMeters, calculateBearing, useRouteTracker } from '../../src/hooks/useRouteTracker';
import { createHash } from 'node:crypto';
import { validateRoute } from '../../functions/src/routing/validation';
import { cumulativeDistances } from '../../functions/src/routing/geometry';
import type { ManeuverAction, RouteCandidateV1, RouteRequestV1 } from '../../src/types/routing';
import type { Route } from '../../src/types/navigation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Loc = { lat: number; lng: number; accuracyM?: number | null; observedAt?: number | null };
type TrackerState = ReturnType<typeof useRouteTracker>;

async function routeOf(coords: [number, number][], action?: ManeuverAction): Promise<Route> {
  const geometry = coords.map(([lat, lng]) => ({ lat, lng })), lengths = cumulativeDistances(geometry);
  const req: RouteRequestV1 = { version: 1, requestId: 'hook-test', planning: 'standard', kind: 'destination',
    start: { ...geometry[0], source: 'manual', observedAt: 1, accuracyM: null, confirmed: true }, destination: geometry[geometry.length - 1],
    mandatoryStops: [], interests: [], criteria: { hard: [], wishes: '', weights: { asphalt: 0, nature: 0, flat: 0 } },
    profile: { bike: 'bicycle', batteryPercent: null, batteryCapacityWh: null, confirmedAt: 1, consentVersion: '2' } };
  const unknown = { value: null, source: null, quality: 'unknown' as const };
  const index = action === 'arrive' ? geometry.length - 1 : 1;
  const candidate: RouteCandidateV1 = { version: 1, id: 'synthetic', requestId: req.requestId, execution: 'online', geometry,
    metrics: { distanceM: { value: lengths[lengths.length - 1], source: 'synthetic', quality: 'known' }, ascentM: unknown, durationS: unknown, energyWh: unknown },
    provenance: { engine: 'brouter', engineVersion: 'synthetic', dataVersion: 'synthetic', profile: 'trekking' }, criteriaFindings: [],
    maneuvers: action ? [{ geometryIndex: index, distanceAlongM: lengths[index], action, instruction: 'Vom Router übernommener Hinweis', street: null }] : [] };
  const validatedRoute = await validateRoute(req, candidate, async text => createHash('sha256').update(text).digest('hex'));
  return { id: 'synthetic', title: 'Testroute', pathCoordinates: coords, validatedRoute } as Route;
}
function fix(lat: number, lng: number, observedAt = 1000, accuracyM = 5): Loc {
  vi.spyOn(Date, 'now').mockReturnValue(observedAt);
  return { lat, lng, observedAt, accuracyM };
}

function mountTracker(route: Route | null, onOffRoute?: (d: number) => void) {
  const host = document.createElement('div');
  const root: Root = createRoot(host);
  let latest: TrackerState | null = null;

  function Probe({ loc }: { loc: Loc }) {
    latest = useRouteTracker(loc, route, onOffRoute);
    return null;
  }

  return {
    move(loc: Loc) {
      act(() => root.render(createElement(Probe, { loc })));
      return latest as unknown as TrackerState;
    },
    unmount() {
      act(() => root.unmount());
    },
  };
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  mounted.splice(0).forEach((m) => m.unmount());
  vi.restoreAllMocks();
});
function track(route: Route | null, onOffRoute?: (d: number) => void) {
  const m = mountTracker(route, onOffRoute);
  mounted.push(m);
  return m;
}

describe('Szenario 2: Distanz (echtes haversineMeters)', () => {
  it('Brandenburger Tor bis Alexanderplatz liegt bei rund 2,5 km', () => {
    const d = haversineMeters(52.5163, 13.3777, 52.5219, 13.4132);
    expect(d).toBeGreaterThan(2400);
    expect(d).toBeLessThan(2600);
  });

  it('identische Punkte ergeben 0 m, ein 0,00018°-Versatz bleibt unter 25 m', () => {
    expect(haversineMeters(52.5163, 13.3777, 52.5163, 13.3777)).toBe(0);
    expect(haversineMeters(52.5163, 13.3777, 52.51632, 13.3778)).toBeLessThan(25);
  });

  it('ist symmetrisch', () => {
    const a = haversineMeters(48.1, 11.5, 48.2, 11.6);
    const b = haversineMeters(48.2, 11.6, 48.1, 11.5);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('Szenario 7: Peilung (echtes calculateBearing)', () => {
  it('Norden ist 0°, Osten 90°, Süden 180°', () => {
    expect(calculateBearing(52.5, 13.4, 52.6, 13.4)).toBeCloseTo(0, 1);
    expect(calculateBearing(0, 13.4, 0, 13.5)).toBeCloseTo(90, 1);
    expect(Math.abs(calculateBearing(52.5, 13.4, 52.4, 13.4))).toBeCloseTo(180, 1);
  });

  it('Westen liefert -90° (der echte Code normalisiert nicht auf 0..360)', () => {
    expect(calculateBearing(0, 13.5, 0, 13.4)).toBeCloseTo(-90, 1);
  });
});

describe('Szenario 7/8: nur belegte Routermanöver', () => {
  const coords: [number, number][] = [[52.5, 13.4], [52.501, 13.4], [52.501, 13.402]];
  it.each(['turn-right', 'turn-left', 'straight'] as const)('übernimmt %s aus Routerdaten statt Winkel/Straßennamen zu erfinden', async action => {
    const t = track(await routeOf(coords, action));
    const state = t.move(fix(52.5, 13.4));
    expect(state.currentManeuver?.action).toBe(action);
    expect(state.currentManeuver?.instruction).toBe('Vom Router übernommener Hinweis');
    expect(state.currentManeuver?.nextStreet).toBe('Straße unbekannt');
    expect(state.currentManeuver?.distanceM).toBeGreaterThan(105);
    expect(state.currentManeuver?.distanceM).toBeLessThan(117);
  });
  it('behauptet ohne validierte Manöver oder brauchbare Position keine Führung', async () => {
    expect(track(await routeOf(coords)).move(fix(52.5, 13.4)).currentManeuver).toBeNull();
    const t = track(await routeOf(coords, 'turn-right'));
    expect(t.move({ lat: 52.5, lng: 13.4 }).positionUncertain).toBe(true);
    expect(t.move(fix(52.5, 13.4, 1000, 100)).currentManeuver).toBeNull();
    expect(track({ title: 'GPX', pathCoordinates: coords } as Route).move(fix(52.5, 13.4)).currentManeuver).toBeNull();
    expect(track(null).move(fix(52.5, 13.4)).currentManeuver).toBeNull();
  });
  it('Ankunft erfordert Fortschritt bis zum Ende und Zielnähe', async () => {
    const line: [number, number][] = [[52.5, 13.4], [52.501, 13.4], [52.502, 13.4], [52.503, 13.4]];
    const t = track(await routeOf(line, 'arrive'));
    expect(t.move(fix(52.503, 13.4)).currentManeuver).toBeNull();
    // A new session starts at the start, then proceeds through successive fresh positions.
    const journey = track(await routeOf(line, 'arrive'));
    journey.move(fix(52.5, 13.4)); journey.move(fix(52.501, 13.4, 10000)); journey.move(fix(52.502, 13.4, 20000));
    expect(journey.move(fix(52.503, 13.4, 30000)).currentManeuver?.action).toBe('arrive');
  });
});
describe('Szenario 10: belastbare Abweichung und Rückkehr', () => {
  const coords: [number, number][] = [[52.5, 13.4], [52.501, 13.4], [52.502, 13.4], [52.503, 13.4]];
  it('projiziert auf dünne Segmente statt nur Stützpunkte', async () => {
    const cb = vi.fn(), t = track(await routeOf(coords), cb);
    const state = t.move(fix(52.5005, 13.4));
    expect(state.offRouteDistanceM).toBeLessThan(1); expect(cb).not.toHaveBeenCalled();
  });
  it('fordert erst nach drei brauchbaren Messungen über acht Sekunden begrenzt Rückführung an', async () => {
    const cb = vi.fn(), t = track(await routeOf(coords), cb);
    expect(t.move(fix(52.4995, 13.4)).isOffRoute).toBe(false);
    expect(t.move(fix(52.4995, 13.4, 5000)).isOffRoute).toBe(false);
    expect(t.move(fix(52.4995, 13.4, 9000)).isOffRoute).toBe(true);
    t.move(fix(52.4995, 13.4, 13000)); expect(cb).toHaveBeenCalledTimes(1);
    expect(t.move(fix(52.5, 13.4, 18000)).isOffRoute).toBe(true);
    expect(t.move(fix(52.5, 13.4, 23000)).isOffRoute).toBe(false);
  });
  it('ein Positionssprung erzeugt Unsicherheit statt Alarm oder Ankunft', async () => {
    const cb = vi.fn(), t = track(await routeOf(coords), cb);
    t.move(fix(52.5, 13.4)); const state = t.move(fix(52.6, 13.4, 2000));
    expect(state.positionUncertain).toBe(true); expect(state.currentManeuver).toBeNull(); expect(cb).not.toHaveBeenCalled();
  });
});
