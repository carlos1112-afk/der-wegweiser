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

import { issueCesiumIonToken } from '../src/issueCesiumIonToken';

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
  defineSecret: jest.fn().mockReturnValue({ value: () => 'mock-ion-token' }),
}));

let capturedSecretName: string | undefined;

describe('issueCesiumIonToken', () => {
  beforeAll(() => {
    capturedSecretName = (jest.requireMock('firebase-functions/params') as any)
      .defineSecret.mock.calls[0]?.[0];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw unauthenticated if no app check token', async () => {
    const req: any = { app: undefined, auth: { uid: 'user1' } };
    const err: any = await issueCesiumIonToken.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('unauthenticated');
    expect(err.message).toBe('Invalid App Check token.');
  });

  it('should throw unauthenticated if no auth', async () => {
    const req: any = { app: { appId: '123' }, auth: undefined };
    const err: any = await issueCesiumIonToken.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('unauthenticated');
    expect(err.message).toBe('User must be authenticated.');
  });

  it('should throw unauthenticated if no uid', async () => {
    const req: any = { app: { appId: '123' }, auth: {} };
    const err: any = await issueCesiumIonToken.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('unauthenticated');
    expect(err.message).toBe('User must be authenticated.');
  });

  it('should throw permission-denied if user not found', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: false });
    const err: any = await issueCesiumIonToken.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('permission-denied');
    expect(err.message).toBe('Subscription not found.');
  });

  it('should throw permission-denied if subscription is not active', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'canceled' }) });
    const err: any = await issueCesiumIonToken.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('permission-denied');
    expect(err.message).toBe('Active subscription required.');
  });

  it('should throw resource-exhausted if transaction throws resource-exhausted', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce(new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.'));
    const err: any = await issueCesiumIonToken.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('resource-exhausted');
    expect(err.message).toBe('Rate limit exceeded. Try again later.');
  });

  it('should throw internal if transaction throws random error', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce(new Error('Random DB Error'));
    const err: any = await issueCesiumIonToken.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('internal');
    expect(err.message).toBe('Rate limiting error');
  });

  it('should return ion token on success', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'active' }) });
    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const t = {
            get: jest.fn().mockResolvedValueOnce({ exists: false }),
            set: jest.fn()
        };
        await cb(t);
    });

    const res = await issueCesiumIonToken.run(req);
    expect(res).toEqual({ token: 'mock-ion-token' });
    expect(mockCollection).toHaveBeenCalledWith('subscriptions');
    expect(mockCollection).toHaveBeenCalledWith('cesiumKeyRequests');
  });

  it('should enforce rate limit inside transaction', async () => {
      const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
      mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'active' }) });

      mockRunTransaction.mockImplementationOnce(async (cb: any) => {
          const t = {
              get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps: [Date.now(), Date.now(), Date.now(), Date.now(), Date.now()] }) }),
              set: jest.fn()
          };
          await cb(t);
      });

      const err: any = await issueCesiumIonToken.run(req).catch(e => e);
      expect(err).toBeInstanceOf(HttpsError);
      expect(err.code).toBe('resource-exhausted');
      expect(err.message).toBe('Rate limit exceeded. Try again later.');
  });

  it('should allow if less than 5 recent requests', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'active' }) });

    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const t = {
            get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps: [Date.now(), Date.now(), Date.now(), Date.now()] }) }),
            set: jest.fn()
        };
        await cb(t);
    });

    const res = await issueCesiumIonToken.run(req);
    expect(res).toEqual({ token: 'mock-ion-token' });
  });

  it('should clear old requests in transaction', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'active' }) });

    const mockSet = jest.fn();
    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const oldTimestamp = Date.now() - 61000;
        const t = {
            get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps: [oldTimestamp, oldTimestamp, oldTimestamp, oldTimestamp, oldTimestamp] }) }),
            set: mockSet
        };
        await cb(t);
    });

    await issueCesiumIonToken.run(req);
    const setArgs = mockSet.mock.calls[0][1];
    expect(setArgs.timestamps.length).toBe(1);
  });

  it('should be configured with correct config (region, secret, cors)', () => {
    const config = (issueCesiumIonToken as any).__config;
    expect(config.region).toBe('europe-west3');
    expect(config.secrets).toEqual([{ value: expect.any(Function) }]);
    expect(config.cors).toEqual(["https://der-wegweiser.web.app", "http://localhost:5173"]);
  });

  it('should define secret with name CESIUM_ION_TOKEN', () => {
    expect(capturedSecretName).toBe('CESIUM_ION_TOKEN');
  });

  it('should use a separate rate-limit collection from issueGoogleMapsKey (cesiumKeyRequests, not keyRequests)', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'active' }) });
    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        await cb({ get: jest.fn().mockResolvedValueOnce({ exists: false }), set: jest.fn() });
    });
    await issueCesiumIonToken.run(req);
    expect(mockCollection).not.toHaveBeenCalledWith('keyRequests');
  });

  it('should rethrow any HttpsError from transaction as rate-limit error (not internal)', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce(new HttpsError('unavailable', 'Firestore timeout'));

    const err: any = await issueCesiumIonToken.run(req).catch(e => e);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('resource-exhausted');
    expect(err.message).toBe('Rate limit exceeded. Try again later.');
  });
});
