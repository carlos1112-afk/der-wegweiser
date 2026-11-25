import { afterEach, describe, expect, it, jest } from '@jest/globals';

const mockGet = jest.fn();
const mockDelete = jest.fn();
const mockGetFiles = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockCollection = jest.fn();
const mockRun = jest.fn();

jest.mock('firebase-admin/firestore', () => ({
  FieldPath: { documentId: jest.fn() },
  FieldValue: { increment: jest.fn(), serverTimestamp: jest.fn() },
  Timestamp: { fromMillis: (millis: number) => ({ millis }) },
  getFirestore: () => ({ collection: mockCollection }),
}));
jest.mock('firebase-admin/storage', () => ({
  getStorage: () => ({ bucket: () => ({ getFiles: mockGetFiles }) }),
}));
jest.mock('firebase-admin/functions', () => ({
  getFunctions: () => ({ taskQueue: jest.fn(() => ({ enqueue: jest.fn() })) }),
}));
jest.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {},
  onCall: (options: unknown, handler: unknown) => handler,
}));
jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (options: unknown, handler: (event?: unknown) => Promise<void>) => ({ run: handler }),
}));
jest.mock('firebase-functions/tasks', () => ({ onTaskDispatched: (options: unknown, handler: unknown) => handler }));
jest.mock('firebase-functions/params', () => ({ defineString: () => ({ value: () => '' }) }));
jest.mock('../src/routing/contracts', () => ({
  RoutingError: class RoutingError extends Error {},
  ROUTING_CONSENT_VERSION: '1',
  ROUTING_LIMITS: { defaultTokenPrice: 1 },
}));
jest.mock('../src/routing/validation', () => ({ parseRouteRequest: jest.fn(), validateRoute: jest.fn() }));
jest.mock('../src/routing/freeRoute', () => ({
  isOperatorConfig: jest.fn(), operatorRoutingBase: jest.fn(), operatorRoutingUrl: jest.fn(), parseBRouterTrack: jest.fn(),
}));
jest.mock('../src/routing/placeSearch', () => ({ consumeRoutingLimit: jest.fn() }));
jest.mock('../src/wallet/firestoreLedger', () => ({ prepareWalletMutation: jest.fn() }));
jest.mock('../src/routing/aiProvider', () => ({
  chooseRouteCandidate: jest.fn(), RouteAiProviderError: class RouteAiProviderError extends Error {},
  scoreRouteCandidates: jest.fn(), routeAiApiKey: { value: jest.fn() }, routeAiModel: { value: jest.fn() },
  routeAiProvider: { value: jest.fn() }, routeAiSecrets: [], routePremiumRelease: { value: jest.fn() },
}));
jest.mock('../src/routing/openRouteService', () => ({
  fetchOpenRouteServiceCandidates: jest.fn(), OpenRouteServiceError: class OpenRouteServiceError extends Error {},
  routeEngine: { value: jest.fn() }, routeProviderApiKey: { value: jest.fn() }, routeProviderSecrets: [],
}));

import { cleanupExpiredRouteArtifacts } from '../src/routing/premiumRoute';

afterEach(() => {
  jest.clearAllMocks();
});

describe('cleanupExpiredRouteArtifacts', () => {
  const runCleanup = () => (cleanupExpiredRouteArtifacts as unknown as { run: () => Promise<void> }).run();

  it('deletes an expired job, its archived files, and its outbox entry', async () => {
    const expiredDoc = { id: 'expired-job', data: () => ({ userId: 'user-1' }), ref: { delete: mockDelete } };
    mockGet.mockResolvedValue({ docs: [expiredDoc] });
    mockGetFiles.mockResolvedValue([[{ delete: jest.fn().mockResolvedValue(undefined) }]]);
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ get: mockGet });
    mockCollection.mockImplementation((name: string) => {
      if (name === 'premium_route_jobs') return { where: mockWhere };
      return { doc: jest.fn(() => ({ delete: mockDelete })) };
    });

    await runCleanup();

    expect(mockGetFiles).toHaveBeenCalledWith({ prefix: 'users/user-1/route-archive/expired-job/' });
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete.mock.invocationCallOrder[0]).toBeLessThan(mockDelete.mock.invocationCallOrder[1]);
  });

  it('does not delete any job or artifact when no jobs have reached the retention cutoff', async () => {
    mockGet.mockResolvedValue({ docs: [] });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ get: mockGet });
    mockCollection.mockReturnValue({ where: mockWhere });

    await runCleanup();

    expect(mockGetFiles).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
