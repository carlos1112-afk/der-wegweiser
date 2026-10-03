import test from 'node:test';
import assert from 'node:assert';
import { RoutingService } from '../src/services/routingService.ts';
import { WeatherService } from '../src/services/weatherService.ts';

test('RoutingService honest degradation when offline', async () => {
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

  // Assert that it strictly rejects with the honest-degradation error when BRouter is unavailable
  await assert.rejects(
    async () => {
      await RoutingService.generateBikeRoute(params, userPrefs, mockFetch);
    },
    {
      name: 'Error',
      message: '[RoutingService] Live BRouter integration unavailable; no geometric fallback is permitted.'
    }
  );
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
