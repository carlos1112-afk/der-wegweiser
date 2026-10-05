// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fb = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string } },
  deleteUser: vi.fn(),
  deleteDoc: vi.fn(),
}));

vi.mock('../../src/firebase', () => ({ auth: fb.auth, db: {}, storage: {} }));
vi.mock('firebase/auth', () => ({ deleteUser: fb.deleteUser }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  deleteDoc: fb.deleteDoc,
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  listAll: vi.fn(async () => ({ items: [] })),
  deleteObject: vi.fn(),
}));

import { RoutingService } from '../../src/services/routingService';
import { ElevationService } from '../../src/services/elevationService';
import { GpxExportService } from '../../src/services/gpxExportService';
import { GpxImportService } from '../../src/services/gpxImportService';
import { AccountDeletionService } from '../../src/services/accountDeletionService';
import { filterUgcText } from '../../src/services/dataRepository';
import type { Route } from '../../src/types/navigation';

const prefs = { batteryCapacityWh: 625, maxElevationSlopePercent: 8 } as never;
const params = { startLat: 51.5, startLng: 14.3, targetDistanceKm: 20, batteryPercent: 80, bikeType: 'trekking' };

function geojsonRoute(n = 12) {
  const coordinates = Array.from({ length: n }, (_, i) => [14.3 + i * 0.001, 51.5 + i * 0.001, 100 + i]);
  return { features: [{ geometry: { coordinates }, properties: { 'track-length': '20000' } }] };
}

describe('Szenario 13: Offline-Resilienz (echter RoutingService, Höhendienst ersetzt)', () => {
  let elevation: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    elevation = vi.spyOn(ElevationService, 'getElevations').mockImplementation(async (c) => c.map(() => 0));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ohne Netz: markierter, ungeprüfter Korridor statt Absturz oder falscher Straßenroute', async () => {
    const offline = vi.fn(async () => { throw new Error('offline'); });
    const route = await RoutingService.generateBikeRoute(params, prefs, offline as never);
    expect(route.isRoadSnapped).toBe(false);
    expect(route.isOfflineFallbackCorridor).toBe(true);
    expect(route.routingEngineStatus).toBe('offline_corridor_unverified');
    expect(route.pathCoordinates.length).toBeGreaterThan(10);
    expect(route.title).toContain('Ungeprüfter');
    expect(offline).toHaveBeenCalledTimes(2);
  });

  it('BRouter erreichbar: straßengenaue Route mit unterstütztem Profil', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => geojsonRoute() }));
    const route = await RoutingService.generateBikeRoute(params, prefs, ok as never);
    expect(route.isRoadSnapped).toBe(true);
    expect(route.routingEngineStatus).toBe('online_brouter');
    expect(route.distanceKm).toBe(20);
    expect(String(ok.mock.calls[0][0])).toContain('profile=trekking&');
    expect(String(ok.mock.calls[0][0])).not.toContain('trekking-pedelec');
  });

  it('BRouter antwortet mit Fehler: OSRM übernimmt', async () => {
    const osrm = { routes: [{ distance: 15000, geometry: { coordinates: geojsonRoute().features[0].geometry.coordinates } }] };
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => osrm });
    const route = await RoutingService.generateBikeRoute(params, prefs, fetchFn as never);
    expect(route.isRoadSnapped).toBe(true);
    expect(route.distanceKm).toBe(15);
    expect(String(fetchFn.mock.calls[1][0])).toContain('router.project-osrm.org');
  });

  it('BEKANNTER FEHLER: bei echtem Totalausfall wirft die Planung, weil der Höhendienst keinen Fallback hat', async () => {
    elevation.mockRestore();
    const down = vi.fn(async () => { throw new Error('offline'); });
    await expect(RoutingService.generateBikeRoute(params, prefs, down as never))
      .rejects.toThrow('no fallback is permitted');
  });

  it('Korridor-Route hat Sicherheitsaufschlag auf den Energiebedarf', async () => {
    const down = vi.fn(async () => { throw new Error('offline'); });
    const ok = vi.fn(async () => ({ ok: true, json: async () => geojsonRoute() }));
    const corridor = await RoutingService.generateBikeRoute(params, prefs, down as never);
    const snapped = await RoutingService.generateBikeRoute({ ...params, targetDistanceKm: 20 }, prefs, ok as never);
    expect(corridor.estimatedBatteryConsumptionWh / corridor.distanceKm)
      .toBeGreaterThan(snapped.estimatedBatteryConsumptionWh / snapped.distanceKm);
  });
});

