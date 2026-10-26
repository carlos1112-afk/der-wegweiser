import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OfflineMapService, DownloadedRegionInfo, MAX_TILE_REQUESTS, OfflineRegionBounds } from '../../src/services/offlineMapService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup basic mocks for global objects required by OfflineMapService
let fetchedUrls: string[] = [];
let cachePuts: { url: string; response: Response }[] = [];
let cacheMatches: string[] = [];
let localStorageStore: Record<string, string> = {};
let mockFetchFails = false;

// Dummy classes to represent fetch Response and Blob
class MockBlob {
  size: number = 1024;
}

class MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;

  constructor(url: string, ok: boolean = true) {
    this.url = url;
    this.ok = ok;
    this.status = ok ? 200 : 404;
    this.statusText = ok ? 'OK' : 'Not Found';
  }

  async blob() {
    return new MockBlob();
  }

  clone() {
    return new MockResponse(this.url, this.ok);
  }
}

const mockCache = {
  match: async (req: string | Request) => {
    const url = typeof req === 'string' ? req : (req as Request).url;
    cacheMatches.push(url);
    const existing = cachePuts.find(c => c.url === url);
    return existing ? existing.response : undefined;
  },
  put: async (req: string | Request, response: Response) => {
    const url = typeof req === 'string' ? req : (req as Request).url;
    cachePuts.push({ url, response });
  }
};

describe('OfflineMapService', () => {
  let originalWindow: any;
  let originalCaches: any;
  let originalFetch: any;
  let originalLocalStorage: any;

  beforeEach(() => {
    fetchedUrls = [];
    cachePuts = [];
    cacheMatches = [];
    localStorageStore = {};
    mockFetchFails = false;

    originalWindow = global.window;
    originalCaches = global.caches;
    originalFetch = global.fetch;
    originalLocalStorage = global.localStorage;

    (global as any).window = { caches: true };
    (global as any).caches = {
      open: async () => mockCache,
      match: mockCache.match
    };
    (global as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      fetchedUrls.push(url);
      if (mockFetchFails) {
        throw new TypeError('Network request failed');
      }
      return new MockResponse(url);
    };
    (global as any).localStorage = {
      getItem: (key: string) => localStorageStore[key] || null,
      setItem: (key: string, value: string) => { localStorageStore[key] = value; },
      removeItem: (key: string) => { delete localStorageStore[key]; },
    };
  });

  afterEach(() => {
    (global as any).window = originalWindow;
    (global as any).caches = originalCaches;
    (global as any).fetch = originalFetch;
    (global as any).localStorage = originalLocalStorage;
  });

  it('caches a region successfully', async () => {
    // Very small bounding box to limit the number of tiles generated
    const bounds: OfflineRegionBounds = {
      minLat: 52.5,
      maxLat: 52.501,
      minLng: 13.4,
      maxLng: 13.401,
    };

    let progressCalls = 0;
    let lastProgress = 0;
    const success = await OfflineMapService.downloadOfflineRegion('TestRegion', bounds, (percent) => {
      progressCalls++;
      lastProgress = percent;
    });

    expect(success).toBe(true);
    expect(progressCalls).toBeGreaterThan(0);
    expect(lastProgress).toBe(100);

    // It should have generated tile urls and attempted to fetch them
    expect(fetchedUrls.length).toBeGreaterThan(0);

    // It should have stored tiles in the mock cache
    expect(cachePuts.length).toBeGreaterThan(0);
    expect(cachePuts.length).toBe(fetchedUrls.length);

    // It should have saved region metadata to localStorage
    const savedData = localStorageStore['der_wegweiser_offline_regions'];
    expect(savedData).toBeTruthy();
    const regions: DownloadedRegionInfo[] = JSON.parse(savedData);
    const savedRegion = regions.find(r => r.name === 'TestRegion');
    expect(savedRegion).toBeTruthy();
    expect(savedRegion?.tileCount).toBe(fetchedUrls.length);
  });

  it('retrieves cached tiles when network is unavailable', async () => {
    const bounds: OfflineRegionBounds = {
      minLat: 52.5,
      maxLat: 52.501,
      minLng: 13.4,
      maxLng: 13.401,
    };

    // First populate the cache
    await OfflineMapService.downloadOfflineRegion('TestRegion', bounds, () => {});

    const previousCacheCount = cachePuts.length;
    expect(previousCacheCount).toBeGreaterThan(0);

    // Reset fetchedUrls to track new fetches
    fetchedUrls = [];

    // Set network to fail
    mockFetchFails = true;

    // Call again - it should rely on cache and not fetch
    const success = await OfflineMapService.downloadOfflineRegion('TestRegion2', bounds, () => {});
    expect(success).toBe(true);

    // Since tiles were in cache, it should not have attempted to fetch them
    expect(fetchedUrls.length).toBe(0);

    // It should have added metadata for TestRegion2
    const savedData = localStorageStore['der_wegweiser_offline_regions'];
    expect(savedData).toBeTruthy();
    const regions: DownloadedRegionInfo[] = JSON.parse(savedData);
    expect(regions.find(r => r.name === 'TestRegion2')).toBeTruthy();
  });

  it('returns false for empty coordinates in prefetchRouteCorridor', async () => {
    const success = await OfflineMapService.prefetchRouteCorridor([]);
    expect(success).toBe(false);
  });

  it('rejects excessive bounding boxes before allocating or fetching tile URLs', async () => {
    const success = await OfflineMapService.downloadOfflineRegion('TooLarge', {
      minLat: -80,
      maxLat: 80,
      minLng: -170,
      maxLng: 170,
    }, () => {});

    expect(success).toBe(false);
    expect(fetchedUrls).toHaveLength(0);
    expect(MAX_TILE_REQUESTS).toBeGreaterThan(0);
  });

  it('rejects non-finite route coordinates without starting a prefetch', async () => {
    const success = await OfflineMapService.prefetchRouteCorridor([[52.5, Number.NaN]]);
    expect(success).toBe(false);
    expect(fetchedUrls).toHaveLength(0);
  });

  it('prefetches a route corridor successfully', async () => {
    const coordinates: [number, number][] = [
      [52.5, 13.4],
      [52.51, 13.41],
    ];
    const success = await OfflineMapService.prefetchRouteCorridor(coordinates);
    expect(success).toBe(true);
    expect(fetchedUrls.length).toBeGreaterThan(0);
    expect(fetchedUrls.length).toBeLessThanOrEqual(MAX_TILE_REQUESTS);
    expect(localStorageStore['der_wegweiser_offline_regions']).toContain('Aktive Route Korridor');
  });

  it('retrieves and parses existing regions from localStorage', async () => {
    const mockRegions: DownloadedRegionInfo[] = [
      {
        name: 'Stored Region',
        sizeMb: 10,
        date: '01.01.2024',
        tileCount: 100,
      }
    ];
    localStorageStore['der_wegweiser_offline_regions'] = JSON.stringify(mockRegions);
    const regions = await OfflineMapService.getDownloadedRegions();
    expect(regions.length).toBe(1);
    expect(regions[0].name).toBe('Stored Region');
  });

  it('handles malformed localStorage data in getDownloadedRegions', async () => {
    localStorageStore['der_wegweiser_offline_regions'] = 'invalid-json';
    const regions = await OfflineMapService.getDownloadedRegions();
    expect(regions.length).toBeGreaterThan(0); // returns defaults
    expect(regions[0].name).toBe('Berlin Zentrum & Badesee');
  });

  it('deletes an offline region successfully', async () => {
    const mockRegions: DownloadedRegionInfo[] = [
      {
        name: 'Region To Delete',
        sizeMb: 10,
        date: '01.01.2024',
        tileCount: 100,
      },
      {
        name: 'Region To Keep',
        sizeMb: 15,
        date: '02.01.2024',
        tileCount: 150,
      }
    ];
    localStorageStore['der_wegweiser_offline_regions'] = JSON.stringify(mockRegions);

    const success = await OfflineMapService.deleteOfflineRegion('Region To Delete');
    expect(success).toBe(true);

    const savedData = localStorageStore['der_wegweiser_offline_regions'];
    expect(savedData).toBeTruthy();
    const regions: DownloadedRegionInfo[] = JSON.parse(savedData);
    expect(regions.length).toBe(1);
    expect(regions[0].name).toBe('Region To Keep');
  });
});

