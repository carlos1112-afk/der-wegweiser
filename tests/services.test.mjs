import test from 'node:test';
import assert from 'node:assert';
import { RoutingService } from '../src/services/routingService.ts';
import { WeatherService } from '../src/services/weatherService.ts';
import { ConsentService } from '../src/services/consentService.ts';

test('Legacy routing returns no circle, OSRM route, direct line or paid stub', async () => {
  ConsentService.save({ essential: true, analytics: false, surveys: false, personalizedAds: false });
  let calls = 0;
  const fetch = async () => { calls++; throw new Error('must not fetch'); };
  await assert.rejects(RoutingService.generateBikeRoute({ startLat: 52.52, startLng: 13.4, batteryPercent: 0, bikeType: 'ebike' }, {}, fetch), { code: 'PREMIUM_UNAVAILABLE' });
  for (const mode of ['premium', 'offline']) {
    await assert.rejects(RoutingService.generateDestinationRoute({ lat: 52.52, lng: 13.4 }, { lat: 52.53, lng: 13.4 }, {}, { mode }, fetch));
  }
  assert.equal(calls, 0);
});

test('WeatherService honest degradation when offline', async () => {
  ConsentService.save({ essential: true, analytics: true, surveys: false, personalizedAds: false });
  ConsentService.save({ essential: true, analytics: true, surveys: false, personalizedAds: false });
  // Mock fetch to simulate network error
  const mockFetch = async () => {
    throw new TypeError('fetch failed');
  };

  // Assert that it strictly rejects with the honest-degradation error when weather is unavailable
  await assert.rejects(
    async () => {
      await WeatherService.getWeatherForLocation(52.52, 13.40, mockFetch);
    },
    {
      name: 'Error',
      message: '[WeatherService] Live weather integration unavailable; no fallback is permitted.'
    }
  );
});

test('RoutingService rejects outbound calls when consent is withdrawn (CWE-359 Fix)', async () => {
  ConsentService.withdraw();
  let fetchCalled = false;
  const mockFetch = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({}) };
  };

  await assert.rejects(
    async () => {
      await RoutingService.generateBikeRoute(
        { startLat: 52.52, startLng: 13.4, batteryPercent: 80, bikeType: 'ebike' },
        { batteryCapacityWh: 500, maxElevationSlopePercent: 10 },
        mockFetch
      );
    },
    {
      code: 'CONSENT_REQUIRED'
    }
  );

  assert.equal(fetchCalled, false);
});
