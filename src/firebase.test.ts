import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

type Fn = (...args: unknown[]) => unknown;

const m = vi.hoisted(() => {
  const fn = (impl: (...args: unknown[]) => unknown) => vi.fn(impl as (...args: unknown[]) => unknown);
  const app = { name: 'APP', options: {} };
  return {
    app,
    initializeApp: fn(() => app),
    getFirestore: fn(() => ({})),
    getAuth: fn(() => ({})),
    getStorage: fn(() => ({})),
    getFunctions: fn(() => ({})),
    initAppCheck: fn(() => 'APPCHECK-INSTANCE'),
  };
});

vi.mock('firebase/app', () => ({ initializeApp: (...a: unknown[]) => (m.initializeApp as Fn)(...a) }));
vi.mock('firebase/firestore', () => ({ getFirestore: (...a: unknown[]) => (m.getFirestore as Fn)(...a) }));
vi.mock('firebase/auth', () => ({ getAuth: (...a: unknown[]) => (m.getAuth as Fn)(...a) }));
vi.mock('firebase/storage', () => ({ getStorage: (...a: unknown[]) => (m.getStorage as Fn)(...a) }));
vi.mock('firebase/functions', () => ({ getFunctions: (...a: unknown[]) => (m.getFunctions as Fn)(...a) }));
vi.mock('./appCheck', () => ({ initAppCheck: (...a: unknown[]) => (m.initAppCheck as Fn)(...a) }));

const snap = {
  appCheckCalls: [] as unknown[][],
  appCheckExport: undefined as unknown,
  order: { init: 0, appCheck: 0, firestore: 0, storage: 0, functions: 0 },
};

beforeAll(async () => {
  const mod = await import('./firebase');
  snap.appCheckCalls = [...m.initAppCheck.mock.calls];
  snap.appCheckExport = mod.appCheck;
  snap.order = {
    init: m.initializeApp.mock.invocationCallOrder[0],
    appCheck: m.initAppCheck.mock.invocationCallOrder[0],
    firestore: m.getFirestore.mock.invocationCallOrder[0],
    storage: m.getStorage.mock.invocationCallOrder[0],
    functions: m.getFunctions.mock.invocationCallOrder[0],
  };
});

describe('firebase.ts: App Check Verdrahtung', () => {
  it('initialisiert App Check genau einmal mit der App und exportiert die Instanz', () => {
    expect(snap.appCheckCalls).toHaveLength(1);
    const [calledApp, env, isDev] = snap.appCheckCalls[0];
    expect(calledApp).toBe(m.app);
    expect(typeof env).toBe('object');
    expect(typeof isDev).toBe('boolean');
    expect(snap.appCheckExport).toBe('APPCHECK-INSTANCE');
  });

  it('initialisiert App Check nach der App, aber vor Firestore, Storage und Functions', () => {
    const { init, appCheck, firestore, storage, functions } = snap.order;
    expect(appCheck).toBeGreaterThan(init);
    expect(appCheck).toBeLessThan(firestore);
    expect(appCheck).toBeLessThan(storage);
    expect(appCheck).toBeLessThan(functions);
  });
});

describe('firebase.ts: Entwicklungsflag für App Check', () => {
  afterEach(() => vi.unstubAllEnvs());

  async function devFlagPassed(dev: boolean): Promise<unknown> {
    vi.resetModules();
    m.initAppCheck.mockClear();
    vi.stubEnv('DEV', dev);
    await import('./firebase');
    return m.initAppCheck.mock.calls[0][2];
  }

  it('gibt true weiter, wenn Vite im Entwicklungsmodus läuft', async () => {
    expect(await devFlagPassed(true)).toBe(true);
  });

  it('gibt false weiter, wenn Vite im Produktionsmodus läuft', async () => {
    expect(await devFlagPassed(false)).toBe(false);
  });
});
