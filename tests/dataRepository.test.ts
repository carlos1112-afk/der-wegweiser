import test from 'node:test';
import assert from 'node:assert';

// Polyfill localStorage for Node test runner environment if needed
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { dataRepository } from '../src/services/dataRepository.js';
import { UserIdentity } from '../src/services/userIdentity.js';

test('addChargingStation attaches createdByUserId from UserIdentity if omitted', async () => {
  const mockStationInput = {
    name: 'Test Charging Station',
    lat: 52.5200,
    lng: 13.4050,
    plugType: 'schuko_230v' as const,
    isWeatherproof: true,
    isFree: true,
    openingHours: '24/7',
    nearbyAmenities: ['cafe'],
    verifiedByCount: 1,
    isVerifiedBikeInfrastructure: true,
  } as any;

  const expectedUserId = UserIdentity.getUserId();
  const result = await dataRepository.addChargingStation(mockStationInput);

  assert.strictEqual(result.createdByUserId, expectedUserId);
  assert.ok(result.id.startsWith('cs-'));
  assert.ok(result.createdAt);
});

test('addChargingStation preserves explicit createdByUserId if passed', async () => {
  const mockStationInput = {
    name: 'Explicit User Station',
    lat: 52.5200,
    lng: 13.4050,
    plugType: 'schuko_230v' as const,
    isWeatherproof: true,
    isFree: true,
    openingHours: '24/7',
    nearbyAmenities: ['cafe'],
    verifiedByCount: 1,
    createdByUserId: 'custom-user-123',
    isVerifiedBikeInfrastructure: true,
  } as any;

  const result = await dataRepository.addChargingStation(mockStationInput);

  assert.strictEqual(result.createdByUserId, 'custom-user-123');
});
