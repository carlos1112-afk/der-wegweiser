import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ElevationService } from '../src/services/elevationService.js';

describe('ElevationService.getElevations', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  const originalProcessEnv = (globalThis as any).process?.env?.VITE_ELEVATION_PROVIDER_URL;

  beforeEach(() => {
    if ((globalThis as any).process?.env) {
      delete (globalThis as any).process.env.VITE_ELEVATION_PROVIDER_URL;
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
    if ((globalThis as any).process?.env) {
      if (originalProcessEnv === undefined) {
        delete (globalThis as any).process.env.VITE_ELEVATION_PROVIDER_URL;
      } else {
        (globalThis as any).process.env.VITE_ELEVATION_PROVIDER_URL = originalProcessEnv;
      }
    }
  });

  test('returns empty array when coords array is empty or falsy', async () => {
    const res1 = await ElevationService.getElevations([]);
    assert.deepEqual(res1, []);

    const res2 = await ElevationService.getElevations(null as any);
    assert.deepEqual(res2, []);
  });

  test('fetches elevations directly when window is undefined and no custom endpoint set', async () => {
    const coords: [number, number][] = [
      [48.137, 11.575],
      [48.138, 11.576],
    ];

    const requestedUrls: string[] = [];

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      requestedUrls.push(urlStr);

      if (urlStr.includes('api.open-meteo.com')) {
        return new Response(JSON.stringify({ elevation: [519.4, 520.8] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const elevations = await ElevationService.getElevations(coords);

    assert.deepEqual(elevations, [519, 521]);
    assert.equal(requestedUrls.length, 1);
    assert.ok(requestedUrls[0].startsWith('https://api.open-meteo.com/v1/elevation?latitude=48.137,48.138&longitude=11.575,11.576'));
  });

  test('calls window proxy endpoint when window is defined', async () => {
    (globalThis as any).window = {
      location: { origin: 'https://app.wegweiser.de' },
    };

    const coords: [number, number][] = [[48.137, 11.575]];
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      requestedUrls.push(urlStr);

      if (urlStr.startsWith('https://app.wegweiser.de/api/elevation')) {
        return new Response(JSON.stringify({ elevation: [500.2] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: 500 });
    }) as typeof fetch;

    const elevations = await ElevationService.getElevations(coords);

    assert.deepEqual(elevations, [500]);
    assert.equal(requestedUrls.length, 1);
    assert.ok(requestedUrls[0].startsWith('https://app.wegweiser.de/api/elevation?latitude=48.137&longitude=11.575'));
  });

  test('falls back to directUrl when proxy endpoint returns HTTP error or network failure', async () => {
    (globalThis as any).window = {
      location: { origin: 'https://app.wegweiser.de' },
    };

    const coords: [number, number][] = [[48.137, 11.575]];
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      requestedUrls.push(urlStr);

      if (urlStr.startsWith('https://app.wegweiser.de/api/elevation')) {
        // First call fails (e.g., 502 Bad Gateway)
        return new Response('Proxy Error', { status: 502 });
      }

      if (urlStr.startsWith('https://api.open-meteo.com')) {
        return new Response(JSON.stringify({ elevation: [312.1] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(null, { status: 500 });
    }) as typeof fetch;

    const elevations = await ElevationService.getElevations(coords);

    assert.deepEqual(elevations, [312]);
    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls[0].startsWith('https://app.wegweiser.de/api/elevation'));
    assert.ok(requestedUrls[1].startsWith('https://api.open-meteo.com/v1/elevation'));
  });

  test('uses custom endpoint when VITE_ELEVATION_PROVIDER_URL is set', async () => {
    if ((globalThis as any).process?.env) {
      (globalThis as any).process.env.VITE_ELEVATION_PROVIDER_URL = 'https://custom-elevation.service/api';
    }

    const coords: [number, number][] = [[48.137, 11.575]];
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      requestedUrls.push(urlStr);

      if (urlStr.startsWith('https://custom-elevation.service/api')) {
        return new Response(JSON.stringify({ elevation: [100.6] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(null, { status: 500 });
    }) as typeof fetch;

    const elevations = await ElevationService.getElevations(coords);

    assert.deepEqual(elevations, [101]);
    assert.equal(requestedUrls.length, 1);
    assert.ok(requestedUrls[0].startsWith('https://custom-elevation.service/api?latitude=48.137&longitude=11.575'));
  });

  test('throws error when primary fetch throws network error and fallback fetch fails', async () => {
    const coords: [number, number][] = [[48.137, 11.575]];

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.startsWith('https://api.open-meteo.com')) {
        return new Response('Internal Error', { status: 500 });
      }
      throw new Error('Network Connection Refused');
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await ElevationService.getElevations(coords);
      },
      {
        name: 'Error',
        message: '[ElevationService] Live elevation integration unavailable; no fallback is permitted.',
      }
    );
  });

  test('throws error when endpoint returns 200 OK but invalid payload structure (missing elevation array)', async () => {
    const coords: [number, number][] = [[48.137, 11.575]];

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ status: 'ok', data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await ElevationService.getElevations(coords);
      },
      {
        name: 'Error',
        message: '[ElevationService] Live elevation integration unavailable; no fallback is permitted.',
      }
    );
  });
});
