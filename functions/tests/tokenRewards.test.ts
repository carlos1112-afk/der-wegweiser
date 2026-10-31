import { HttpsError } from 'firebase-functions/v2/https';

jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  }
  return {
    onCall: jest.fn((config: any, handler: any) => {
      const wrapped = async (request: any) => handler(request);
      (wrapped as any).run = wrapped;
      (wrapped as any).__config = config;
      return wrapped;
    }),
    HttpsError,
  };
});

const mockStore = new Map<string, any>();
const mockMakeRef = (collection: string, id: string) => ({
  collection,
  id,
  path: `${collection}/${id}`,
  get: async () => ({ exists: mockStore.has(`${collection}/${id}`), data: () => mockStore.get(`${collection}/${id}`) }),
});
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
  getFirestore: jest.fn(() => ({
    collection: (name: string) => ({ doc: (id: string) => mockMakeRef(name, id) }),
    runTransaction: async (callback: any) => callback({
      get: async (ref: any) => ({ exists: mockStore.has(ref.path), data: () => mockStore.get(ref.path) }),
      set: (ref: any, value: any) => mockStore.set(ref.path, { ...value }),
      create: (ref: any, value: any) => { if (mockStore.has(ref.path)) throw new Error('already exists'); mockStore.set(ref.path, value); },
      update: (ref: any, value: any) => mockStore.set(ref.path, { ...mockStore.get(ref.path), ...value }),
    }),
  })),
}));

import { getTokenQuizChallenge, submitTokenQuizAnswer, getTokenWheelStatus, spinTokenWheel } from '../src/tokenRewards';
const run = (callable: any, req: any) => callable.run(req);

describe('server-verified token quiz rewards', () => {
  beforeEach(() => { mockStore.clear(); mockStore.set('wallet_control/current', { state: 'active', schemaVersion: 1 }); });

  const request = (data = {}, uid = 'rider-1', app: any = { appId: 'test-app' }) => ({
    auth: uid ? { uid } : null,
    app,
    data,
  });

  it('requires both Firebase authentication and App Check', async () => {
    await expect(run(getTokenQuizChallenge, request({}, '', { appId: 'x' }))).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(run(getTokenQuizChallenge, request({}, 'rider-1', null))).rejects.toMatchObject({ code: 'unauthenticated' });
    expect((getTokenQuizChallenge as any).__config.enforceAppCheck).toBe(true);
  });

  it('issues the same daily challenge without revealing its answer', async () => {
    const first = await run(getTokenQuizChallenge, request({}));
    const second = await run(getTokenQuizChallenge, request({}));
    expect(first.challengeId).toBe(second.challengeId);
    expect(first.options).toHaveLength(3);
    expect(first).not.toHaveProperty('answer');
    expect(mockStore.get('token_quiz_challenges/rider-1').answer).toBeTruthy();
  });

  it('atomically awards six tokens only for the server-held correct answer and blocks replay', async () => {
    const challenge: any = await run(getTokenQuizChallenge, request({}));
    const stored = mockStore.get('token_quiz_challenges/rider-1');
    const result = await run(submitTokenQuizAnswer, request({ challengeId: challenge.challengeId, answerLabel: stored.answer }));
    expect(result).toMatchObject({ correct: true, balance: 6, rewardTokens: 6 });
    expect(mockStore.get('user_tokens/rider-1')).toMatchObject({ userId: 'rider-1', balance: 6, lifetimeEarned: 6, schemaVersion: 1, reservedBalance: 0 });
    const replay = await run(submitTokenQuizAnswer, request({ challengeId: challenge.challengeId, answerLabel: stored.answer })).catch((error: any) => error);
    expect(replay).toBeInstanceOf(HttpsError);
    expect(replay.code).toBe('already-exists');
    expect(mockStore.get('user_tokens/rider-1').balance).toBe(6);
  });

  it('records a wrong answer as the sole daily attempt without creating credits', async () => {
    const challenge: any = await run(getTokenQuizChallenge, request({}));
    const stored = mockStore.get('token_quiz_challenges/rider-1');
    const wrong = stored.answer === 'A' ? 'B' : 'A';
    const result = await run(submitTokenQuizAnswer, request({ challengeId: challenge.challengeId, answerLabel: wrong }));
    expect(result).toMatchObject({ correct: false, rewardTokens: 0, balance: null });
    expect(mockStore.has('user_tokens/rider-1')).toBe(false);
    expect(mockStore.get('token_quiz_challenges/rider-1').attempted).toBe(true);
  });

  it('rejects malformed answers and expired or forged challenge IDs', async () => {
    const challenge: any = await run(getTokenQuizChallenge, request({}));
    const malformed = await run(submitTokenQuizAnswer, request({ challengeId: challenge.challengeId, answerLabel: 'Z' })).catch((error: any) => error);
    expect(malformed.code).toBe('invalid-argument');
    const forged = await run(submitTokenQuizAnswer, request({ challengeId: 'other-user-challenge', answerLabel: 'A' })).catch((error: any) => error);
    expect(forged.code).toBe('failed-precondition');
    expect(mockStore.has('user_tokens/rider-1')).toBe(false);
  });
});

