import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GpxRecorderService } from '../src/services/gpxRecorderService.ts';
import type { LiveBikeTelemetry } from '../src/types/navigation.ts';

const dummyTelemetry: LiveBikeTelemetry = {
  speedKmH: 22.5,
  batteryPercent: 95,
  assistLevel: 'Tour',
  estimatedRangeKm: 65,
  motorPowerWatts: 180,
  riderPowerWatts: 120,
  cadenceRpm: 75,
  isConnected: true,
};

describe('GpxRecorderService', () => {
  it('should start recording and record points when moving', () => {
    GpxRecorderService.startRecording(100);
    const statusBefore = GpxRecorderService.getStatus();
    assert.equal(statusBefore.isRecording, true);
    assert.equal(statusBefore.isPaused, false);
    assert.equal(statusBefore.pointsCount, 0);

    // Add moving point (speed: 5 m/s = 18 km/h)
    GpxRecorderService.addPoint({ lat: 52.52, lng: 13.405, speed: 5 }, dummyTelemetry);
    const statusAfter = GpxRecorderService.getStatus();
    assert.equal(statusAfter.pointsCount, 1);
  });

  it('should auto-pause after 5 seconds of standing still (< 1.5 km/h)', () => {
    GpxRecorderService.startRecording(100);

    // 1st point moving
    GpxRecorderService.addPoint({ lat: 52.52, lng: 13.405, speed: 5 }, dummyTelemetry);
    assert.equal(GpxRecorderService.getStatus().isPaused, false);

    // Add 4 points standing still (speed 0)
    for (let i = 0; i < 4; i++) {
      GpxRecorderService.addPoint({ lat: 52.52, lng: 13.405, speed: 0 }, dummyTelemetry);
      assert.equal(GpxRecorderService.getStatus().isPaused, false, `Should not be paused on idle second ${i + 1}`);
    }

    // 5th point standing still -> triggers auto pause
    GpxRecorderService.addPoint({ lat: 52.52, lng: 13.405, speed: 0 }, dummyTelemetry);
    assert.equal(GpxRecorderService.getStatus().isPaused, true, 'Should auto-pause on 5th idle second');
  });

  it('should auto-resume when movement resumes (>= 1.5 km/h)', () => {
    GpxRecorderService.startRecording(100);

    // Trigger auto pause by sending 5 stationary points
    for (let i = 0; i < 5; i++) {
      GpxRecorderService.addPoint({ lat: 52.52, lng: 13.405, speed: 0 }, dummyTelemetry);
    }
    assert.equal(GpxRecorderService.getStatus().isPaused, true);

    // Moving point (10 km/h = ~2.77 m/s)
    GpxRecorderService.addPoint({ lat: 52.521, lng: 13.406, speed: 2.77 }, dummyTelemetry);
    assert.equal(GpxRecorderService.getStatus().isPaused, false, 'Should auto-resume when speed >= 1.5 km/h');
  });

  it('should stop recording and return a summary with valid GPX XML', () => {
    GpxRecorderService.startRecording(100);
    GpxRecorderService.addPoint({ lat: 52.52, lng: 13.405, speed: 5 }, { ...dummyTelemetry, batteryPercent: 95 });
    GpxRecorderService.addPoint({ lat: 52.521, lng: 13.406, speed: 5 }, { ...dummyTelemetry, batteryPercent: 90 });

    const summary = GpxRecorderService.stopRecording();
    assert.equal(summary.trackPointsCount, 2);
    assert.equal(summary.gpxXmlString.includes('<?xml version="1.0"'), true);
    assert.equal(summary.gpxXmlString.includes('<gpx version="1.1"'), true);
    assert.equal(GpxRecorderService.getStatus().isRecording, false);
  });
});
