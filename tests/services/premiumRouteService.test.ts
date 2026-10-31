import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'alice' } as { uid: string } | null },
  consent: { revision: 1, essential: true },
  quote: vi.fn(), create: vi.fn(), result: vi.fn(), cancel: vi.fn(), list: vi.fn(), candidate: vi.fn(),
}));
vi.mock('../../src/firebase', () => ({ auth: mocks.auth, functions: {} }));
vi.mock('../../src/services/routeArchiveService', () => ({ routeArchive: { saveGenerated: vi.fn() } }));
vi.mock('../../src/services/consentService', () => ({ ConsentService: {
  get allowsEssential() { return mocks.consent.essential; },
  getRevision: () => mocks.consent.revision,
} }));
vi.mock('firebase/functions', () => ({ httpsCallable: (_functions: unknown, name: string) => ({
  quotePremiumRoute: mocks.quote, createPremiumRoute: mocks.create, getPremiumRouteResult: mocks.result,
  cancelPremiumRoute: mocks.cancel, listPremiumRouteArchive: mocks.list, getPremiumRouteCandidate: mocks.candidate,
}[name]) }));
import { PremiumRouteService } from '../../src/services/premiumRouteService';
import type { RouteRequestV1 } from '../../src/types/routing';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    confirm: vi.fn(() => true),
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  });
  mocks.auth.currentUser = { uid: 'alice' };
  mocks.consent.revision = 1;
  mocks.consent.essential = true;
  mocks.quote.mockResolvedValue({ data: { quoteId: 'quote', amount: 5, currency: 'token',
    provider: 'gemini', model: 'test-model', routerProvider: 'brouter' } });
  mocks.create.mockResolvedValue({ data: { jobId: 'job', status: 'queued' } });
  mocks.cancel.mockResolvedValue({ data: { status: 'cancelled' } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

function start(signal?: AbortSignal) {
  // Attach both handlers immediately: cancellation must not create an unhandled rejection.
  return PremiumRouteService.generate({} as RouteRequestV1, null, signal)
    .then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
}

it('cancels the server job when aborted during the polling delay', async () => {
  const controller = new AbortController(), pending = start(controller.signal);
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.create).toHaveBeenCalledOnce();
  controller.abort();
  expect((await pending).error).toMatchObject({ name: 'AbortError' });
  expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith({ jobId: 'job' });
  expect(mocks.result).not.toHaveBeenCalled();
});

it.each(['consent', 'account'] as const)('cancels after %s changes while a result is in flight', async change => {
  let complete!: (value: unknown) => void;
  mocks.result.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const pending = start();
  await vi.advanceTimersByTimeAsync(2000);
  expect(mocks.result).toHaveBeenCalledOnce();
  if (change === 'consent') mocks.consent.revision++;
  else mocks.auth.currentUser = { uid: 'bob' };
  complete({ data: { jobId: 'job', status: 'ready' } });
  expect((await pending).error).toMatchObject({ name: 'AbortError' });
  expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith({ jobId: 'job' });
});

it('reports an unconfirmed server cancellation together with the stable job ID', async () => {
  mocks.cancel.mockRejectedValue(new Error('network unavailable'));
  const controller = new AbortController(), pending = start(controller.signal);
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  expect((await pending).error?.message).toContain('Auftrags-ID: job');
  expect((await pending).error?.message).toContain('nicht bestätigt');
});

it('rejects results for a different job without switching the polling identity', async () => {
  mocks.result.mockResolvedValue({ data: { jobId: 'someone-else', status: 'running' } });
  const pending = start();
  await vi.advanceTimersByTimeAsync(2000);
  expect((await pending).error?.message).toContain('nicht zum angefragten Auftrag');
  expect(mocks.result).toHaveBeenCalledExactlyOnceWith({ jobId: 'job' });
});

it('does not create or charge a job when the price is declined', async () => {
  vi.mocked(window.confirm).mockReturnValue(false);
  expect((await start()).error).toMatchObject({ name: 'AbortError' });
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.cancel).not.toHaveBeenCalled();
});
