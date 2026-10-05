/**
 * Mutation-Test-Ergänzung (Lauf A) für PremiumKeyService.
 * Tötet überlebende Mutanten: App-Check-Bindung (Authorization-Header, forceRefresh),
 * Request-Form (URL, Methode, Header, Body), exakte Fehlermeldungen/Codes,
 * Initialzustand des Rate-Limiters. Kein Netzwerk: fetch und App Check sind gemockt.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const getTokenMock = vi.fn();
vi.mock('firebase/app-check', () => ({
  getToken: (...args: unknown[]) => getTokenMock(...args),
}));

import {
  getGoogleMapsKey,
  setAppCheckInstance,
  _resetForTesting,
  UserFacingError,
} from './PremiumKeyService';

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  _resetForTesting();
  getTokenMock.mockReset();
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
  vi.stubEnv('VITE_FIREBASE_FUNCTIONS_URL', 'https://fake.functions.url');
  mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ key: 'K' }) });
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function errOf(p: Promise<unknown>): Promise<UserFacingError> {
  return (await p.catch((e) => e)) as UserFacingError;
}

describe('Request-Form', () => {
  it('sendet POST mit JSON-Header, leerem Body an <url>/issueGoogleMapsKey', async () => {
    await getGoogleMapsKey();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://fake.functions.url/issueGoogleMapsKey');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe('{}');
  });
});

describe('App-Check-Instanzbindung', () => {
  it('hängt Bearer-Token an und holt es ohne forceRefresh', async () => {
    const instance = { name: 'appcheck' } as any;
    setAppCheckInstance(instance);
    getTokenMock.mockResolvedValue({ token: 'TOK123' });
    await getGoogleMapsKey();
    expect(getTokenMock).toHaveBeenCalledWith(instance, false);
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TOK123',
    });
  });

  it('sendet KEINEN Authorization-Header bei leerem Token', async () => {
    setAppCheckInstance({} as any);
    getTokenMock.mockResolvedValue({ token: '' });
    await getGoogleMapsKey();
    expect(mockFetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('läuft ohne Token weiter, wenn getToken fehlschlägt, und warnt exakt', async () => {
    setAppCheckInstance({} as any);
    const boom = new Error('appcheck down');
    getTokenMock.mockRejectedValue(boom);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(getGoogleMapsKey()).resolves.toBe('K');
    expect(warn).toHaveBeenCalledWith('[PremiumKeyService] App Check token nicht verfügbar:', boom);
    expect(mockFetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('Exakte Fehlermeldungen und Codes', () => {
  it('MISSING_FUNCTIONS_URL', async () => {
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_URL', '');
    const e = await errOf(getGoogleMapsKey());
    expect(e.code).toBe('MISSING_FUNCTIONS_URL');
    expect(e.message).toBe(
      'Firebase Functions URL ist nicht konfiguriert (VITE_FIREBASE_FUNCTIONS_URL fehlt).',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('PAYMENT_REQUIRED (402)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 402, json: async () => ({}) });
    const e = await errOf(getGoogleMapsKey());
    expect(e.message).toBe('Kein aktives Premium-Abonnement. Bitte Premium erwerben, um fortzufahren.');
  });

  it('FORBIDDEN (403)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    const e = await errOf(getGoogleMapsKey());
    expect(e.message).toBe('Zugriff verweigert. Bitte erneut anmelden und es noch einmal versuchen.');
  });

  it('HTTP_ERROR enthält den Status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const e = await errOf(getGoogleMapsKey());
    expect(e.message).toBe('Schlüsselanforderung fehlgeschlagen (HTTP 503).');
  });

  it('INVALID_RESPONSE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const e = await errOf(getGoogleMapsKey());
    expect(e.message).toBe('Ungültige Antwort vom Schlüssel-Service.');
  });

  it('RATE_LIMIT_EXCEEDED Text, und ohne Fetch beim 6. Aufruf', async () => {
    const { clearKeyCache } = await import('./PremiumKeyService');
    for (let i = 0; i < 5; i++) {
      clearKeyCache();
      await getGoogleMapsKey();
    }
    clearKeyCache();
    const e = await errOf(getGoogleMapsKey());
    expect(e.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(e.message).toBe('Zu viele Schlüsselanforderungen. Bitte warte eine Minute.');
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });
});

describe('Ohne registrierte App-Check-Instanz (frisches Modul)', () => {
  it('ruft getToken nicht auf und sendet keinen Authorization-Header', async () => {
    vi.resetModules();
    const fresh = await import('./PremiumKeyService');
    await expect(fresh.getGoogleMapsKey()).resolves.toBe('K');
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(mockFetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('Rate-Limiter Initialzustand (frisches Modul)', () => {
  it('erlaubt in einem frischen Modul genau 5 Anfragen', async () => {
    vi.resetModules();
    const fresh = await import('./PremiumKeyService');
    for (let i = 0; i < 5; i++) {
      fresh.clearKeyCache();
      await expect(fresh.getGoogleMapsKey()).resolves.toBe('K');
    }
    fresh.clearKeyCache();
    const e = (await fresh.getGoogleMapsKey().catch((x) => x)) as UserFacingError;
    expect(e.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
