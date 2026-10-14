// Mutation-Test-Ergänzung: deterministische Fenstergrenze des Rate-Limits.
// Analog issueGoogleMapsKey.boundary.test.ts — tötet Mutant `now - ts < windowMs` -> `<=`.
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    onCall: jest.fn((_c: any, handler: any) => {
      const wrapped = async (req: any) => handler(req);
      (wrapped as any).run = wrapped;
      return wrapped;
    }),
    HttpsError,
  };
});

const mockGet = jest.fn();
const mockRunTransaction = jest.fn();
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: () => ({ doc: () => ({ get: mockGet }) }),
    runTransaction: mockRunTransaction,
  })),
}));
jest.mock('firebase-functions/params', () => ({
  defineSecret: jest.fn().mockReturnValue({ value: () => 'mock-ion-token' }),
}));

import { issueCesiumIonToken } from '../src/issueCesiumIonToken';

const NOW = 1_700_000_000_000;

async function runWithTimestamps(timestamps: number[]) {
  const req: any = { app: { appId: 'a' }, auth: { uid: 'u1' } };
  mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
  const set = jest.fn();
  mockRunTransaction.mockImplementationOnce(async (cb: any) => {
    await cb({ get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps }) }), set });
  });
  const result = await (issueCesiumIonToken as any).run(req).catch((e: any) => e);
  return { result, set };
}

describe('issueCesiumIonToken rate-limit window boundary (deterministic clock)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => jest.restoreAllMocks());

  it('treats a timestamp exactly 60000ms old as expired (allowed, pruned)', async () => {
    const old = NOW - 60000;
    const { result, set } = await runWithTimestamps([old, old, old, old, old]);
    expect(result).toEqual({ token: 'mock-ion-token' });
    expect(set).toHaveBeenCalledWith(expect.anything(), { timestamps: [NOW] });
  });

  it('treats timestamps 59999ms old as still active (blocked)', async () => {
    const recent = NOW - 59999;
    const { result } = await runWithTimestamps([recent, recent, recent, recent, recent]);
    expect(result.code).toBe('resource-exhausted');
  });
});
