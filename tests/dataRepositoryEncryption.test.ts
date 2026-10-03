import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { encryptData, decryptData, dataRepository } from '../src/services/dataRepository';
import type { Route } from '../src/types/navigation';

// Mock localStorage for node environment if needed
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

describe('DataRepository Route Encryption', () => {
  const userId = 'user_test_123';
  const sampleRoute: Route = {
    id: 'route_test_1',
    title: 'Secret Forest Ride',
    coordinates: [[52.52, 13.405], [52.53, 13.41]],
    distanceKm: 12.5,
    estimatedMinutes: 45,
    elevationGainM: 120,
    surfaceType: 'forest',
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('encrypts and decrypts route data successfully', async () => {
    const encrypted = await encryptData(userId, sampleRoute);
    assert.strictEqual(encrypted.startsWith('enc:v1:'), true);
    assert.strictEqual(encrypted.includes('Secret Forest Ride'), false);

    const decrypted = await decryptData<Route>(userId, encrypted);
    assert.deepStrictEqual(decrypted, sampleRoute);
  });

  it('saves route encrypted in localStorage via dataRepository.saveRoute', async () => {
    await dataRepository.saveRoute(userId, sampleRoute);

    const storedRaw = localStorage.getItem(`routes_${userId}`);
    assert.notStrictEqual(storedRaw, null);
    assert.strictEqual(storedRaw!.startsWith('enc:v1:'), true);
    assert.strictEqual(storedRaw!.includes('Secret Forest Ride'), false);

    const savedRoutes = await dataRepository.getSavedRoutes(userId);
    assert.strictEqual(savedRoutes.length, 1);
    assert.strictEqual(savedRoutes[0].id, sampleRoute.id);
    assert.strictEqual(savedRoutes[0].title, sampleRoute.title);
  });

  it('handles backward compatibility for unencrypted legacy routes', async () => {
    // Store unencrypted raw JSON legacy data in localStorage
    const legacyRoutes = [sampleRoute];
    localStorage.setItem(`routes_${userId}`, JSON.stringify(legacyRoutes));

    // Reading should succeed and return the unencrypted route
    const savedRoutes = await dataRepository.getSavedRoutes(userId);
    assert.strictEqual(savedRoutes.length, 1);
    assert.strictEqual(savedRoutes[0].title, 'Secret Forest Ride');

    // Saving another route should upgrade the storage to encrypted format
    const sampleRoute2: Route = {
      ...sampleRoute,
      id: 'route_test_2',
      title: 'Lake Promenade',
    };
    await dataRepository.saveRoute(userId, sampleRoute2);

    const updatedStoredRaw = localStorage.getItem(`routes_${userId}`);
    assert.strictEqual(updatedStoredRaw!.startsWith('enc:v1:'), true);
    assert.strictEqual(updatedStoredRaw!.includes('Lake Promenade'), false);

    const allRoutes = await dataRepository.getSavedRoutes(userId);
    assert.strictEqual(allRoutes.length, 2);
  });
});
