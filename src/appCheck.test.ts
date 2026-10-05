import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializeAppCheck: vi.fn(),
  v3Ctor: vi.fn(),
  enterpriseCtor: vi.fn(),
  setAppCheckInstance: vi.fn(),
}));

vi.mock('firebase/app-check', () => {
  class ReCaptchaV3Provider {
    kind = 'v3';
    siteKey: string;
    constructor(siteKey: string) { this.siteKey = siteKey; mocks.v3Ctor(siteKey); }
  }
  class ReCaptchaEnterpriseProvider {
    kind = 'enterprise';
    siteKey: string;
    constructor(siteKey: string) { this.siteKey = siteKey; mocks.enterpriseCtor(siteKey); }
  }
  return {
    ReCaptchaV3Provider,
    ReCaptchaEnterpriseProvider,
    initializeAppCheck: (...a: unknown[]) => mocks.initializeAppCheck(...a),
  };
});

vi.mock('./services/PremiumKeyService', () => ({
  setAppCheckInstance: (...a: unknown[]) => mocks.setAppCheckInstance(...a),
}));

import { initAppCheck } from './appCheck';

const app = { options: { appId: '1:123:web:abc' } } as never;
const instance = { name: 'app-check-instance' };
const debugGlobal = globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.initializeAppCheck.mockReturnValue(instance);
  delete debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN;
});

afterEach(() => {
  delete debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN;
  vi.restoreAllMocks();
});

describe('initAppCheck', () => {
  it('tut ohne Site-Key nichts und gibt null zurück', () => {
    expect(initAppCheck(app, {}, false)).toBeNull();
    expect(initAppCheck(app, { VITE_APPCHECK_SITE_KEY: '' }, false)).toBeNull();
    expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
    expect(mocks.setAppCheckInstance).not.toHaveBeenCalled();
  });

  it('tut ohne appId nichts, auch mit Site-Key', () => {
    const noAppId = { options: { appId: '' } } as never;
    expect(initAppCheck(noAppId, { VITE_APPCHECK_SITE_KEY: 'k' }, false)).toBeNull();
    expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
  });

  it('nutzt standardmäßig reCAPTCHA v3 mit dem Site-Key und aktiviert Auto-Refresh', () => {
    const res = initAppCheck(app, { VITE_APPCHECK_SITE_KEY: 'site-key' }, false);
    expect(res).toBe(instance);
    expect(mocks.v3Ctor).toHaveBeenCalledWith('site-key');
    expect(mocks.enterpriseCtor).not.toHaveBeenCalled();
    expect(mocks.initializeAppCheck).toHaveBeenCalledTimes(1);
    const [calledApp, options] = mocks.initializeAppCheck.mock.calls[0];
    expect(calledApp).toBe(app);
    expect(options.provider.kind).toBe('v3');
    expect(options.isTokenAutoRefreshEnabled).toBe(true);
  });

  it('VITE_APPCHECK_PROVIDER=enterprise nutzt reCAPTCHA Enterprise', () => {
    initAppCheck(app, { VITE_APPCHECK_SITE_KEY: 'ek', VITE_APPCHECK_PROVIDER: 'enterprise' }, false);
    expect(mocks.enterpriseCtor).toHaveBeenCalledWith('ek');
    expect(mocks.v3Ctor).not.toHaveBeenCalled();
    expect(mocks.initializeAppCheck.mock.calls[0][1].provider.kind).toBe('enterprise');
  });

  it('jeder andere Providerwert bleibt bei v3', () => {
    initAppCheck(app, { VITE_APPCHECK_SITE_KEY: 'k', VITE_APPCHECK_PROVIDER: 'irgendwas' }, false);
    expect(mocks.v3Ctor).toHaveBeenCalled();
    expect(mocks.enterpriseCtor).not.toHaveBeenCalled();
  });

  it('registriert die Instanz im PremiumKeyService', () => {
    initAppCheck(app, { VITE_APPCHECK_SITE_KEY: 'k' }, false);
    expect(mocks.setAppCheckInstance).toHaveBeenCalledTimes(1);
    expect(mocks.setAppCheckInstance).toHaveBeenCalledWith(instance);
  });

  it('setzt im Entwicklungsmodus das Debug-Token auf true', () => {
    initAppCheck(app, { VITE_APPCHECK_SITE_KEY: 'k' }, true);
    expect(debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
  });

  it('nimmt im Entwicklungsmodus ein festes Debug-Token aus der Umgebung', () => {
    initAppCheck(app, { VITE_APPCHECK_SITE_KEY: 'k', VITE_APPCHECK_DEBUG_TOKEN: 'fest-123' }, true);
    expect(debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('fest-123');
  });

  it('setzt in Produktion nie ein Debug-Token, auch nicht bei gesetzter Variable', () => {
    initAppCheck(app, { VITE_APPCHECK_SITE_KEY: 'k', VITE_APPCHECK_DEBUG_TOKEN: 'fest-123' }, false);
    expect(debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it('setzt kein Debug-Token, wenn App Check gar nicht konfiguriert ist', () => {
    initAppCheck(app, { VITE_APPCHECK_DEBUG_TOKEN: 'x' }, true);
    expect(debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it('Fehler bei der Initialisierung stürzen die App nicht ab und registrieren nichts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.initializeAppCheck.mockImplementationOnce(() => { throw new Error('already initialized'); });
    expect(initAppCheck(app, { VITE_APPCHECK_SITE_KEY: 'k' }, false)).toBeNull();
    expect(mocks.setAppCheckInstance).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
