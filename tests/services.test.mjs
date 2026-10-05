import test from 'node:test';
import assert from 'node:assert';
import { RoutingService } from '../src/services/routingService.ts';
import { ElevationService } from '../src/services/elevationService.ts';
import { WeatherService } from '../src/services/weatherService.ts';

test('RoutingService requests a supported BRouter profile', async () => {
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

test('WeatherService honest degradation when offline', async () => {
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
