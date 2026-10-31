// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fb = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string } },
  deleteUser: vi.fn(),
  deleteAccountData: vi.fn(),
  deleteDoc: vi.fn(),
}));

vi.mock('../../src/firebase', () => ({ auth: fb.auth, db: {}, storage: {}, functions: {} }));
vi.mock('firebase/auth', () => ({ deleteUser: fb.deleteUser }));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => fb.deleteAccountData) }));
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
import { ConsentService } from '../../src/services/consentService';
import { GpxExportService } from '../../src/services/gpxExportService';
import { GpxImportService } from '../../src/services/gpxImportService';
import { AccountDeletionService } from '../../src/services/accountDeletionService';
import { filterUgcText } from '../../src/services/dataRepository';
import type { Route } from '../../src/types/navigation';

const prefs = { batteryCapacityWh: 625, maxElevationSlopePercent: 8 } as never;
const params = { startLat: 51.5, startLng: 14.3, targetDistanceKm: 20, batteryPercent: 80, bikeType: 'trekking' };


describe('Szenario 13: keine startbaren Scheinrouten', () => {
  beforeEach(() => { ConsentService.save({ essential: true, analytics: false, surveys: false, personalizedAds: false }); });
  afterEach(() => vi.restoreAllMocks());
  it('legacy roundtrip is closed without BRouter/OSRM/circle fallback', async () => {
    const fetch = vi.fn();
    await expect(RoutingService.generateBikeRoute(params, prefs, fetch as never)).rejects.toMatchObject({ code: 'PREMIUM_UNAVAILABLE' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requires consent before any request', async () => {
    await ConsentService.withdraw(); const fetch = vi.fn();
    await expect(RoutingService.generateBikeRoute(params, prefs, fetch as never)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not pretend local routing or paid planning is available', async () => {
    const fetch = vi.fn();
    for (const mode of ['premium', 'offline'] as const) {
      await expect(RoutingService.generateDestinationRoute({ lat: 52.52, lng: 13.4 }, { lat: 52.53, lng: 13.4 }, prefs, { mode }, fetch as never)).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not use map-center coordinates as a confirmed GPS start', async () => {
    await expect(RoutingService.generateDestinationRoute({ lat: 52.52, lng: 13.4 }, { lat: 52.53, lng: 13.4 }, prefs, { mode: 'standard' })).rejects.toMatchObject({ code: 'INVALID_START' });
  });
  it('honors abort before any generation work', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(RoutingService.generateBikeRoute(params, prefs, undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
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
    fb.deleteAccountData.mockReset().mockResolvedValue({ data: { success: true, status: 'completed' } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('lokaler Nutzer: löscht localStorage und sessionStorage vollständig', async () => {
    localStorage.setItem('wegweiser_auth_token', 't');
    localStorage.setItem('wegweiser_saved_routes', '[]');
    sessionStorage.setItem('x', 'y');
    await expect(AccountDeletionService.deleteAccount()).resolves.toBeUndefined();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('räumt auch Schlüssel anderer Herkunft ab (localStorage.clear, kein Präfix-Filter)', async () => {
    localStorage.setItem('third_party_cookie', 'allowed');
    await AccountDeletionService.deleteAccount();
    expect(localStorage.getItem('third_party_cookie')).toBeNull();
  });

  it('angemeldeter Nutzer: ruft Server Cloud Function auf und leert lokale Daten', async () => {
    fb.auth.currentUser = { uid: 'u1' };
    await expect(AccountDeletionService.deleteAccount()).resolves.toBeUndefined();
    expect(fb.deleteAccountData).toHaveBeenCalled();
  });

  it('Serverfehler bei Kontolöschung: wirft Fehler und bricht lokale Löschung ab', async () => {
    fb.auth.currentUser = { uid: 'u1' };
    fb.deleteAccountData.mockRejectedValue(new Error('server down'));
    localStorage.setItem('wegweiser_saved_routes', '[1]');
    await expect(AccountDeletionService.deleteAccount()).rejects.toThrow('Die Kontolöschung konnte nicht abgeschlossen werden');
    expect(localStorage.getItem('wegweiser_saved_routes')).toBe('[1]');
  });
});
