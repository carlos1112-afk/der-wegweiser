import test from 'node:test';
import assert from 'node:assert';
import { RoutingService } from '../src/services/routingService.ts';
import { ElevationService } from '../src/services/elevationService.ts';
import { WeatherService } from '../src/services/weatherService.ts';
import { ConsentService } from '../src/services/consentService.ts';

test('RoutingService requests a supported BRouter profile', async () => {
  ConsentService.save({ essential: true, analytics: true, surveys: false, personalizedAds: false });
  let requestedUrl;
  const coordinates = Array.from({ length: 6 }, (_, index) => [13.4 + index * 0.001, 52.52 + index * 0.001]);
  const mockFetch = async (url) => {
    requestedUrl = new URL(url);
    return {
      ok: true,
      json: async () => ({
        features: [{
          geometry: { coordinates },
          properties: { 'track-length': '5000' }
        }]
      })
    };
  };
  const originalGetElevations = ElevationService.getElevations;
  ElevationService.getElevations = async (coords) => coords.map(() => 0);

  try {
    const route = await RoutingService.generateBikeRoute(
      {
        startLat: 52.52,
        startLng: 13.4,
        batteryPercent: 80,
        bikeType: 'ebike',
      },
      { batteryCapacityWh: 500, maxElevationSlopePercent: 10 },
      mockFetch
    );

    assert.equal(requestedUrl.searchParams.get('profile'), 'trekking');
    assert.equal(route.routingEngineStatus, 'online_brouter');
    assert.equal(route.isRoadSnapped, true);
    assert.equal(route.pathCoordinates.length, coordinates.length);
  } finally {
    ElevationService.getElevations = originalGetElevations;
  }
});

test('RoutingService marks its fallback corridor as unverified when offline', async () => {
  ConsentService.save({ essential: true, analytics: true, surveys: false, personalizedAds: false });
  // Mock fetch to simulate network error or offline
  const mockFetch = async () => {
    throw new TypeError('fetch failed');
  };

  const params = {
    startLat: 52.52,
    startLng: 13.40,
    batteryPercent: 80,
    bikeType: 'ebike',
    targetDistanceKm: 28
  };
  const userPrefs = {
    batteryCapacityWh: 500,
    maxElevationSlopePercent: 10
  };
  const originalGetElevations = ElevationService.getElevations;
  ElevationService.getElevations = async (coords) => coords.map(() => 0);

  try {
    const route = await RoutingService.generateBikeRoute(params, userPrefs, mockFetch);
    assert.equal(route.isRoadSnapped, false);
    assert.equal(route.routingEngineStatus, 'offline_corridor_unverified');
    assert.equal(route.isOfflineFallbackCorridor, true);
    assert.equal(route.pathCoordinates.length, 33);
  } finally {
    ElevationService.getElevations = originalGetElevations;
  }
});

test('RoutingService creates a real point-to-point BRouter route for a selected destination', async () => {
  ConsentService.save({ essential: true, analytics: true, surveys: false, personalizedAds: false });
  let requestedUrl;
  const mockFetch = async (url) => {
    requestedUrl = new URL(url);
    return {
      ok: true,
      json: async () => ({
        features: [{ geometry: { coordinates: [[13.4, 52.5], [13.45, 52.55], [13.5, 52.6]] }, properties: { 'track-length': '14500' } }]
      })
    };
  };
  const originalGetElevations = ElevationService.getElevations;
  ElevationService.getElevations = async (coords) => coords.map(() => 0);
  try {
    const route = await RoutingService.generateDestinationRoute(
      { lat: 52.5, lng: 13.4 },
      { lat: 52.6, lng: 13.5 },
      { batteryCapacityWh: 500, batteryCurrentPercent: 80, bikeType: 'ebike', preferredSurface: 'asphalt', avoidSteepHills: true },
      { mode: 'premium', destinationName: 'Testziel' },
      mockFetch
    );
    assert.equal(requestedUrl.searchParams.get('profile'), 'trekking');
    assert.equal(requestedUrl.searchParams.get('lonlats'), '13.4,52.5|13.5,52.6');
    assert.equal(route.isRoadSnapped, true);
    assert.equal(route.routingEngineStatus, 'online_brouter');
    assert.deepEqual(route.pathCoordinates.at(-1), [52.6, 13.5]);
    assert.equal(route.distanceKm, 14.5);
  } finally {
    ElevationService.getElevations = originalGetElevations;
  }
});

test('offline destination generation makes no network request and labels the line unverified', async () => {
  ConsentService.save({ essential: true, analytics: true, surveys: false, personalizedAds: false });
  let fetchCalled = false;
  const route = await RoutingService.generateDestinationRoute(
    { lat: 52.5, lng: 13.4 },
    { lat: 52.6, lng: 13.5 },
    { batteryCapacityWh: 500, batteryCurrentPercent: 80, bikeType: 'ebike', preferredSurface: 'any', avoidSteepHills: false },
    { mode: 'offline', destinationName: 'Testziel' },
    async () => { fetchCalled = true; throw new Error('offline mode must not fetch'); }
  );
  assert.equal(fetchCalled, false);
  assert.equal(route.isRoadSnapped, false);
  assert.equal(route.routingEngineStatus, 'offline_corridor_unverified');
  assert.deepEqual(route.pathCoordinates[0], [52.5, 13.4]);
  assert.deepEqual(route.pathCoordinates.at(-1), [52.6, 13.5]);
  assert.match(route.aiStory, /keine befahrbare Navigation/i);
});

test('WeatherService honest degradation when offline', async () => {
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
      name: 'Error',
      message: 'Einwilligung zur Standortverarbeitung liegt nicht vor (Art. 6/7 DSGVO).'
    }
  );

  assert.equal(fetchCalled, false);
});
