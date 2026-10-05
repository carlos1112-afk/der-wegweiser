/**
 * Unit-Tests: PremiumKeyService — kritische Pfade (Rate-Limit, Error-Codes)
 * Ziel: Mutation-Score ≥95% für Security-Code
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  UserFacingError,
  getGoogleMapsKey,
  clearKeyCache,
  _resetForTesting,
  setAppCheckInstance,
} from './PremiumKeyService';

// Stable mock for fetch — overridden per test as needed
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  _resetForTesting(); // resets both key cache and rate limiter
  mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ key: 'MAPS_KEY_OK' }),
  });
  globalThis.fetch = mockFetch as typeof fetch;
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
    const err = new UserFacingError('msg', 'C');
    expect(err).toBeInstanceOf(Error);
  });

  it('message matches constructor arg', () => {
    const err = new UserFacingError('hello world', 'C');
    expect(err.message).toBe('hello world');
  });
});

describe('setAppCheckInstance', () => {
  it('accepts an AppCheck instance without throwing', () => {
    expect(() => setAppCheckInstance({} as any)).not.toThrow();
  });
});

describe('getGoogleMapsKey — dev path (no FUNCTIONS_URL)', () => {
  it('returns dev key from env when VITE_GOOGLE_MAPS_API_KEY is set', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'DEV_KEY_123');
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_URL', '');
    const key = await getGoogleMapsKey();
    expect(key).toBe('DEV_KEY_123');
    // No fetch call for dev key
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws UserFacingError MISSING_FUNCTIONS_URL when neither key nor URL present', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_URL', '');
    const err = await getGoogleMapsKey().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('MISSING_FUNCTIONS_URL');
  });
});

describe('Rate limiter — RATE_LIMIT_MAX = 5 per 60s', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_URL', 'https://fake.functions.url');
  });

  it('allows exactly 5 requests within 60s window', async () => {
    for (let i = 0; i < 5; i++) {
      clearKeyCache();
      const key = await getGoogleMapsKey();
      expect(key).toBe('MAPS_KEY_OK');
    }
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it('throws RATE_LIMIT_EXCEEDED on 6th request within 60s', async () => {
    for (let i = 0; i < 5; i++) {
      clearKeyCache(); // cache only — rate limiter timestamps accumulate
      await getGoogleMapsKey();
    }
    clearKeyCache(); // clear cache so rate limiter check runs (not a cache hit)
    const err = await getGoogleMapsKey().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('resets after 60s window expires (61s)', async () => {
    for (let i = 0; i < 5; i++) {
      clearKeyCache();
      await getGoogleMapsKey();
    }
    vi.advanceTimersByTime(61_000);
    clearKeyCache(); // skip cache hit, trigger new rate-limit-checked request
    const key = await getGoogleMapsKey();
    expect(key).toBe('MAPS_KEY_OK');
  });

  it('window boundary: request at exactly 60s is still throttled', async () => {
    for (let i = 0; i < 5; i++) {
      clearKeyCache();
      await getGoogleMapsKey();
    }
    vi.advanceTimersByTime(60_000);
    clearKeyCache(); // bypass cache — rate limiter at exactly 60s must still block
    const err = await getGoogleMapsKey().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('Cache: 5min TTL', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_URL', 'https://fake.functions.url');
  });

  it('returns cached key on second call without fetching again', async () => {
    await getGoogleMapsKey();
    await getGoogleMapsKey();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after cache TTL expires (5 min + 1ms)', async () => {
    await getGoogleMapsKey();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    // No clearKeyCache() — the TTL check inside getGoogleMapsKey() handles expiry
    await getGoogleMapsKey();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not re-fetch when cache is still valid (4 min 59s)', async () => {
    await getGoogleMapsKey();
    vi.advanceTimersByTime(4 * 60 * 1000 + 59_000);
    await getGoogleMapsKey();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('re-fetches at exactly 5min boundary (< strict: 300000ms is expired)', async () => {
    await getGoogleMapsKey();
    vi.advanceTimersByTime(5 * 60 * 1000); // exactly 300000ms — cache expires (< strict)
    await getGoogleMapsKey();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('HTTP error responses', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_URL', 'https://fake.functions.url');
  });

  it('throws PAYMENT_REQUIRED on HTTP 402', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 402, json: async () => ({}) });
    const err = await getGoogleMapsKey().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('PAYMENT_REQUIRED');
  });

  it('throws FORBIDDEN on HTTP 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    const err = await getGoogleMapsKey().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('throws HTTP_ERROR on generic server error (HTTP 500)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const err = await getGoogleMapsKey().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('HTTP_ERROR');
  });

  it('throws INVALID_RESPONSE when server returns no key field', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const err = await getGoogleMapsKey().catch((e) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err.code).toBe('INVALID_RESPONSE');
  });
});

describe('Dev key caching', () => {
  it('cached dev key is returned even after env key is removed (no re-fetch)', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'DEV_KEY');
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_URL', '');
    await getGoogleMapsKey(); // caches 'DEV_KEY'
    // Simulate env change — remove dev key without clearing cache
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('VITE_FIREBASE_FUNCTIONS_URL', '');
    const key = await getGoogleMapsKey();
    expect(key).toBe('DEV_KEY'); // served from cache
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
