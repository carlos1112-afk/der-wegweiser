// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { haversineMeters, calculateBearing, useRouteTracker } from '../../src/hooks/useRouteTracker';
import type { Route } from '../../src/types/navigation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Loc = { lat: number; lng: number };
type TrackerState = ReturnType<typeof useRouteTracker>;

function routeOf(coords: [number, number][]): Route {
  return { title: 'Testroute', pathCoordinates: coords } as unknown as Route;
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

describe('Szenario 7/8: Abbiegehinweise (echter Hook useRouteTracker)', () => {
  const A: [number, number] = [52.5, 13.4];
  const B: [number, number] = [52.501, 13.4];

  it('Rechtskurve nach Norden dann Osten: turn-right mit Entfernungstext', () => {
    const t = track(routeOf([A, B, [52.501, 13.4015], [52.501, 13.403]]));
    const s = t.move({ lat: A[0], lng: A[1] });
    expect(s.currentManeuver?.action).toBe('turn-right');
    expect(s.currentManeuver?.instruction).toMatch(/^In \d+m rechts abbiegen$/);
    expect(s.currentManeuver?.distanceM).toBeGreaterThan(105);
    expect(s.currentManeuver?.distanceM).toBeLessThan(117);
    expect(s.currentManeuver?.isApproaching).toBe(true);
    expect(s.currentManeuver?.isImminent).toBe(false);
  });

  it('Linkskurve: turn-left', () => {
    const t = track(routeOf([A, B, [52.501, 13.3985], [52.501, 13.397]]));
    const s = t.move({ lat: A[0], lng: A[1] });
    expect(s.currentManeuver?.action).toBe('turn-left');
    expect(s.currentManeuver?.instruction).toMatch(/^In \d+m links abbiegen$/);
  });

  it('gerade Strecke: straight', () => {
    const t = track(routeOf([A, B, [52.502, 13.4], [52.503, 13.4]]));
    const s = t.move({ lat: A[0], lng: A[1] });
    expect(s.currentManeuver?.action).toBe('straight');
  });

  it('am Routenende: arrive', () => {
    const coords: [number, number][] = [A, B, [52.502, 13.4], [52.503, 13.4]];
    const t = track(routeOf(coords));
    const s = t.move({ lat: 52.503, lng: 13.4 });
    expect(s.currentManeuver?.action).toBe('arrive');
  });

  it('ohne Route gibt es keinen Hinweis', () => {
    const t = track(null);
    const s = t.move({ lat: A[0], lng: A[1] });
    expect(s.currentManeuver).toBeNull();
    expect(s.isOffRoute).toBe(false);
  });
});

describe('Szenario 10: Abseits-der-Route-Erkennung (echter Hook)', () => {
  const route = routeOf([
    [52.5163, 13.3777],
    [52.517, 13.385],
    [52.518, 13.392],
    [52.5185, 13.395],
  ]);

  it('auf der Route: nicht abseits, Abstand nahe 0', () => {
    const cb = vi.fn();
    const t = track(route, cb);
    const s = t.move({ lat: 52.51705, lng: 13.3851 });
    expect(s.isOffRoute).toBe(false);
    expect(s.offRouteDistanceM).toBeLessThan(45);
    expect(cb).not.toHaveBeenCalled();
  });

  it('erst das zweite Update abseits (>45 m) löst Alarm und Neuberechnung aus', () => {
    const cb = vi.fn();
    const t = track(route, cb);
    const first = t.move({ lat: 52.5185, lng: 13.383 });
    expect(first.offRouteDistanceM).toBeGreaterThan(45);
    expect(first.isOffRoute).toBe(false);
    expect(cb).not.toHaveBeenCalled();

    const second = t.move({ lat: 52.51851, lng: 13.383 });
    expect(second.isOffRoute).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeGreaterThan(45);
  });

  it('Rückkehr auf die Route setzt den Alarm zurück', () => {
    const cb = vi.fn();
    const t = track(route, cb);
    t.move({ lat: 52.5185, lng: 13.383 });
    t.move({ lat: 52.51851, lng: 13.383 });
    const back = t.move({ lat: 52.51705, lng: 13.3851 });
    expect(back.isOffRoute).toBe(false);
  });

  it('ein einzelner Ausreißer löst keinen Alarm aus', () => {
    const cb = vi.fn();
    const t = track(route, cb);
    t.move({ lat: 52.5185, lng: 13.383 });
    const back = t.move({ lat: 52.51705, lng: 13.3851 });
    expect(back.isOffRoute).toBe(false);
    expect(cb).not.toHaveBeenCalled();
  });
});
