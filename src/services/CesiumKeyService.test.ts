/**
 * Unit-Tests: CesiumKeyService — kritische Pfade (Rate-Limit, Error-Codes, httpsCallable-Protokoll)
 * Ziel: Mutation-Score ≥95% für Security-Code (analog PremiumKeyService.test.ts)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  UserFacingError,
  getCesiumIonToken,
  clearTokenCache,
  _resetForTesting,
} from './CesiumKeyService';

// Mock callable — overridden per test as needed
let mockCallable: ReturnType<typeof vi.fn>;
const mockHttpsCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));
vi.mock('../firebase', () => ({
  functions: { __mockFunctionsInstance: true },
}));

beforeEach(() => {
  vi.useFakeTimers();
  _resetForTesting();
  mockCallable = vi.fn().mockResolvedValue({ data: { token: 'ION_TOKEN_OK' } });
  mockHttpsCallable.mockReturnValue(mockCallable);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('UserFacingError', () => {
  it('sets name to UserFacingError', () => {
    const err = new UserFacingError('msg', 'CODE');
    expect(err.name).toBe('UserFacingError');
  });

  it('stores code', () => {
    const err = new UserFacingError('msg', 'MY_CODE');
    expect(err.code).toBe('MY_CODE');
  });

  it('is instanceof Error', () => {
    expect(new UserFacingError('msg', 'C')).toBeInstanceOf(Error);
  });
});

describe('getCesiumIonToken — dev path (no VITE_CESIUM_ION_TOKEN call)', () => {
  it('returns dev token from env without calling httpsCallable', async () => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', 'DEV_TOKEN_123');
    const token = await getCesiumIonToken();
    expect(token).toBe('DEV_TOKEN_123');
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });
});

describe('httpsCallable wire protocol (NOT raw fetch)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', '');
  });

  it('calls httpsCallable with the Functions instance and function name "issueCesiumIonToken"', async () => {
    await getCesiumIonToken();
    expect(mockHttpsCallable).toHaveBeenCalledWith(
      { __mockFunctionsInstance: true },
      'issueCesiumIonToken',
    );
  });

  it('invokes the callable with an empty payload (no manual headers/body)', async () => {
    await getCesiumIonToken();
    expect(mockCallable).toHaveBeenCalledWith({});
  });

  it('reads the token from result.data.token (httpsCallable response shape)', async () => {
    mockCallable.mockResolvedValueOnce({ data: { token: 'ANOTHER_TOKEN' } });
    const token = await getCesiumIonToken();
    expect(token).toBe('ANOTHER_TOKEN');
  });

  it('throws INVALID_RESPONSE when result.data has no token field', async () => {
    mockCallable.mockResolvedValueOnce({ data: {} });
    const err = await getCesiumIonToken().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('INVALID_RESPONSE');
  });

  it('never touches globalThis.fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await getCesiumIonToken();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('FunctionsError mapping', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', '');
  });

  it('maps functions/unauthenticated to UNAUTHENTICATED', async () => {
    mockCallable.mockRejectedValueOnce({ code: 'functions/unauthenticated', message: 'nope' });
    const err = await getCesiumIonToken().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('maps functions/permission-denied to PAYMENT_REQUIRED', async () => {
    mockCallable.mockRejectedValueOnce({ code: 'functions/permission-denied', message: 'nope' });
    const err = await getCesiumIonToken().catch((e) => e);
    expect(err.code).toBe('PAYMENT_REQUIRED');
  });

  it('maps functions/resource-exhausted to RATE_LIMIT_EXCEEDED', async () => {
    mockCallable.mockRejectedValueOnce({ code: 'functions/resource-exhausted', message: 'nope' });
    const err = await getCesiumIonToken().catch((e) => e);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('maps unknown FunctionsError codes to FUNCTIONS_ERROR', async () => {
    mockCallable.mockRejectedValueOnce({ code: 'functions/internal', message: 'boom' });
    const err = await getCesiumIonToken().catch((e) => e);
    expect(err.code).toBe('FUNCTIONS_ERROR');
  });
});

describe('Client-side rate limiter — RATE_LIMIT_MAX = 5 per 60s', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', '');
  });

  it('allows exactly 5 requests within 60s window', async () => {
    for (let i = 0; i < 5; i++) {
      clearTokenCache();
      const token = await getCesiumIonToken();
      expect(token).toBe('ION_TOKEN_OK');
    }
    expect(mockCallable).toHaveBeenCalledTimes(5);
  });

  it('throws RATE_LIMIT_EXCEEDED on 6th request within 60s', async () => {
    for (let i = 0; i < 5; i++) {
      clearTokenCache();
      await getCesiumIonToken();
    }
    clearTokenCache();
    const err = await getCesiumIonToken().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('resets after 60s window expires (61s)', async () => {
    for (let i = 0; i < 5; i++) {
      clearTokenCache();
      await getCesiumIonToken();
    }
    vi.advanceTimersByTime(61_000);
    clearTokenCache();
    const token = await getCesiumIonToken();
    expect(token).toBe('ION_TOKEN_OK');
  });
});

describe('Cache: 5min TTL', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', '');
  });

  it('returns cached token on second call without calling httpsCallable again', async () => {
    await getCesiumIonToken();
    await getCesiumIonToken();
    expect(mockCallable).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after cache TTL expires (5 min + 1ms)', async () => {
    await getCesiumIonToken();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await getCesiumIonToken();
    expect(mockCallable).toHaveBeenCalledTimes(2);
  });

  it('does not re-fetch when cache is still valid (4 min 59s)', async () => {
    await getCesiumIonToken();
    vi.advanceTimersByTime(4 * 60 * 1000 + 59_000);
    await getCesiumIonToken();
    expect(mockCallable).toHaveBeenCalledTimes(1);
  });
});

describe('Dev token caching', () => {
  it('cached dev token is returned even after env token is removed (no re-fetch)', async () => {
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', 'DEV_TOKEN');
    await getCesiumIonToken();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_CESIUM_ION_TOKEN', '');
    const token = await getCesiumIonToken();
    expect(token).toBe('DEV_TOKEN');
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });
});
