import test from 'node:test';
import assert from 'node:assert/strict';
import { WeatherService } from '../src/services/weatherService.ts';

test('WeatherService - Error Path: Network rejection / fetch error exercises catch block and throws unavailable error', async () => {
  const mockFetch: typeof fetch = async () => {
    throw new Error('Network failure (DNS lookup failed)');
  };

  await assert.rejects(
    async () => {
      await WeatherService.getWeatherForLocation(52.52, 13.40, mockFetch);
    },
    (err: Error) => {
      assert.strictEqual(
        err.message,
        '[WeatherService] Live weather integration unavailable; no fallback is permitted.'
      );
      return true;
    }
  );
});

test('WeatherService - Error Path: Global fetch rejection exercises catch block and throws unavailable error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Offline mode simulation');
  };

  try {
    await assert.rejects(
      async () => {
        await WeatherService.getWeatherForLocation(52.52, 13.40);
      },
      (err: Error) => {
        assert.strictEqual(
          err.message,
          '[WeatherService] Live weather integration unavailable; no fallback is permitted.'
        );
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WeatherService - Error Path: Non-ok HTTP status (e.g. 500) on all endpoints throws unavailable error', async () => {
  const mockFetch: typeof fetch = async () => {
    return {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    } as Response;
  };

  await assert.rejects(
    async () => {
      await WeatherService.getWeatherForLocation(52.52, 13.40, mockFetch);
    },
    (err: Error) => {
      assert.strictEqual(
        err.message,
        '[WeatherService] Live weather integration unavailable; no fallback is permitted.'
      );
      return true;
    }
  );
});

test('WeatherService - Error Path: Malformed JSON response triggers catch block and throws unavailable error', async () => {
  const mockFetch: typeof fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    } as Response;
  };

  await assert.rejects(
    async () => {
      await WeatherService.getWeatherForLocation(52.52, 13.40, mockFetch);
    },
    (err: Error) => {
      assert.strictEqual(
        err.message,
        '[WeatherService] Live weather integration unavailable; no fallback is permitted.'
      );
      return true;
    }
  );
});

test('WeatherService - Error Path: Missing required weather temperature field in JSON throws unavailable error', async () => {
  const mockFetch: typeof fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        current_weather: {
          windspeed: 10,
          winddirection: 180,
          // temperature is missing
        },
      }),
    } as Response;
  };

  await assert.rejects(
    async () => {
      await WeatherService.getWeatherForLocation(52.52, 13.40, mockFetch);
    },
    (err: Error) => {
      assert.strictEqual(
        err.message,
        '[WeatherService] Live weather integration unavailable; no fallback is permitted.'
      );
      return true;
    }
  );
});

test('WeatherService - Happy Path: Successfully parses standard Open-Meteo response', async () => {
  const mockFetch: typeof fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        current_weather: {
          temperature: 21.4,
          windspeed: 12.1,
          winddirection: 180,
          weathercode: 1,
        },
      }),
    } as Response;
  };

  const weather = await WeatherService.getWeatherForLocation(52.52, 13.40, mockFetch);

  assert.strictEqual(weather.temperatureC, 21);
  assert.strictEqual(weather.windSpeedKmH, 12);
  assert.strictEqual(weather.windDirectionDeg, 180);
  assert.strictEqual(weather.windDirectionCompass, 'S');
  assert.strictEqual(weather.isHeadwindRisk, false);
  assert.strictEqual(weather.weatherCondition, 'clear');
  assert.strictEqual(weather.weatherDescription, 'Sonnig & Trocken');
  assert.strictEqual(weather.batteryPenaltyPercent, 0);
  assert.strictEqual(weather.weatherStatus, 'live_station');
  assert.strictEqual(weather.rangeConfidence, 'high');
});

test('WeatherService - Happy Path: Correctly calculates cold (<10°C) and headwind (>20km/h) battery penalty', async () => {
  const mockFetch: typeof fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        current_weather: {
          temperature: 4.8,
          windspeed: 24.5,
          winddirection: 270,
          weathercode: 61,
        },
      }),
    } as Response;
  };

  const weather = await WeatherService.getWeatherForLocation(52.52, 13.40, mockFetch);

  assert.strictEqual(weather.temperatureC, 5);
  assert.strictEqual(weather.windSpeedKmH, 25);
  assert.strictEqual(weather.windDirectionCompass, 'W');
  assert.strictEqual(weather.isHeadwindRisk, true); // windspeed > 18
  assert.strictEqual(weather.weatherCondition, 'rain'); // weathercode > 50
  assert.strictEqual(weather.weatherDescription, 'Regenschauer');
  assert.strictEqual(weather.batteryPenaltyPercent, 22); // +10 for cold (<10) + +12 for wind (>20)
});

test('WeatherService - Fallback Path: Falls back from failed proxy URL to direct public endpoint', async () => {
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };

  try {
    let callCount = 0;
    const mockFetch: typeof fetch = async (url) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('/api/weather')) {
        return { ok: false, status: 502 } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          current_weather: {
            temperature: 19.0,
            windspeed: 8.0,
            winddirection: 90,
            weathercode: 0,
          },
        }),
      } as Response;
    };

    const weather = await WeatherService.getWeatherForLocation(52.52, 13.40, mockFetch);

    assert.strictEqual(callCount, 2);
    assert.strictEqual(weather.temperatureC, 19);
    assert.strictEqual(weather.windDirectionCompass, 'O');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('WeatherService - Legacy/Custom backend structure: Correctly parses data.weather payload', async () => {
  const mockFetch: typeof fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        weather: {
          temperature: 15.0,
          wind_speed: 10.0,
          wind_direction: 45,
          condition: 'clear',
        },
      }),
    } as Response;
  };

  const weather = await WeatherService.getWeatherForLocation(52.52, 13.40, mockFetch);

  assert.strictEqual(weather.temperatureC, 15);
  assert.strictEqual(weather.windSpeedKmH, 10);
  assert.strictEqual(weather.windDirectionCompass, 'NO');
  assert.strictEqual(weather.weatherCondition, 'clear');
});
