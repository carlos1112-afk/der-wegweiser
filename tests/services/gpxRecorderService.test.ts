import { beforeEach, describe, expect, it } from 'vitest';
import { GpxRecorderService } from '../../src/services/gpxRecorderService';
import type { LiveBikeTelemetry } from '../../src/types/navigation';

const telemetry: LiveBikeTelemetry = {
  isConnected: true,
  batteryPercent: 80,
  batteryWhRemaining: 500,
  batteryKnown: true,
  speedKmH: 0,
  cadenceRpm: 0,
  riderPowerWatts: 0,
  motorPowerWatts: 0,
  motorAssistMode: 'off',
};

function addPoint(index: number, speedMps = 5): void {
  GpxRecorderService.addPoint(
    { lat: 52.5 + index * 0.001, lng: 13.4, altitude: 45, speed: speedMps },
    telemetry
  );
}

describe('GpxRecorderService pause controls', () => {
  beforeEach(() => {
    GpxRecorderService.startRecording(80);
  });

  it('never records points while manually paused, even when speed telemetry resumes', () => {
    addPoint(0);
    GpxRecorderService.pauseRecording();

    addPoint(1, 12);
    addPoint(2, 12);

    const status = GpxRecorderService.getStatus();
    expect(status.isPaused).toBe(true);
    expect(status.isManualPaused).toBe(true);
    expect(status.pointsCount).toBe(1);
  });

  it('clears manual pause only through an explicit resume action', () => {
    GpxRecorderService.pauseRecording();
    addPoint(0, 12);
    expect(GpxRecorderService.getStatus().pointsCount).toBe(0);

    GpxRecorderService.resumeRecording();
    addPoint(1, 12);

    const status = GpxRecorderService.getStatus();
    expect(status.isManualPaused).toBe(false);
    expect(status.isPaused).toBe(false);
    expect(status.pointsCount).toBe(1);
  });

  it('allows moving telemetry to clear only the automatic idle pause', () => {
    for (let i = 0; i < 5; i++) addPoint(i, 0);
    expect(GpxRecorderService.getStatus().isAutoPaused).toBe(true);

    addPoint(5, 12);

    const status = GpxRecorderService.getStatus();
    expect(status.isAutoPaused).toBe(false);
    expect(status.pointsCount).toBe(5);
  });
});
