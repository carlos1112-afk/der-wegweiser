import { HttpsError } from 'firebase-functions/v2/https';

// jest.mock is hoisted, so HttpsError class must be defined inside the factory
jest.mock('firebase-functions/v2/https', () => {
  // Inline class — avoids loading real module (which pulls in jose ESM)
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'HttpsError';
    }
  }
  return {
    onCall: jest.fn((config: any, handler: any) => {
      const wrapped = async (req: any) => handler(req);
      (wrapped as any).run = wrapped;
      (wrapped as any).__config = config;
      return wrapped;
    }),
    HttpsError,
  };
});

import { issueGoogleMapsKey } from '../src/issueGoogleMapsKey';

const mockGet = jest.fn();
const mockRunTransaction = jest.fn();
const mockCollection = jest.fn();

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: mockCollection.mockImplementation((col: string) => ({
      doc: (docId: string) => ({
        get: mockGet,
      })
    })),
    runTransaction: mockRunTransaction
  })),
}));

jest.mock('firebase-functions/params', () => ({
  defineSecret: jest.fn().mockReturnValue({ value: () => 'mock-api-key' }),
}));

// Capture defineSecret call at module-load time (before beforeEach clears mocks)
let capturedSecretName: string | undefined;

describe('issueGoogleMapsKey', () => {
  beforeAll(() => {
    // defineSecret is called once at module scope during import
    capturedSecretName = (jest.requireMock('firebase-functions/params') as any)
      .defineSecret.mock.calls[0]?.[0];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw unauthenticated if no app check token', async () => {
    const req: any = { app: undefined, auth: { uid: 'user1' } };
    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('unauthenticated');
    expect(err.message).toBe('Invalid App Check token.');
  });

  it('should throw unauthenticated if no auth', async () => {
    const req: any = { app: { appId: '123' }, auth: undefined };
    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('unauthenticated');
    expect(err.message).toBe('User must be authenticated.');
  });

  it('should throw unauthenticated if no uid', async () => {
    const req: any = { app: { appId: '123' }, auth: {} };
    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('unauthenticated');
    expect(err.message).toBe('User must be authenticated.');
  });

  it('should throw permission-denied if user not found', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: false });
    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('permission-denied');
    expect(err.message).toBe('User not found.');
  });

  it('should throw permission-denied if user doc data is missing', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => undefined });
    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('permission-denied');
    expect(err.message).toBe('Active subscription required.');
  });

  it('should throw permission-denied if subscription is not active', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'canceled' }) });
    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('permission-denied');
    expect(err.message).toBe('Active subscription required.');
  });

  it('should throw resource-exhausted if transaction throws resource-exhausted', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce(new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.'));
    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('resource-exhausted');
    expect(err.message).toBe('Rate limit exceeded. Try again later.');
  });

  it('should throw internal if transaction throws random error', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce(new Error('Random DB Error'));
    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('internal');
    expect(err.message).toBe('Rate limiting error');
  });

  it('should throw internal if transaction throws random string error', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce({code: 'some-other-error'});
    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('internal');
    expect(err.message).toBe('Rate limiting error');
  });

  it('should return api key on success', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const t = {
            get: jest.fn().mockResolvedValueOnce({ exists: false }),
            set: jest.fn()
        };
        await cb(t);
    });

    const res = await issueGoogleMapsKey.run(req);
    expect(res).toEqual({ key: 'mock-api-key' });
    expect(mockCollection).toHaveBeenCalledWith('users');
    expect(mockCollection).toHaveBeenCalledWith('keyRequests');
  });

  it('should initialize empty requests if missing timestamps', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });

    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const t = {
            get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({}) }),
            set: jest.fn()
        };
        await cb(t);
    });

    const res = await issueGoogleMapsKey.run(req);
    expect(res).toEqual({ key: 'mock-api-key' });
  });

  it('should enforce rate limit inside transaction', async () => {
      const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
      mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });

      mockRunTransaction.mockImplementationOnce(async (cb: any) => {
          const t = {
              get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps: [Date.now(), Date.now(), Date.now(), Date.now(), Date.now()] }) }),
              set: jest.fn()
          };
          await cb(t);
      });

      const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
      expect(err).toBeInstanceOf(HttpsError);
      expect(err.code).toBe('resource-exhausted');
      expect(err.message).toBe('Rate limit exceeded. Try again later.');
  });

  it('should allow if less than 5 recent requests', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });

    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const t = {
            get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps: [Date.now(), Date.now(), Date.now(), Date.now()] }) }), // 4 items
            set: jest.fn()
        };
        await cb(t);
    });

    const res = await issueGoogleMapsKey.run(req);
    expect(res).toEqual({ key: 'mock-api-key' });
  });

  it('should allow if request is exactly at 60s boundary', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    // Captured BEFORE run so now_function - boundaryTimestamp >= 60000 → filtered out
    const boundaryTimestamp = Date.now() - 60000;

    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const t = {
            get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps: [boundaryTimestamp, boundaryTimestamp, boundaryTimestamp, boundaryTimestamp, boundaryTimestamp] }) }),
            set: jest.fn()
        };
        await cb(t);
    });

    const res = await issueGoogleMapsKey.run(req);
    expect(res).toEqual({ key: 'mock-api-key' });
  });

  it('should return exact rate limit error message', async () => {
      const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
      mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });

      mockRunTransaction.mockImplementationOnce(async (cb: any) => {
          const t = {
              get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps: [Date.now(), Date.now(), Date.now(), Date.now(), Date.now()] }) }),
              set: jest.fn()
          };
          await cb(t);
      });

      const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
      expect(err.code).toBe('resource-exhausted');
      expect(err.message).toBe("Rate limit exceeded. Try again later.");
  });

  it('should clear old requests in transaction', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });

    const mockSet = jest.fn();
    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const oldTimestamp = Date.now() - 61000;
        const t = {
            get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps: [oldTimestamp, oldTimestamp, oldTimestamp, oldTimestamp, oldTimestamp] }) }), // 5 old items
            set: mockSet
        };
        await cb(t);
    });

    await issueGoogleMapsKey.run(req);
    expect(mockSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        timestamps: expect.arrayContaining([expect.any(Number)])
    }));
    const setArgs = mockSet.mock.calls[0][1];
    expect(setArgs.timestamps.length).toBe(1);
  });

  it('should be configured with correct config', () => {
    const config = (issueGoogleMapsKey as any).__config;
    expect(config.region).toBe('europe-west3');
    expect(config.secrets).toEqual([{ value: expect.any(Function) }]);
    expect(config.cors).toEqual(["https://der-wegweiser.web.app", "http://localhost:5173"]);
  });

  // --- Tests targeting surviving mutants ---

  it('should block requests with timestamps 30s old (within 60s window)', async () => {
    // Kills ArithmeticOperator: 60 * 1000 → 60 / 1000
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });

    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
      const thirtySecondsAgo = Date.now() - 30_000;
      const t = {
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          data: () => ({ timestamps: [thirtySecondsAgo, thirtySecondsAgo, thirtySecondsAgo, thirtySecondsAgo, thirtySecondsAgo] }),
        }),
        set: jest.fn(),
      };
      await cb(t);
    });

    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('resource-exhausted');
    expect(err.message).toBe('Rate limit exceeded. Try again later.');
  });

  it('should succeed when doc.data() returns undefined (optional chain guard)', async () => {
    // Kills OptionalChaining: data?.timestamps → data.timestamps (would throw TypeError)
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });

    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
      const t = {
        get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => undefined }),
        set: jest.fn(),
      };
      await cb(t);
    });

    const res = await issueGoogleMapsKey.run(req);
    expect(res).toEqual({ key: 'mock-api-key' });
  });

  it('should rethrow any HttpsError from transaction as rate-limit error (not internal)', async () => {
    // Kills LogicalOperator: || → && on line 64
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce(new HttpsError('unavailable', 'Firestore timeout'));

    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('resource-exhausted');
    expect(err.message).toBe('Rate limit exceeded. Try again later.');
  });

  it('should rethrow plain error with resource-exhausted code as rate-limit (not internal)', async () => {
    // Kills ConditionalExpression and StringLiteral on error.code check
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce({ code: 'resource-exhausted', message: 'quota' });

    const err: any = await issueGoogleMapsKey.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('resource-exhausted');
    expect(err.message).toBe('Rate limit exceeded. Try again later.');
  });

  it('should define secret with name GOOGLE_MAPS_API_KEY', () => {
    // Kills StringLiteral: defineSecret("") on line 5
    expect(capturedSecretName).toBe('GOOGLE_MAPS_API_KEY');
  });

  it('should throw rate-limit error with correct code and message at the transaction throw site', async () => {
    // Kills StringLiteral on L57:30 (code="") and L57:52 (message="")
    // Intercepts the error thrown INSIDE the transaction callback before the outer catch rewraps it
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });

    let transactionThrown: any;
    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
      const now = Date.now();
      const t = {
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          data: () => ({ timestamps: [now, now, now, now, now] }),
        }),
        set: jest.fn(),
      };
      try {
        await cb(t);
      } catch (e: any) {
        transactionThrown = e;
        throw e;
      }
    });

    await issueGoogleMapsKey.run(req).catch(() => {});
    expect(transactionThrown).toBeDefined();
    expect(transactionThrown.code).toBe('resource-exhausted');
    expect(transactionThrown.message).toBe('Rate limit exceeded. Try again later.');
  });
});