describe('Szenario 14: GPX-Export (echter GpxExportService)', () => {
  let captured = '';
  const route = {
    title: 'Spreetal & Rundkurs',
    summary: 'Test <b>',
    distanceKm: 12.5,
    elevationGainM: 80,
    pathCoordinates: [[51.5123, 14.3789], [51.514, 14.382]],
    waypoints: [{ id: 'w1', lat: 51.5123, lng: 14.3789, name: 'Start', category: 'start' }],
    chargingStopsOnRoute: [],
  } as unknown as Route;

  beforeEach(() => {
    captured = '';
    vi.stubGlobal('Blob', class { constructor(parts: string[]) { captured = parts.join(''); } });
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('erzeugt gültiges GPX 1.1 mit exakten Koordinaten', () => {
    GpxExportService.exportRouteToGpx(route);
    expect(captured.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(captured).toContain('<gpx version="1.1"');
    expect(captured).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(captured).toContain('<trkpt lat="51.5123" lon="14.3789">');
    expect(captured).toContain('<trkpt lat="51.514" lon="14.382">');
  });

  it('maskiert XML-Sonderzeichen in Titel und Beschreibung', () => {
    GpxExportService.exportRouteToGpx(route);
    expect(captured).toContain('Spreetal &amp; Rundkurs');
    expect(captured).toContain('Test &lt;b&gt;');
    expect(captured).not.toContain('Spreetal & Rundkurs');
  });

  it('Round-Trip: Export wieder importiert ergibt dieselben Koordinaten', () => {
    GpxExportService.exportRouteToGpx(route);
    const back = GpxImportService.parseGpx(captured, 'roundtrip.gpx');
    expect(back.pathCoordinates).toHaveLength(2);
    expect(back.pathCoordinates[0][0]).toBeCloseTo(51.5123, 6);
    expect(back.pathCoordinates[1][1]).toBeCloseTo(14.382, 6);
  });

  it('löst genau einen Download mit .gpx-Dateinamen aus', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    GpxExportService.exportRouteToGpx(route);
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('null-Route löst keinen Download aus', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    GpxExportService.exportRouteToGpx(null as never);
    expect(captured).toBe('');
  });
});

describe('Szenario 12: UGC-Filter (echtes filterUgcText)', () => {
  it('lehnt Spam und Beleidigungen ab, mit Begründung', () => {
    const r = filterUgcText('Free Casino Station');
    expect(r.isClean).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('lässt normale Stationsnamen durch', () => {
    expect(filterUgcText('Gasthof Lindengarten, Ladebox')).toEqual({ isClean: true });
    expect(filterUgcText('')).toEqual({ isClean: true });
  });

  it('lehnt Texte über 500 Zeichen ab', () => {
    const r = filterUgcText('a'.repeat(501));
    expect(r.isClean).toBe(false);
    expect(r.reason).toContain('500');
  });

  it('Wortgrenzen: Teilwörter wie "Arschenau" werden nicht blind zensiert', () => {
    expect(filterUgcText('Parschenau Ladepunkt').isClean).toBe(true);
  });
});

describe('Szenario 15: DSGVO Art. 17 Kontolöschung (echter AccountDeletionService)', () => {
  beforeEach(() => {
    fb.auth.currentUser = null;
    fb.deleteUser.mockReset();
    fb.deleteDoc.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('lokaler Nutzer: löscht localStorage und sessionStorage vollständig', async () => {
    localStorage.setItem('wegweiser_auth_token', 't');
    localStorage.setItem('wegweiser_saved_routes', '[]');
    sessionStorage.setItem('x', 'y');
    const r = await AccountDeletionService.executeFullAccountDeletion();
    expect(r.success).toBe(true);
    expect(r.localDataDeleted).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(fb.deleteUser).not.toHaveBeenCalled();
  });

  it('räumt auch Schlüssel anderer Herkunft ab (localStorage.clear, kein Präfix-Filter)', async () => {
    localStorage.setItem('third_party_cookie', 'allowed');
    await AccountDeletionService.executeFullAccountDeletion();
    expect(localStorage.getItem('third_party_cookie')).toBeNull();
  });

  it('angemeldeter Nutzer: Cloud-Dokumente werden vor dem Auth-Konto gelöscht', async () => {
    fb.auth.currentUser = { uid: 'u1' };
    fb.deleteUser.mockResolvedValue(undefined);
    const r = await AccountDeletionService.executeFullAccountDeletion();
    expect(r).toMatchObject({ success: true, authDeleted: true, cloudDataDeleted: true, localDataDeleted: true });
    expect(fb.deleteDoc).toHaveBeenCalled();
    const lastDocDelete = Math.max(...fb.deleteDoc.mock.invocationCallOrder);
    expect(lastDocDelete).toBeLessThan(fb.deleteUser.mock.invocationCallOrder[0]);
  });

  it('veraltete Anmeldung: Abbruch mit Hinweis, lokale Daten bleiben erhalten', async () => {
    fb.auth.currentUser = { uid: 'u1' };
    fb.deleteUser.mockRejectedValue({ code: 'auth/requires-recent-login' });
    localStorage.setItem('wegweiser_saved_routes', '[1]');
    const r = await AccountDeletionService.executeFullAccountDeletion();
    expect(r.success).toBe(false);
    expect(r.authDeleted).toBe(false);
    expect(r.localDataDeleted).toBe(false);
    expect(r.message).toContain('erneut an');
    expect(localStorage.getItem('wegweiser_saved_routes')).toBe('[1]');
  });
});
