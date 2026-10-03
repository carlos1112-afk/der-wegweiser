import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WeatherService } from '../src/services/weatherService.js';

describe('WeatherService.degreesToCompass', () => {
  it('maps standard 16 cardinal and intercardinal midpoint angles correctly', () => {
    const expectedMappings: Array<[number, string]> = [
      [0, 'N'],
      [22.5, 'NNO'],
      [45, 'NO'],
      [67.5, 'ONO'],
      [90, 'O'],
      [112.5, 'OSO'],
      [135, 'SO'],
      [157.5, 'SSO'],
      [180, 'S'],
      [202.5, 'SSW'],
      [225, 'SW'],
      [247.5, 'WSW'],
      [270, 'W'],
      [292.5, 'WNW'],
      [315, 'NW'],
      [337.5, 'NNW'],
    ];

    for (const [deg, expected] of expectedMappings) {
      assert.strictEqual(
        WeatherService.degreesToCompass(deg),
        expected,
        `Expected ${deg}° to map to ${expected}`
      );
    }
  });

  it('handles boundary transitions between adjacent compass sectors', () => {
    // Sector N is 348.75° to 11.25°
    assert.strictEqual(WeatherService.degreesToCompass(11.24), 'N');
    assert.strictEqual(WeatherService.degreesToCompass(11.25), 'NNO');

    // Sector NNO is 11.25° to 33.75°
    assert.strictEqual(WeatherService.degreesToCompass(33.74), 'NNO');
    assert.strictEqual(WeatherService.degreesToCompass(33.75), 'NO');

    // Sector NNW to N transition
    assert.strictEqual(WeatherService.degreesToCompass(348.74), 'NNW');
    assert.strictEqual(WeatherService.degreesToCompass(348.75), 'N');
  });

  it('handles angles equal to or greater than 360 degrees', () => {
    assert.strictEqual(WeatherService.degreesToCompass(360), 'N');
    assert.strictEqual(WeatherService.degreesToCompass(371.25), 'NNO');
    assert.strictEqual(WeatherService.degreesToCompass(450), 'O');
    assert.strictEqual(WeatherService.degreesToCompass(720), 'N');
    assert.strictEqual(WeatherService.degreesToCompass(1080), 'N');
  });

  it('handles negative degree inputs correctly', () => {
    assert.strictEqual(WeatherService.degreesToCompass(-11.25), 'N');
    assert.strictEqual(WeatherService.degreesToCompass(-11.26), 'NNW');
    assert.strictEqual(WeatherService.degreesToCompass(-22.5), 'NNW');
    assert.strictEqual(WeatherService.degreesToCompass(-90), 'W');
    assert.strictEqual(WeatherService.degreesToCompass(-180), 'S');
    assert.strictEqual(WeatherService.degreesToCompass(-360), 'N');
  });

  it('handles floating point and edge decimal numbers', () => {
    assert.strictEqual(WeatherService.degreesToCompass(0.0), 'N');
    assert.strictEqual(WeatherService.degreesToCompass(180.0), 'S');
    assert.strictEqual(WeatherService.degreesToCompass(359.9), 'N');
  });
});