describe('Service Worker - Offline tile behavior', () => {
  let mockCacheStorage: Record<string, MockResponse> = {};

  // A mock Request class
  class MockRequest {
    url: string;
    method: string;
    mode: string;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.mode = init?.mode || 'cors';
    }
  }

  // A mock Response class matching global Response interface for SW
  class SWResponse {
    body: any;
    status: number;
    statusText: string;
    constructor(body: any, init?: any) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
    }
    clone() {
      return new SWResponse(this.body, { status: this.status, statusText: this.statusText });
    }
  }

  it('fails honestly with 504 when requested tile was never cached and network is offline', async () => {
    // Read and evaluate the actual sw.js file logic
    const swPath = path.join(__dirname, '../../public/sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');

    const eventListeners: Record<string, Function> = {};
    const mockSelf = {
      addEventListener: (event: string, callback: Function) => {
        eventListeners[event] = callback;
      },
      skipWaiting: () => Promise.resolve(),
      clients: {
        claim: () => Promise.resolve()
      }
    };

    let respondedWithPromise: Promise<SWResponse> | null = null;

    // Set up mock globals needed by sw.js
    const mockGlobals = {
      self: mockSelf,
      caches: {
        open: async (name: string) => ({
          match: async (req: any) => mockCacheStorage[req.url],
          put: async (req: any, res: any) => { mockCacheStorage[req.url] = res; },
          addAll: async () => {}
        }),
        match: async () => undefined,
        keys: async () => [],
        delete: async () => true
      },
      fetch: async () => {
        throw new TypeError('Failed to fetch'); // Network is offline
      },
      Response: SWResponse,
      console: { log: () => {}, warn: () => {}, error: () => {} }
    };

    // Create a function string that wraps sw.js to execute it with our mocks
    const wrapper = `
      (function(self, caches, fetch, Response, console) {
        ${swContent}
      })(mockGlobals.self, mockGlobals.caches, mockGlobals.fetch, mockGlobals.Response, mockGlobals.console);
    `;

    // Execute sw.js
    eval(wrapper);

    // Get the fetch event handler
    const fetchHandler = eventListeners['fetch'];
    expect(fetchHandler).toBeTruthy();

    // Create a mock fetch event
    const mockEvent = {
      request: new MockRequest('https://a.basemaps.cartocdn.com/rastertiles/voyager/12/2200/1343.png'),
      respondWith: (promise: Promise<SWResponse>) => {
        respondedWithPromise = promise;
      }
    };

    // Run the fetch handler
    fetchHandler(mockEvent);

    // Verify that respondWith was called
    expect(respondedWithPromise).toBeTruthy();

    // Wait for the response
    const response = await respondedWithPromise;

    // Assert honest degradation
    expect(response?.status).toBe(504);
    expect(response?.statusText).toBe('Offline tile unavailable');
  });
});
