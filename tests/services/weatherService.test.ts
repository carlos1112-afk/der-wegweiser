import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { WeatherService, WeatherData } from '../../src/services/weatherService.js';

describe('WeatherService', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  let originalEnvUrl: string | undefined;

  beforeEach(() => {
    if (!(import.meta as any).env) {
      (import.meta as any).env = {};
    }
    originalEnvUrl = process.env.VITE_WEATHER_PROVIDER_URL || (import.meta as any).env.VITE_WEATHER_PROVIDER_URL;
    delete process.env.VITE_WEATHER_PROVIDER_URL;
    delete (import.meta as any).env.VITE_WEATHER_PROVIDER_URL;
    (globalThis as any).window = undefined;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
    if (originalEnvUrl !== undefined) {
      process.env.VITE_WEATHER_PROVIDER_URL = originalEnvUrl;
      (import.meta as any).env.VITE_WEATHER_PROVIDER_URL = originalEnvUrl;
    } else {
      delete process.env.VITE_WEATHER_PROVIDER_URL;
      delete (import.meta as any).env.VITE_WEATHER_PROVIDER_URL;
    }
  });

  it('successfully fetches and processes weather data with standard Open-Meteo format', async () => {
    const fetchedUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlString = url.toString();
      fetchedUrls.push(urlString);
      return new Response(
        JSON.stringify({
          current_weather: {
            temperature: 22.4,
            windspeed: 12.3,
            winddirection: 180,
            weathercode: 0,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const weather = await WeatherService.getWeatherForLocation(48.1371, 11.5754);

    assert.equal(fetchedUrls.length, 1);
    assert.equal(
      fetchedUrls[0],
      'https://api.open-meteo.com/v1/forecast?latitude=48.1371&longitude=11.5754&current_weather=true'
    );
    assert.deepEqual(weather, {
      temperatureC: 22,
      windSpeedKmH: 12,
      windDirectionDeg: 180,
      windDirectionCompass: 'S',
      isHeadwindRisk: false,
      weatherCondition: 'clear',
      weatherDescription: 'Sonnig & Trocken',
      batteryPenaltyPercent: 0,
      weatherStatus: 'live_station',
      rangeConfidence: 'high',
    });
  });

  it('correctly calculates battery penalties and headwind risk', async () => {
    const cases = [
      {
        temp: 5,
        wind: 10,
        expectedPenalty: 10, // Cold penalty (+10) only
        expectedHeadwindRisk: false,
      },
      {
        temp: 15,
        wind: 25,
        expectedPenalty: 12, // Wind penalty (+12) only
        expectedHeadwindRisk: true,
      },
      {
        temp: -2,
        wind: 30,
        expectedPenalty: 22, // Cold (+10) + Wind (+12)
        expectedHeadwindRisk: true,
      },
      {
        temp: 10, // Boundary: not < 10
        wind: 20, // Boundary: not > 20
        expectedPenalty: 0,
        expectedHeadwindRisk: true, // wind 20 > 18
      },
      {
        temp: 12,
        wind: 18, // Boundary: not > 18
        expectedPenalty: 0,
        expectedHeadwindRisk: false,
      },
      {
        temp: 12,
        wind: 19, // > 18
        expectedPenalty: 0,
        expectedHeadwindRisk: true,
      },
    ];

    for (const c of cases) {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            current_weather: {
              temperature: c.temp,
              windspeed: c.wind,
              winddirection: 90,
              weathercode: 0,
            },
          }),
          { status: 200 }
        );
      }) as typeof fetch;

      const result = await WeatherService.getWeatherForLocation(50, 10);
      assert.equal(
        result.batteryPenaltyPercent,
        c.expectedPenalty,
        `Expected penalty ${c.expectedPenalty} for temp=${c.temp}, wind=${c.wind}`
      );
      assert.equal(
        result.isHeadwindRisk,
        c.expectedHeadwindRisk,
        `Expected isHeadwindRisk ${c.expectedHeadwindRisk} for wind=${c.wind}`
      );
    }
  });

  it('correctly classifies weather conditions based on weathercode (> 50 is rain)', async () => {
    const rainResponse = {
      current_weather: {
        temperature: 15,
        windspeed: 5,
        winddirection: 0,
        weathercode: 61,
      },
    };

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify(rainResponse), { status: 200 });
    }) as typeof fetch;

    const weather = await WeatherService.getWeatherForLocation(50, 10);
    assert.equal(weather.weatherCondition, 'rain');
    assert.equal(weather.weatherDescription, 'Regenschauer');
  });

  it('supports alternative response payload format (data.weather)', async () => {
    const altResponse = {
      weather: {
        temperature: 18.7,
        wind_speed: 14,
        wind_direction: 270,
        condition: 'rain',
      },
    };

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify(altResponse), { status: 200 });
    }) as typeof fetch;

    const weather = await WeatherService.getWeatherForLocation(50, 10);
    assert.equal(weather.temperatureC, 19);
    assert.equal(weather.windSpeedKmH, 14);
    assert.equal(weather.windDirectionCompass, 'W');
    assert.equal(weather.weatherCondition, 'rain');
    assert.equal(weather.weatherDescription, 'Regenschauer');
  });

  it('converts wind direction degrees to compass directions accurately', async () => {
    const directions = [
      { deg: 0, compass: 'N' },
      { deg: 22.5, compass: 'NNO' },
      { deg: 45, compass: 'NO' },
      { deg: 90, compass: 'O' },
      { deg: 135, compass: 'SO' },
      { deg: 180, compass: 'S' },
      { deg: 225, compass: 'SW' },
      { deg: 270, compass: 'W' },
      { deg: 315, compass: 'NW' },
      { deg: 360, compass: 'N' },
    ];

    for (const item of directions) {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            current_weather: {
              temperature: 20,
              windspeed: 10,
              winddirection: item.deg,
              weathercode: 0,
            },
          }),
          { status: 200 }
        );
      }) as typeof fetch;

      const result = await WeatherService.getWeatherForLocation(50, 10);
      assert.equal(
        result.windDirectionCompass,
        item.compass,
        `Expected deg ${item.deg} to map to ${item.compass}`
      );
    }
  });

  it('uses VITE_WEATHER_PROVIDER_URL custom endpoint when provided', async () => {
    process.env.VITE_WEATHER_PROVIDER_URL = 'https://custom-weather.service/api';

    const fetchedUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      fetchedUrls.push(url.toString());
      return new Response(
        JSON.stringify({
          current_weather: {
            temperature: 20,
            windspeed: 5,
            winddirection: 0,
            weathercode: 0,
          },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    await WeatherService.getWeatherForLocation(52.52, 13.405);
    assert.equal(
      fetchedUrls[0],
      'https://custom-weather.service/api?latitude=52.52&longitude=13.405'
    );
  });

  it('uses backend proxy when window is defined and custom endpoint is not configured', async () => {
    (globalThis as any).window = {
      location: { origin: 'https://app.der-wegweiser.de' },
    };

    const fetchedUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      fetchedUrls.push(url.toString());
      return new Response(
        JSON.stringify({
          current_weather: {
            temperature: 20,
            windspeed: 5,
            winddirection: 0,
            weathercode: 0,
          },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    await WeatherService.getWeatherForLocation(52.52, 13.405);
    assert.equal(
      fetchedUrls[0],
      'https://app.der-wegweiser.de/api/weather?latitude=52.52&longitude=13.405'
    );
  });

  it('falls back to direct Open-Meteo endpoint if primary endpoint fetch fails or returns non-ok', async () => {
    (globalThis as any).window = {
      location: { origin: 'https://app.der-wegweiser.de' },
    };

    const fetchedUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      fetchedUrls.push(urlStr);

      if (urlStr.includes('/api/weather')) {
        // Proxy fails
        return new Response('Internal Server Error', { status: 500 });
      }

      // Fallback direct url succeeds
      return new Response(
        JSON.stringify({
          current_weather: {
            temperature: 16,
            windspeed: 8,
            winddirection: 45,
            weathercode: 0,
          },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const weather = await WeatherService.getWeatherForLocation(50, 10);

    assert.equal(fetchedUrls.length, 2);
    assert.equal(fetchedUrls[0], 'https://app.der-wegweiser.de/api/weather?latitude=50&longitude=10');
    assert.equal(
      fetchedUrls[1],
      'https://api.open-meteo.com/v1/forecast?latitude=50&longitude=10&current_weather=true'
    );
    assert.equal(weather.temperatureC, 16);
  });

  it('falls back to direct Open-Meteo endpoint if primary fetch throws a network exception', async () => {
    process.env.VITE_WEATHER_PROVIDER_URL = 'https://custom-weather.invalid';

    const fetchedUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      fetchedUrls.push(urlStr);

      if (urlStr.includes('custom-weather')) {
        throw new Error('Network Rejection');
      }

      return new Response(
        JSON.stringify({
          current_weather: {
            temperature: 25,
            windspeed: 10,
            winddirection: 0,
            weathercode: 0,
          },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const weather = await WeatherService.getWeatherForLocation(50, 10);
    assert.equal(fetchedUrls.length, 2);
    assert.equal(weather.temperatureC, 25);
  });

  it('throws explicit error when all fetch attempts fail', async () => {
    globalThis.fetch = (async () => {
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await WeatherService.getWeatherForLocation(50, 10);
      },
      {
        name: 'Error',
        message: '[WeatherService] Live weather integration unavailable; no fallback is permitted.',
      }
    );
  });

  it('throws explicit error when response payload missing temperature data', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ unexpectedKey: 123 }), { status: 200 });
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await WeatherService.getWeatherForLocation(50, 10);
      },
      {
        name: 'Error',
        message: '[WeatherService] Live weather integration unavailable; no fallback is permitted.',
      }
    );
  });
});
