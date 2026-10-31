/** Real Firestore transactions; external router, AI, object store and task delivery are test doubles.
 * Opt in only through a loopback emulator and the explicit demo project. Never uses a real wallet.
 */
import { createHash } from 'node:crypto';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { cumulativeDistances } from '../src/routing/geometry';

const mockArtifacts = new Map<string, Buffer>();
const mockEnqueue = jest.fn();
const mockSave = jest.fn();
jest.mock('firebase-admin/functions', () => ({ getFunctions: () => ({ taskQueue: () => ({ enqueue: mockEnqueue }) }) }));
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({ file: (path: string) => ({
  save: async (json: string) => { await mockSave(path); mockArtifacts.set(path, Buffer.from(json)); },
  download: async () => { if (!mockArtifacts.has(path)) throw new Error('missing artifact'); return [mockArtifacts.get(path)]; },
  delete: async () => { mockArtifacts.delete(path); },
}) }) }) }));
jest.mock('../src/routing/aiProvider', () => ({ ...jest.requireActual('../src/routing/aiProvider'), chooseRouteCandidate: jest.fn() }));
import { chooseRouteCandidate, RouteAiProviderError } from '../src/routing/aiProvider';
import * as premium from '../src/routing/premiumRoute';

// Real transaction contention uses the SDK's retry backoff and can exceed Jest's 5 s default.
jest.setTimeout(30_000);

const enabled = /^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
  && process.env.GCLOUD_PROJECT === 'demo-wegweiser';
const suite = enabled ? describe : describe.skip;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const call = (handler: any, data: unknown, uid = 'premium-test-alice') => handler.run({
  app: { appId: 'emulator-only' }, auth: { uid }, data, rawRequest: { ip: '127.0.0.1' },
});
const runWorker = (jobId: string) => (premium.processPremiumRoute as any).run({ data: { jobId } });
const schedule = (handler: any) => handler.run({});

