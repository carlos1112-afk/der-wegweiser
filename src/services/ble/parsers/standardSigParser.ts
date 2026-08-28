import type { LiveBikeTelemetry } from '../../../types/navigation';

/**
 * Standard Bluetooth SIG Cycling Profile Parser
 * Handles: Cycling Power (0x1818), Cycling Speed/Cadence (0x1816), Battery (0x180F)
 * Compatible with: Fazua, Mahle (partial), generic BLE cycling sensors
 */

// --- Cadence State ---
let lastCrankRevs = 0;
let lastCrankTime = 0;

// --- Speed State ---
let lastWheelRevs = 0;
let lastWheelTime = 0;

const WHEEL_CIRCUMFERENCE_M = 2.136; // 700x35c Standard E-Bike Reifen

function calculateCadence(revs: number, time: number): number {
  if (lastCrankTime === 0) {
    lastCrankRevs = revs;
    lastCrankTime = time;
    return 0;
  }
  const deltaRevs = (revs - lastCrankRevs) & 0xFFFF;
  const deltaTime = ((time - lastCrankTime) & 0xFFFF) / 1024;
  lastCrankRevs = revs;
  lastCrankTime = time;
  if (deltaTime <= 0) return 0;
  return Math.round((deltaRevs / deltaTime) * 60);
}

function calculateSpeed(revs: number, time: number): number {
  if (lastWheelTime === 0) {
    lastWheelRevs = revs;
    lastWheelTime = time;
    return 0;
  }
  const deltaRevs = (revs - lastWheelRevs) & 0xFFFFFFFF;
  const deltaTime = ((time - lastWheelTime) & 0xFFFF) / 1024;
  lastWheelRevs = revs;
  lastWheelTime = time;
  if (deltaTime <= 0) return 0;
  const speedMs = (deltaRevs * WHEEL_CIRCUMFERENCE_M) / deltaTime;
  return +(speedMs * 3.6).toFixed(1);
}

export function parsePowerMeasurement(value: DataView): Partial<LiveBikeTelemetry> {
  const flags = value.getUint16(0, true);
  const riderPowerWatts = value.getInt16(2, true);

  const result: Partial<LiveBikeTelemetry> = { riderPowerWatts };

  let offset = 4;

  // Bit 0: Pedal Power Balance Present
  if (flags & 0x01) offset += 1;
  // Bit 1: Pedal Power Balance Reference
  // Bit 2: Accumulated Torque Present
  if (flags & 0x04) offset += 2;
  // Bit 4: Wheel Revolution Data Present
  if (flags & 0x10) {
    const wheelRevs = value.getUint32(offset, true);
    const wheelTime = value.getUint16(offset + 4, true);
    result.speedKmH = calculateSpeed(wheelRevs, wheelTime);
    offset += 6;
  }
  // Bit 5: Crank Revolution Data Present
  if (flags & 0x20) {
    const crankRevs = value.getUint16(offset, true);
    const crankTime = value.getUint16(offset + 2, true);
    result.cadenceRpm = calculateCadence(crankRevs, crankTime);
  }

  return result;
}

export function parseCscMeasurement(value: DataView): Partial<LiveBikeTelemetry> {
  const flags = value.getUint8(0);
  const result: Partial<LiveBikeTelemetry> = {};
  let offset = 1;

  // Bit 0: Wheel Revolution Data Present
  if (flags & 0x01) {
    const wheelRevs = value.getUint32(offset, true);
    const wheelTime = value.getUint16(offset + 4, true);
    result.speedKmH = calculateSpeed(wheelRevs, wheelTime);
    offset += 6;
  }
  // Bit 1: Crank Revolution Data Present
  if (flags & 0x02) {
    const crankRevs = value.getUint16(offset, true);
    const crankTime = value.getUint16(offset + 2, true);
    result.cadenceRpm = calculateCadence(crankRevs, crankTime);
  }

  return result;
}

export function parseBatteryLevel(value: DataView): Partial<LiveBikeTelemetry> {
  return { batteryPercent: value.getUint8(0) };
}
