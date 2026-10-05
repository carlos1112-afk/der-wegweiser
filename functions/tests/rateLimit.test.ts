import { HttpsError } from 'firebase-functions/v2/https';

jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'HttpsError';
    }
  }
  return { onCall: jest.fn(), HttpsError };
});

import { consumeRateLimit } from '../src/rateLimit';

const WINDOW = 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function makeDb(stored: { exists: boolean; timestamps?: unknown } | null) {
  const set = jest.fn();
  const docRef = { path: 'ref' };
  const doc = jest.fn(() => docRef);
  const collection = jest.fn(() => ({ doc }));
  const runTransaction = jest.fn(async (fn: (t: any) => Promise<void>) => {
    const t = {
      get: jest.fn(async () => ({
        exists: stored?.exists ?? false,
        data: () => (stored && stored.exists ? { timestamps: stored.timestamps } : undefined),
      })),
      set,
    };
    return fn(t);
  });
  return { db: { collection, runTransaction } as any, set, collection, doc, docRef, runTransaction };
}

const opts = { windowMs: WINDOW, max: 30, now: NOW };

describe('consumeRateLimit', () => {
  it('nutzt Collection und UID als Dokumentpfad', async () => {
    const m = makeDb(null);
    await consumeRateLimit(m.db, 'aiRequests', 'user-1', opts);
    expect(m.collection).toHaveBeenCalledWith('aiRequests');
    expect(m.doc).toHaveBeenCalledWith('user-1');
    expect(m.set).toHaveBeenCalledWith(m.docRef, expect.anything());
  });

  it('erlaubt die erste Anfrage und speichert den Zeitstempel', async () => {
    const m = makeDb(null);
    await consumeRateLimit(m.db, 'c', 'u', opts);
    expect(m.set).toHaveBeenCalledWith(m.docRef, { timestamps: [NOW] });
  });

  it('erlaubt die 30. Anfrage im Fenster und speichert 30 Einträge', async () => {
    const recent = Array.from({ length: 29 }, (_, i) => NOW - 1000 - i);
    const m = makeDb({ exists: true, timestamps: recent });
    await consumeRateLimit(m.db, 'c', 'u', opts);
    expect(m.set.mock.calls[0][1].timestamps).toHaveLength(30);
  });

  it('lehnt die 31. Anfrage ab, ohne zu schreiben', async () => {
    const recent = Array.from({ length: 30 }, (_, i) => NOW - 1000 - i);
    const m = makeDb({ exists: true, timestamps: recent });
    const err: any = await consumeRateLimit(m.db, 'c', 'u', opts).catch((e) => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('resource-exhausted');
    expect(m.set).not.toHaveBeenCalled();
  });

  it('Fenstergrenze: ein Eintrag genau windowMs alt zählt nicht mehr', async () => {
    const ts = Array.from({ length: 29 }, (_, i) => NOW - 1000 - i);
    ts.push(NOW - WINDOW);
    const m = makeDb({ exists: true, timestamps: ts });
    await expect(consumeRateLimit(m.db, 'c', 'u', opts)).resolves.toBeUndefined();
    expect(m.set.mock.calls[0][1].timestamps).toHaveLength(30);
  });

  it('Fenstergrenze: ein Eintrag eine Millisekunde jünger als windowMs zählt noch', async () => {
    const ts = Array.from({ length: 29 }, (_, i) => NOW - 1000 - i);
    ts.push(NOW - WINDOW + 1);
    const m = makeDb({ exists: true, timestamps: ts });
    const err: any = await consumeRateLimit(m.db, 'c', 'u', opts).catch((e) => e);
    expect(err.code).toBe('resource-exhausted');
  });

  it('verwirft veraltete Einträge beim Speichern', async () => {
    const m = makeDb({ exists: true, timestamps: [NOW - WINDOW - 5, NOW - 10] });
    await consumeRateLimit(m.db, 'c', 'u', opts);
    expect(m.set.mock.calls[0][1].timestamps).toEqual([NOW - 10, NOW]);
  });

  it('ignoriert Nicht-Zahlen und nicht-Array-Inhalte', async () => {
    const a = makeDb({ exists: true, timestamps: ['x', null, NOW - 5] });
    await consumeRateLimit(a.db, 'c', 'u', opts);
    expect(a.set.mock.calls[0][1].timestamps).toEqual([NOW - 5, NOW]);

    const b = makeDb({ exists: true, timestamps: 'kaputt' });
    await consumeRateLimit(b.db, 'c', 'u', opts);
    expect(b.set.mock.calls[0][1].timestamps).toEqual([NOW]);
  });

  it('respektiert ein anderes Limit', async () => {
    const m = makeDb({ exists: true, timestamps: [NOW - 1] });
    const err: any = await consumeRateLimit(m.db, 'c', 'u', { ...opts, max: 1 }).catch((e) => e);
    expect(err.code).toBe('resource-exhausted');
  });

  it('Datenbankfehler schlägt zu (internal), statt die Anfrage durchzulassen', async () => {
    const m = makeDb(null);
    m.runTransaction.mockRejectedValueOnce(new Error('firestore down'));
    const err: any = await consumeRateLimit(m.db, 'c', 'u', opts).catch((e) => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('internal');
    expect(err.message).toBe('Rate limiting error');
    expect(err.message).not.toContain('firestore down');
  });

  it('nimmt Date.now, wenn keine Zeit übergeben wird', async () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    const m = makeDb(null);
    await consumeRateLimit(m.db, 'c', 'u', { windowMs: WINDOW, max: 30 });
    expect(m.set).toHaveBeenCalledWith(m.docRef, { timestamps: [NOW] });
    spy.mockRestore();
  });
});