describe('server-authoritative token wheel', () => {
  beforeEach(() => { mockStore.clear(); mockStore.set('wallet_control/current', { state: 'active', schemaVersion: 1 }); });

  const request = (uid = 'rider-1', app: any = { appId: 'test-app' }) => ({ auth: uid ? { uid } : null, app, data: {} });

  it('requires authentication and App Check', async () => {
    await expect(run(spinTokenWheel, request(''))).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(run(spinTokenWheel, request('rider-1', null))).rejects.toMatchObject({ code: 'unauthenticated' });
    expect((spinTokenWheel as any).__config.enforceAppCheck).toBe(true);
  });

  it('reports the server-side daily spin status and refuses status for suspended accounts', async () => {
    expect(await run(getTokenWheelStatus, request())).toEqual({ alreadySpun: false });
    await run(spinTokenWheel, request());
    expect(await run(getTokenWheelStatus, request())).toEqual({ alreadySpun: true });
    mockStore.set('suspended_users/rider-1', { reason: 'test' });
    await expect(run(getTokenWheelStatus, request())).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('does not issue a challenge to a suspended account', async () => {
    mockStore.set('suspended_users/rider-1', { reason: 'test' });
    await expect(run(spinTokenWheel, request())).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockStore.has('token_wheel_spins/rider-1')).toBe(false);
    expect(mockStore.has('user_tokens/rider-1')).toBe(false);
  });

  it('selects the outcome on the server and records one spin for the UTC day', async () => {
    const result = await run(spinTokenWheel, request());
    expect([0, 2, 5, 8, 10]).toContain(result.rewardTokens);
    expect(result.segmentIndex).toBeGreaterThanOrEqual(0);
    expect(result.segmentIndex).toBeLessThan(8);
    expect(mockStore.get('token_wheel_spins/rider-1')).toMatchObject({
      userId: 'rider-1',
      rewardTokens: result.rewardTokens,
      segmentIndex: result.segmentIndex,
    });
    if (result.rewardTokens > 0) {
      expect(result.balance).toBe(result.rewardTokens);
      expect(mockStore.get('user_tokens/rider-1')).toMatchObject({ balance: result.rewardTokens, lifetimeEarned: result.rewardTokens });
    } else {
      expect(result.balance).toBeNull();
      expect(mockStore.has('user_tokens/rider-1')).toBe(false);
    }
  });

  it('rejects a replay without adding credits', async () => {
    const first = await run(spinTokenWheel, request());
    const replay = await run(spinTokenWheel, request()).catch((error: any) => error);
    expect(replay).toBeInstanceOf(HttpsError);
    expect(replay.code).toBe('already-exists');
    expect(mockStore.get('user_tokens/rider-1')?.balance ?? 0).toBe(first.rewardTokens);
  });
});
