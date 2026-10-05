/**
 * Unit-Tests für ConsentService (DSGVO Art. 6/7, § 25 TDDDG) — Lauf A.
 * localStorage/sessionStorage sind in-memory gestubbt (kein Browser, kein Netz).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConsentService, CONSENT_VERSION } from './consentService';

const KEY = 'der_wegweiser_legal_consent';

function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    _map: m,
  };
}

let ls: ReturnType<typeof makeStorage>;
let ss: ReturnType<typeof makeStorage>;

beforeEach(() => {
  ls = makeStorage();
  ss = makeStorage();
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('sessionStorage', ss);
  // Listener-Zustand zurücksetzen
  (ConsentService as any).listeners = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const stored = (o: object) => ls.setItem(KEY, JSON.stringify(o));
const valid = (extra: object = {}) => ({
  essential: true,
  analytics: true,
  surveys: true,
  personalizedAds: true,
  acceptedAt: '2026-01-01T00:00:00.000Z',
  version: CONSENT_VERSION,
  ...extra,
});

describe('getConsent', () => {
  it('null ohne gespeicherten Eintrag', () => {
    expect(ConsentService.getConsent()).toBeNull();
    expect(ConsentService.hasValidConsent()).toBe(false);
  });

  it('fehlender Eintrag ist der normale Pfad: null ohne Warnung', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(ConsentService.getConsent()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('liest unter dem exakten Storage-Key', () => {
    ls.setItem('anderer_key', JSON.stringify(valid()));
    expect(ConsentService.getConsent()).toBeNull();
    stored(valid());
    expect(ConsentService.getConsent()).toEqual(valid());
  });

  it('null bei leerem String', () => {
    ls.setItem(KEY, '');
    expect(ConsentService.getConsent()).toBeNull();
  });

  it('null, wenn essential kein boolean ist', () => {
    stored(valid({ essential: 'true' }));
    expect(ConsentService.getConsent()).toBeNull();
    stored(valid({ essential: undefined }));
    expect(ConsentService.getConsent()).toBeNull();
  });

  it('akzeptiert essential=false als gültigen (Boolean-)Eintrag', () => {
    stored(valid({ essential: false }));
    const c = ConsentService.getConsent();
    expect(c).not.toBeNull();
    expect(c!.essential).toBe(false);
  });

  it('null bei veralteter Version (Art. 7(3) erneute Einwilligung)', () => {
    stored(valid({ version: CONSENT_VERSION - 1 }));
    expect(ConsentService.getConsent()).toBeNull();
    stored(valid({ version: CONSENT_VERSION + 1 }));
    expect(ConsentService.getConsent()).toBeNull();
    const { version: _v, ...noVersion } = valid();
    stored(noVersion);
    expect(ConsentService.getConsent()).toBeNull();
  });

  it('Opt-in strikt: nur exakt true zählt, alles andere ist false', () => {
    for (const bad of ['true', 1, null, undefined, 'yes']) {
      stored(valid({ analytics: bad, surveys: bad, personalizedAds: bad }));
      const c = ConsentService.getConsent()!;
      expect(c.analytics).toBe(false);
      expect(c.surveys).toBe(false);
      expect(c.personalizedAds).toBe(false);
    }
  });

  it('Kategorien werden unabhängig voneinander übernommen', () => {
    stored(valid({ analytics: true, surveys: false, personalizedAds: false }));
    let c = ConsentService.getConsent()!;
    expect([c.analytics, c.surveys, c.personalizedAds]).toEqual([true, false, false]);
    stored(valid({ analytics: false, surveys: true, personalizedAds: false }));
    c = ConsentService.getConsent()!;
    expect([c.analytics, c.surveys, c.personalizedAds]).toEqual([false, true, false]);
    stored(valid({ analytics: false, surveys: false, personalizedAds: true }));
    c = ConsentService.getConsent()!;
    expect([c.analytics, c.surveys, c.personalizedAds]).toEqual([false, false, true]);
  });

  it('acceptedAt: gespeicherter Wert bleibt, fehlender wird Epoch', () => {
    stored(valid());
    expect(ConsentService.getConsent()!.acceptedAt).toBe('2026-01-01T00:00:00.000Z');
    stored(valid({ acceptedAt: undefined }));
    expect(ConsentService.getConsent()!.acceptedAt).toBe(new Date(0).toISOString());
    stored(valid({ acceptedAt: '' }));
    expect(ConsentService.getConsent()!.acceptedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('liefert die aktuelle CONSENT_VERSION', () => {
    stored(valid());
    expect(ConsentService.getConsent()!.version).toBe(CONSENT_VERSION);
    expect(CONSENT_VERSION).toBe(2);
  });

  it('kaputtes JSON: null und exakte Warnung', () => {
    ls.setItem(KEY, '{not json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(ConsentService.getConsent()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      '[Consent] Einwilligung nicht lesbar, erneute Zustimmung erforderlich:',
    );
    expect(warn.mock.calls[0][1]).toBeInstanceOf(Error);
  });

  it('Storage wirft: null statt Exception', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(ConsentService.getConsent()).toBeNull();
  });
});

describe('isGranted / allows*', () => {
  it('ohne Einwilligung ist jede Kategorie false', () => {
    expect(ConsentService.isGranted('essential')).toBe(false);
    expect(ConsentService.isGranted('analytics')).toBe(false);
    expect(ConsentService.isGranted('surveys')).toBe(false);
    expect(ConsentService.isGranted('personalizedAds')).toBe(false);
    expect(ConsentService.allowsEssential).toBe(false);
    expect(ConsentService.allowsAnalytics).toBe(false);
    expect(ConsentService.allowsSurveys).toBe(false);
    expect(ConsentService.allowsPersonalizedAds).toBe(false);
  });

  it('jede Kurzprüfung bildet genau ihre Kategorie ab', () => {
    stored(valid({ essential: true, analytics: false, surveys: false, personalizedAds: false }));
    expect([ConsentService.allowsEssential, ConsentService.allowsAnalytics, ConsentService.allowsSurveys, ConsentService.allowsPersonalizedAds]).toEqual([true, false, false, false]);
    stored(valid({ essential: false, analytics: true, surveys: false, personalizedAds: false }));
    expect([ConsentService.allowsEssential, ConsentService.allowsAnalytics, ConsentService.allowsSurveys, ConsentService.allowsPersonalizedAds]).toEqual([false, true, false, false]);
    stored(valid({ essential: false, analytics: false, surveys: true, personalizedAds: false }));
    expect([ConsentService.allowsEssential, ConsentService.allowsAnalytics, ConsentService.allowsSurveys, ConsentService.allowsPersonalizedAds]).toEqual([false, false, true, false]);
    stored(valid({ essential: false, analytics: false, surveys: false, personalizedAds: true }));
    expect([ConsentService.allowsEssential, ConsentService.allowsAnalytics, ConsentService.allowsSurveys, ConsentService.allowsPersonalizedAds]).toEqual([false, false, false, true]);
  });

  it('hasValidConsent ist true bei gültigem Eintrag', () => {
    stored(valid());
    expect(ConsentService.hasValidConsent()).toBe(true);
  });
});

describe('save', () => {
  it('speichert unter dem Key mit Version und ISO-Zeitstempel und gibt es zurück', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-05T10:00:00.000Z'));
    const r = ConsentService.save({ essential: true, analytics: false, surveys: true, personalizedAds: false });
    vi.useRealTimers();
    expect(r).toEqual({
      essential: true,
      analytics: false,
      surveys: true,
      personalizedAds: false,
      acceptedAt: '2026-05-05T10:00:00.000Z',
      version: CONSENT_VERSION,
    });
    expect(JSON.parse(ls.getItem(KEY)!)).toEqual(r);
    expect(ConsentService.getConsent()).toEqual(r);
  });

  it('übernimmt jedes Flag einzeln (keine Vertauschung)', () => {
    const r = ConsentService.save({ essential: false, analytics: true, surveys: false, personalizedAds: true });
    expect([r.essential, r.analytics, r.surveys, r.personalizedAds]).toEqual([false, true, false, true]);
  });

  it('benachrichtigt alle Listener mit den gespeicherten Flags', () => {
    const a = vi.fn();
    const b = vi.fn();
    ConsentService.onChange(a);
    ConsentService.onChange(b);
    const r = ConsentService.save({ essential: true, analytics: true, surveys: true, personalizedAds: true });
    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith(r);
    expect(b).toHaveBeenCalledWith(r);
  });
});

describe('Initialzustand (frisches Modul)', () => {
  it('save() ohne registrierte Listener wirft nicht', async () => {
    vi.resetModules();
    const fresh = await import('./consentService');
    expect(() =>
      fresh.ConsentService.save({ essential: true, analytics: false, surveys: false, personalizedAds: false }),
    ).not.toThrow();
    expect((fresh.ConsentService as any).listeners).toEqual([]);
  });
});

describe('onChange', () => {
  it('Start ohne Listener und Unsubscribe entfernt nur den eigenen', () => {
    expect((ConsentService as any).listeners).toEqual([]);
    const a = vi.fn();
    const b = vi.fn();
    const offA = ConsentService.onChange(a);
    ConsentService.onChange(b);
    offA();
    ConsentService.save({ essential: true, analytics: false, surveys: false, personalizedAds: false });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe('withdraw (Art. 7 Abs. 3 DSGVO)', () => {
  it('entfernt die Einwilligung und leert local- und sessionStorage', () => {
    stored(valid());
    ls.setItem('anderes', 'x');
    ss.setItem('sess', 'y');
    ConsentService.withdraw();
    expect(ls.getItem(KEY)).toBeNull();
    expect(ls.getItem('anderes')).toBeNull();
    expect(ss.getItem('sess')).toBeNull();
    expect(ConsentService.hasValidConsent()).toBe(false);
  });

  it('entfernt den Consent-Key auch dann, wenn clear() wirft, und warnt exakt', () => {
    stored(valid());
    const removeSpy = vi.fn((k: string) => ls._map.delete(k));
    vi.stubGlobal('localStorage', {
      getItem: ls.getItem,
      removeItem: removeSpy,
      clear: () => {
        throw new Error('nope');
      },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => ConsentService.withdraw()).not.toThrow();
    expect(removeSpy).toHaveBeenCalledWith(KEY);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      '[Consent] Lokale Daten beim Widerruf nicht vollständig löschbar:',
    );
  });
});
