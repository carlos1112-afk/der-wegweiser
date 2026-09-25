import type { LiveBikeTelemetry } from '../../../types/navigation';

/**
 * Standard Bluetooth SIG Cycling Profile Parser
 * Handles: Cycling Power (0x1818), Cycling Speed/Cadence (0x1816), Battery (0x180F)
 * Compatible with: Fazua, Mahle (partial), generic BLE cycling sensors
 */

// --- Cadence State ---
let lastCrankRevs: number | null = null;
let lastCrankTime: number | null = null;

// --- Speed State ---
let lastWheelRevs: number | null = null;
let lastWheelTime: number | null = null;

const WHEEL_CIRCUMFERENCE_M = 2.136; // 700x35c Standard E-Bike Reifen

/**
 * Physikalisch plausible Grenzwerte für ein E-Bike.
 * Ein verworfenes oder teilweise empfangenes BLE-Paket erzeugt sonst
 * Sprünge in die Tausender, die unmittelbar in Reichweitenberechnung,
 * Notfall-Akkuwarnung und Sprachausgabe einfließen.
 */
const MAX_PLAUSIBLE_SPEED_KMH = 90; // 25 m/s – deutlich über S-Pedelec-Höchstgeschwindigkeit
const MAX_PLAUSIBLE_CADENCE_RPM = 220; // Profiradler mit Last
const MAX_DELTA_SECONDS = 4; // älter = veralteter Sensorwert, neu referenzieren

/**
 * Setzt die Referenzwerte zurück. Muss beim Verbinden/Trennen aufgerufen werden,
 * damit nach einem Reconnect keine Differenz über den Verbindungszeitraum
 * entsteht (sonst 0 km/h über Stunden oder ein extremer Ausreißerwert).
 */
export function resetStandardSigState(): void {
  lastCrankRevs = null;
  lastCrankTime = null;
  lastWheelRevs = null;
  lastWheelTime = null;
}

function calculateCadence(revs: number, time: number): number {
  if (lastCrankTime === null) {
    lastCrankRevs = revs;
    lastCrankTime = time;
    return 0;
  }
  const deltaRevs = (revs - lastCrankRevs!) & 0xFFFF;
  const deltaTime = ((time - lastCrankTime) & 0xFFFF) / 1024;
  lastCrankRevs = revs;
  lastCrankTime = time;
  if (deltaTime <= 0) return 0;
  // Veraltete Werte: neu referenzieren statt 0 zu melden, was wie Stillstand wirkt.
  if (deltaTime > MAX_DELTA_SECONDS) return 0;
  const rpm = Math.round((deltaRevs / deltaTime) * 60);
  return rpm > MAX_PLAUSIBLE_CADENCE_RPM ? 0 : rpm;
}

function calculateSpeed(revs: number, time: number): number {
  if (lastWheelTime === null) {
    lastWheelRevs = revs;
    lastWheelTime = time;
    return 0;
  }
  const deltaRevs = (revs - lastWheelRevs!) & 0xFFFFFFFF;
  const deltaTime = ((time - lastWheelTime) & 0xFFFF) / 1024;
  lastWheelRevs = revs;
  lastWheelTime = time;
  if (deltaTime <= 0) return 0;
  if (deltaTime > MAX_DELTA_SECONDS) return 0;
  const speedMs = (deltaRevs * WHEEL_CIRCUMFERENCE_M) / deltaTime;
  const speedKmH = speedMs * 3.6;
  if (speedKmH > MAX_PLAUSIBLE_SPEED_KMH) return 0;
  return +speedKmH.toFixed(1);
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
