import { HttpsError } from 'firebase-functions/v2/https';

jest.mock('firebase-functions/v2/https', () => ({
  onCall: jest.fn((config, handler) => {
    const wrapped = async (req: any) => handler(req);
    wrapped.run = wrapped;
    wrapped.__config = config;
    return wrapped;
  }),
  HttpsError: jest.requireActual('firebase-functions/v2/https').HttpsError
}));

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

describe('issueGoogleMapsKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw unauthenticated if no app check token', async () => {
    const req: any = { app: undefined, auth: { uid: 'user1' } };
    
    await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
      new HttpsError('unauthenticated', 'Invalid App Check token.')
    );
  });

  it('should throw unauthenticated if no auth', async () => {
    const req: any = { app: { appId: '123' }, auth: undefined };
    
    await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
      new HttpsError('unauthenticated', 'User must be authenticated.')
    );
  });

  it('should throw unauthenticated if no uid', async () => {
    const req: any = { app: { appId: '123' }, auth: {} };
    
    await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
      new HttpsError('unauthenticated', 'User must be authenticated.')
    );
  });

  it('should throw permission-denied if user not found', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: false });
    
    await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
      new HttpsError('permission-denied', 'User not found.')
    );
  });

  it('should throw permission-denied if user doc data is missing', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => undefined });
    
    await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
      new HttpsError('permission-denied', 'Active subscription required.')
    );
  });

  it('should throw permission-denied if subscription is not active', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'canceled' }) });
    
    await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
      new HttpsError('permission-denied', 'Active subscription required.')
    );
  });

  it('should throw resource-exhausted if transaction throws resource-exhausted', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce(new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.'));

    await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
      new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.')
    );
  });

  it('should throw internal if transaction throws random error', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce(new Error('Random DB Error'));

    await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
      new HttpsError('internal', 'Rate limiting error')
    );
  });

  it('should throw internal if transaction throws random string error', async () => {
    const req: any = { app: { appId: '123' }, auth: { uid: 'user1' } };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ subscriptionStatus: 'active' }) });
    mockRunTransaction.mockRejectedValueOnce({code: 'some-other-error'});

    await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
      new HttpsError('internal', 'Rate limiting error')
    );
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

      await expect(issueGoogleMapsKey.run(req)).rejects.toThrow(
        new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.')
      );
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
    
    mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const boundaryTimestamp = Date.now() - 60000;
        const t = {
            get: jest.fn().mockResolvedValueOnce({ exists: true, data: () => ({ timestamps: [boundaryTimestamp, boundaryTimestamp, boundaryTimestamp, boundaryTimestamp, boundaryTimestamp] }) }), // 5 boundary items
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

      let caught: any;
      try {
        await issueGoogleMapsKey.run(req);
      } catch(e) { caught = e; }

      expect(caught.message).toBe("Rate limit exceeded. Try again later.");
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
});

