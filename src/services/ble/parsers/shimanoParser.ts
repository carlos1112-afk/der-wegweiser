import type { LiveBikeTelemetry } from '../../../types/navigation';

/**
 * Shimano STEPS (EP8, EP801, EP6, E8000) & Di2 D-Fly BLE GATT Parser
 */

export const SHIMANO_DFLY_SERVICE_UUID = '0000df00-0000-1000-8000-00805f9b34fb';
export const SHIMANO_TELEMETRY_CHAR = '0000df01-0000-1000-8000-00805f9b34fb';

type ShimanoAssistMode = 'off' | 'eco' | 'tour' | 'turbo';

const SHIMANO_MODE_MAP: Record<number, ShimanoAssistMode> = {
  0: 'off',
  1: 'eco',
  2: 'tour',  // Shimano 'Trail' mode
  3: 'turbo', // Shimano 'Boost' mode
};

export function parseShimanoTelemetry(value: DataView): Partial<LiveBikeTelemetry> {
  if (value.byteLength < 3) {
    return {};
  }

  // Byte 0: Battery Percentage
  const batteryPercent = value.getUint8(0);

  // Byte 1: Di2 Current Gear (e.g. 1 - 12)
  const currentGear = value.getUint8(1);

  // Byte 2: Assist Mode
  const rawMode = value.getUint8(2);
  const motorAssistMode = SHIMANO_MODE_MAP[rawMode] || 'eco';

  const result: Partial<LiveBikeTelemetry> = {
    manufacturer: 'shimano',
    batteryPercent,
    currentGear: currentGear > 0 ? currentGear : undefined,
    motorAssistMode,
  };

  // Byte 3-4: Cadence in 0.1 RPM
  if (value.byteLength >= 5) {
    const rawCadence = value.getUint16(3, true);
    result.cadenceRpm = Math.round(rawCadence / 10);
  }

  // Byte 5-6: Speed in 0.01 km/h
  if (value.byteLength >= 7) {
    const rawSpeed = value.getUint16(5, true);
    result.speedKmH = +(rawSpeed / 100).toFixed(1);
  }

  // Byte 7-8: Rider Power in Watts
  if (value.byteLength >= 9) {
    result.riderPowerWatts = value.getUint16(7, true);
  }

  // Byte 9-10: Estimated Range (km)
  if (value.byteLength >= 11) {
    result.rangeRemainingKm = value.getUint16(9, true);
  }

  return result;
}
