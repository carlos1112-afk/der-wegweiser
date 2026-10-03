import test, { beforeEach, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ChargingStationImportService } from '../src/services/chargingStationImportService';

class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('ChargingStationImportService.fetchFromOSM', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalLocalStorage: typeof globalThis.localStorage;
  let originalConsoleError: typeof console.error;
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalLocalStorage = globalThis.localStorage;
    originalConsoleError = console.error;

    mockStorage = new MockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    }
  });

  const sampleBounds = { south: 52.5, west: 13.3, north: 52.6, east: 13.4 };
  const expectedCacheKey = 'osm_charging_stations_cache_52.5_13.3_52.6_13.4';

  test('returns cached data if cache is valid and not expired', async () => {
    const cachedData = [
      {
        id: 'osm_123',
        name: 'Cached Station',
        lat: 52.51,
        lng: 13.31,
        plugType: 'schuko_230v',
        isWeatherproof: true,
        isFree: true,
        openingHours: '24/7',
        nearbyAmenities: [],
        verifiedByCount: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        createdByUserId: 'system_osm',
        isVerifiedBikeInfrastructure: true,
      },
    ];

    mockStorage.setItem(
      expectedCacheKey,
      JSON.stringify({
        timestamp: Date.now() - 1000 * 60 * 30, // 30 mins ago (TTL is 1 hr)
        data: cachedData,
      })
    );

    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ elements: [] }));
    }) as typeof fetch;

    const result = await ChargingStationImportService.fetchFromOSM(sampleBounds);

    assert.equal(fetchCalled, false, 'Fetch should not be called when valid cache exists');
    assert.deepEqual(result, cachedData);
  });

  test('fetches from API if cache is expired', async () => {
    const expiredData = [{ id: 'osm_old' }];
    mockStorage.setItem(
      expectedCacheKey,
      JSON.stringify({
        timestamp: Date.now() - 1000 * 60 * 61, // 61 mins ago
        data: expiredData,
      })
    );

    let fetchCalled = false;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalled = true;
      assert.equal(url, 'https://overpass-api.de/api/interpreter');
      assert.equal(init?.method, 'POST');
      assert.match(init?.body as string, /52\.5,13\.3,52\.6,13\.4/);

      const mockResponse = {
        elements: [
          {
            type: 'node',
            id: 999,
            lat: 52.55,
            lon: 13.35,
            tags: {
              name: 'Fresh Station',
              'socket:schuko': 'yes',
              fee: 'no',
              covered: 'yes',
              opening_hours: '08:00-20:00',
              bicycle: 'yes',
            },
          },
        ],
      };
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    }) as typeof fetch;

    const result = await ChargingStationImportService.fetchFromOSM(sampleBounds);

    assert.equal(fetchCalled, true, 'Fetch should be called when cache is expired');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'osm_999');
    assert.equal(result[0].name, 'Fresh Station');
    assert.equal(result[0].plugType, 'schuko_230v');
    assert.equal(result[0].isFree, true);
    assert.equal(result[0].isWeatherproof, true);
    assert.equal(result[0].openingHours, '08:00-20:00');
    assert.equal(result[0].isVerifiedBikeInfrastructure, true);

    // Verify cache was updated
    const newCachedRaw = mockStorage.getItem(expectedCacheKey);
    assert.notEqual(newCachedRaw, null);
    const newCached = JSON.parse(newCachedRaw!);
    assert.equal(newCached.data[0].id, 'osm_999');
  });

  test('handles corrupt JSON in cache gracefully and fetches from API', async () => {
    mockStorage.setItem(expectedCacheKey, '{ invalid json');

    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ elements: [] }), { status: 200 });
    }) as typeof fetch;

    const result = await ChargingStationImportService.fetchFromOSM(sampleBounds);

    assert.equal(fetchCalled, true);
    assert.deepEqual(result, []);
  });

  test('correctly parses plug types, fee options, names, and bike repair stations', async () => {
    globalThis.fetch = (async () => {
      const mockResponse = {
        elements: [
          // Station 1: Schuko plug, fee=0, name from operator
          {
            type: 'node',
            id: 1,
            lat: 52.51,
            lon: 13.31,
            tags: {
              'socket:schuko': '2',
              fee: '0',
              operator: 'Stadtwerke Berlin',
            },
          },
          // Station 2: Repair station default name, fee not specified
          {
            type: 'node',
            id: 2,
            lat: 52.52,
            lon: 13.32,
            tags: {
              amenity: 'bicycle_repair_station',
              fee: 'yes',
            },
          },
          // Station 3: Unknown plug, fee=yes, fallback default name
          {
            type: 'node',
            id: 3,
            lat: 52.53,
            lon: 13.33,
            tags: {
              amenity: 'charging_station',
            },
          },
          // Station 4: Non-node element (should be skipped)
          {
            type: 'way',
            id: 4,
            tags: { name: 'Ignored Way' },
          },
        ],
      };
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    }) as typeof fetch;

    const result = await ChargingStationImportService.fetchFromOSM(sampleBounds);

    assert.equal(result.length, 3);

    // Station 1
    assert.equal(result[0].id, 'osm_1');
    assert.equal(result[0].name, 'Stadtwerke Berlin');
    assert.equal(result[0].plugType, 'schuko_230v');
    assert.equal(result[0].isFree, true);
    assert.equal(result[0].isVerifiedBikeInfrastructure, false);

    // Station 2
    assert.equal(result[1].id, 'osm_2');
    assert.equal(result[1].name, 'Fahrrad-Reparaturstation');
    assert.equal(result[1].plugType, 'unknown');
    assert.equal(result[1].isFree, false);
    assert.equal(result[1].isVerifiedBikeInfrastructure, true);

    // Station 3
    assert.equal(result[2].id, 'osm_3');
    assert.equal(result[2].name, 'E-Bike Ladestation');
    assert.equal(result[2].plugType, 'unknown');
    assert.equal(result[2].isFree, false);
    assert.equal(result[2].openingHours, 'Unbekannt');
    assert.equal(result[2].isWeatherproof, false);
  });

  test('returns empty array and logs error when response is not ok', async () => {
    console.error = () => {}; // Suppress console.error during expected failure
    globalThis.fetch = (async () => {
      return new Response('Internal Server Error', { status: 500, statusText: 'Server Error' });
    }) as typeof fetch;

    const result = await ChargingStationImportService.fetchFromOSM(sampleBounds);

    assert.deepEqual(result, []);
  });

  test('returns empty array when network call throws an error', async () => {
    console.error = () => {}; // Suppress console.error during expected failure
    globalThis.fetch = (async () => {
      throw new Error('Network failure');
    }) as typeof fetch;

    const result = await ChargingStationImportService.fetchFromOSM(sampleBounds);

    assert.deepEqual(result, []);
  });
});