suite('premium lifecycle with real Firestore transactions', () => {
  let app: App;
  const uid = 'premium-test-alice';
  const request = { version: 1, requestId: 'premium-emulator', kind: 'destination', planning: 'ai',
    start: { lat: 52.52, lng: 13.4, source: 'manual', observedAt: 1, accuracyM: null, confirmed: true },
    destination: { lat: 52.52, lng: 13.404 }, mandatoryStops: [], interests: [],
    criteria: { hard: [], surfacePreference: 'any', wishes: '', weights: { asphalt: 0, nature: 0, flat: 0 } },
    profile: { bike: 'bicycle', batteryPercent: null, batteryCapacityWh: null, consentVersion: '3', confirmedAt: 1 } };
  const db = () => getFirestore();
  const jobRef = (id: string) => db().collection('premium_route_jobs').doc(id);
  const wallet = async () => (await db().collection('user_tokens').doc(uid).get()).data();
  async function create() {
    const quote = await call(premium.quotePremiumRoute, { route: request });
    const data = { route: request, quoteId: quote.quoteId, userSelectedPriority: 'shorter' };
    const result = await call(premium.createPremiumRoute, data);
    return { ...result, data };
  }
  beforeAll(() => {
    process.env.ROUTE_AI_PROVIDER = 'gemini'; process.env.ROUTE_AI_MODEL = 'emulator-model';
    process.env.ROUTING_PREMIUM_RELEASED = 'true'; process.env.ROUTE_AI_API_KEY = 'emulator-only';
    process.env.ROUTING_RATE_LIMIT_KEY = 'emulator-only'; process.env.ROUTE_ENGINE = 'brouter';
    process.env.BROUTER_BASE_URL = 'http://operator.test/';
    app = initializeApp({ projectId: 'demo-wegweiser' });
  });
  afterAll(async () => { await deleteApp(app); });
  beforeEach(async () => {
    await db().recursiveDelete(db().collection('premium_route_jobs'));
    for (const name of ['premium_route_quotes', 'premium_route_outbox', 'premium_route_active', 'token_ledger',
      'token_reservations', 'routing_rate_limits', 'suspended_users', 'account_deletion_locks']) {
      await db().recursiveDelete(db().collection(name));
    }
    await db().collection('wallet_control').doc('current').set({ state: 'active', schemaVersion: 1 });
    await db().collection('user_tokens').doc(uid).set({ userId: uid, schemaVersion: 1, balance: 100, reservedBalance: 0, lifetimeEarned: 100 });
    await db().collection('subscriptions').doc(uid).set({ status: 'active' });
    await db().collection('routing_config').doc('current').set({ freeEnabled: true, gate0Verified: true,
      engineVersion: '1.7.10', dataVersion: 'synthetic-emulator', coverageId: 'test',
      bounds: { south: 52, north: 53, west: 13, east: 14 }, premiumEnabled: true, premiumProviderVerified: true, premiumTokenPrice: 5 });
    mockArtifacts.clear(); mockSave.mockReset(); mockEnqueue.mockReset();
    jest.mocked(chooseRouteCandidate).mockReset().mockImplementation(async (input, pinned) => ({
      choice: { candidateId: [...input.scoredCandidates].sort((a, b) => b.score - a.score)[0].id, reason: 'Gemessene kürzeste Route.' },
      provider: pinned!.provider, model: pinned!.model,
    }));
    jest.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const index = Number(new URL(String(input)).searchParams.get('alternativeidx'));
      const geometry = [request.start, { lat: 52.52 + index * 0.0002, lng: 13.402 }, request.destination];
      const distance = cumulativeDistances(geometry).slice(-1)[0];
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature',
        geometry: { type: 'LineString', coordinates: geometry.map(p => [p.lng, p.lat]) },
        properties: { 'track-length': String(distance), 'filtered ascend': String(index * 10), 'total-time': '120' },
      }] }));
    });
  }, 20_000);
  afterEach(() => { jest.restoreAllMocks(); });

  it('reserves once on concurrent create and captures once after all alternatives are stored', async () => {
    const { jobId, data } = await create();
    await Promise.all([call(premium.createPremiumRoute, data), call(premium.createPremiumRoute, data)]);
    await expect(call(premium.createPremiumRoute, { ...data, userSelectedPriority: 'flatter' })).rejects.toMatchObject({ code: 'already-exists' });
    expect(await wallet()).toMatchObject({ balance: 95, reservedBalance: 5 });
    expect((await db().collection('token_ledger').get()).size).toBe(1);
    await Promise.all([runWorker(jobId), runWorker(jobId)]);
    expect(await wallet()).toMatchObject({ balance: 95, reservedBalance: 0 });
    const job = (await jobRef(jobId).get()).data()!;
    expect(job.state).toBe('ready'); expect(job.artifacts).toHaveLength(3); expect(mockArtifacts.size).toBe(3);
    await runWorker(jobId);
    expect((await db().collection('token_ledger').get()).size).toBe(2);
    expect(jest.mocked(chooseRouteCandidate)).toHaveBeenCalledTimes(1);
    for (const artifact of job.artifacts) {
      const recovered = await call(premium.getPremiumRouteCandidate, { jobId, candidateId: artifact.id });
      expect(recovered.route.id).toBe(artifact.id);
    }
    await expect(call(premium.getPremiumRouteResult, { jobId }, 'mallory')).rejects.toMatchObject({ code: 'not-found' });
    await expect(call(premium.getPremiumRouteCandidate, { jobId, candidateId: job.artifacts[0].id }, 'mallory')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('cancels idempotently and ignores delivery after cancellation', async () => {
    const { jobId } = await create();
    await call(premium.cancelPremiumRoute, { jobId });
    await call(premium.cancelPremiumRoute, { jobId });
    await runWorker(jobId);
    expect(await wallet()).toMatchObject({ balance: 100, reservedBalance: 0 });
    expect((await jobRef(jobId).get()).data()?.state).toBe('cancelled');
    expect(mockArtifacts.size).toBe(0); expect(chooseRouteCandidate).not.toHaveBeenCalled();
  });

  it('prevents a running worker from capturing after a concurrent cancellation', async () => {
    const { jobId } = await create();
    let continueAi!: () => void, entered!: () => void;
    const atAi = new Promise<void>(resolve => { entered = resolve; });
    const aiResult = jest.mocked(chooseRouteCandidate).getMockImplementation()!;
    jest.mocked(chooseRouteCandidate).mockImplementationOnce(async (...args) => {
      entered(); await new Promise<void>(resolve => { continueAi = resolve; });
      return aiResult(...args);
    });
    const worker = runWorker(jobId);
    await atAi;
    await call(premium.cancelPremiumRoute, { jobId });
    continueAi(); await worker;
    expect(await wallet()).toMatchObject({ balance: 100, reservedBalance: 0 });
    expect((await jobRef(jobId).get()).data()?.state).toBe('cancelled');
    expect(mockArtifacts.size).toBe(0);
  });

  it('rejects tampered stored artifacts instead of returning them', async () => {
    const { jobId } = await create(); await runWorker(jobId);
    const job = (await jobRef(jobId).get()).data()!;
    const artifact = job.artifacts.find((a: any) => a.id === job.selectedCandidateId);
    mockArtifacts.set(artifact.path, Buffer.from('{"tampered":true}'));
    await expect(call(premium.getPremiumRouteResult, { jobId })).rejects.toMatchObject({ code: 'data-loss' });
  });

  it('paginates every archive job even when creation timestamps are identical', async () => {
    const batch = db().batch();
    for (let index = 0; index < 101; index++) {
      const jobId = sha(`archive-${index}`);
      batch.set(jobRef(jobId), { userId: uid, jobId, state: 'ready', request,
        createdAt: Timestamp.fromMillis(1234), selectedCandidateId: 'candidate',
        artifacts: [{ id: 'candidate', distanceM: 300, ascentM: null, durationS: null }] });
    }
    await batch.commit();
    const first = await call(premium.listPremiumRouteArchive, {});
    const second = await call(premium.listPremiumRouteArchive, { cursor: first.nextCursor });
    expect(first.jobs).toHaveLength(100); expect(second.jobs).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.jobs, ...second.jobs].map((job: any) => job.jobId)).size).toBe(101);
    expect((await call(premium.listPremiumRouteArchive, {}, 'mallory')).jobs).toEqual([]);
  });

  it('recovers an enqueue outage from the durable outbox', async () => {
    mockEnqueue.mockRejectedValueOnce(new Error('queue unavailable'));
    const { jobId } = await create();
    expect((await db().collection('premium_route_outbox').doc(jobId).get()).data()?.state).toBe('pending');
    await schedule(premium.dispatchPendingPremiumRouteOutbox);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect((await db().collection('premium_route_outbox').doc(jobId).get()).data()?.state).toBe('enqueued');
    await runWorker(jobId);
    expect(await wallet()).toMatchObject({ balance: 95, reservedBalance: 0 });
  });

  it('keeps the reservation on transient provider failure and captures only after retry succeeds', async () => {
    const { jobId } = await create();
    jest.mocked(chooseRouteCandidate).mockRejectedValueOnce(new RouteAiProviderError(503));
    await expect(runWorker(jobId)).rejects.toThrow('ROUTE_AI_UPSTREAM_503');
    expect(await wallet()).toMatchObject({ balance: 95, reservedBalance: 5 });
    expect((await jobRef(jobId).get()).data()?.state).toBe('queued');
    await runWorker(jobId);
    expect(await wallet()).toMatchObject({ balance: 95, reservedBalance: 0 });
    expect((await jobRef(jobId).get()).data()?.attempts).toBe(2);
  });

  it('releases on permanent provider error without charging or exposing a route', async () => {
    const { jobId } = await create();
    jest.mocked(chooseRouteCandidate).mockRejectedValueOnce(new RouteAiProviderError(401));
    await runWorker(jobId);
    expect(await wallet()).toMatchObject({ balance: 100, reservedBalance: 0 });
    expect((await jobRef(jobId).get()).data()?.state).toBe('failed'); expect(mockArtifacts.size).toBe(0);
  });

  it('removes partial artifacts on storage failure and never captures before durable completion', async () => {
    const { jobId } = await create();
    mockSave.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(runWorker(jobId)).rejects.toThrow('storage unavailable');
    expect(mockArtifacts.size).toBe(0); expect(await wallet()).toMatchObject({ balance: 95, reservedBalance: 5 });
    await call(premium.cancelPremiumRoute, { jobId });
    expect(await wallet()).toMatchObject({ balance: 100, reservedBalance: 0 });
  });

  it('releases an exhausted worker lease and makes late delivery harmless', async () => {
    const { jobId } = await create();
    await jobRef(jobId).update({ state: 'running', attempts: 5, runId: 'expired', leaseUntil: 1 });
    await db().collection('premium_route_active').doc(sha(uid)).update({ state: 'running', leaseUntil: 1 });
    await schedule(premium.reconcileExpiredPremiumRoutes);
    await runWorker(jobId);
    expect(await wallet()).toMatchObject({ balance: 100, reservedBalance: 0 });
    expect((await jobRef(jobId).get()).data()?.failureCode).toBe('worker_lease_expired');
  });

  it('refuses missing App Check, insufficient balance, stale quotes, changed requests and unsupported preferences', async () => {
    await expect((premium.quotePremiumRoute as any).run({ auth: { uid }, data: { route: request } })).rejects.toMatchObject({ code: 'unauthenticated' });
    const quote = await call(premium.quotePremiumRoute, { route: request });
    const data = { route: request, quoteId: quote.quoteId, userSelectedPriority: null };
    await expect(call(premium.createPremiumRoute, { ...data, route: { ...request, destination: { lat: 52.53, lng: 13.404 } } })).rejects.toMatchObject({ code: 'failed-precondition' });
    await db().collection('user_tokens').doc(uid).update({ balance: 0 });
    await expect(call(premium.createPremiumRoute, data)).rejects.toMatchObject({ code: 'failed-precondition' });
    await db().collection('user_tokens').doc(uid).update({ balance: 100 });
    await db().collection('premium_route_quotes').doc(sha(`${uid}:${quote.quoteId}`)).update({ expiresAt: 1 });
    await expect(call(premium.createPremiumRoute, data)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(call(premium.quotePremiumRoute, { route: { ...request, interests: ['nature'] } })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(await wallet()).toMatchObject({ balance: 100, reservedBalance: 0 });
    expect((await db().collection('token_ledger').get()).empty).toBe(true);
  });
});
