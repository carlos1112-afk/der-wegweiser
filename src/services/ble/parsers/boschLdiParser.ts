import type { LiveBikeTelemetry } from '../../../types/navigation';

/**
 * Bosch eBike Systems (BES3 Smart System / Diagnostic Service) BLE GATT Parser
 */

export const BOSCH_DIAGNOSTIC_SERVICE_UUID = '0000fe59-0000-1000-8000-00805f9b34fb';
export const BOSCH_LDI_TELEMETRY_CHAR = '00000001-0000-1000-8000-00805f9b34fb';

const BOSCH_MODE_MAP: Record<number, LiveBikeTelemetry['motorAssistMode']> = {
  0: 'off',
  1: 'eco',
  2: 'tour',
  3: 'auto', // eMTB / Auto mode
  4: 'turbo',
};

export function parseBoschLdiTelemetry(value: DataView): Partial<LiveBikeTelemetry> {
  if (value.byteLength < 4) {
    return {};
  }

  // Byte 0: Battery SoC %
  const batteryPercent = value.getUint8(0);

  // Byte 1-2: Battery Wh
  const batteryWhRemaining = value.byteLength >= 3 ? value.getUint16(1, true) : undefined;

  // Byte 3: Battery Health Percent (SOH)
  const batteryHealthPercent = value.getUint8(3);

  const result: Partial<LiveBikeTelemetry> = {
    manufacturer: 'bosch',
    batteryPercent,
    batteryWhRemaining,
    batteryHealthPercent: batteryHealthPercent > 0 && batteryHealthPercent <= 100 ? batteryHealthPercent : undefined,
  };

  // Byte 4-5: Speed in 0.1 km/h
  if (value.byteLength >= 6) {
    const rawSpeed = value.getUint16(4, true);
    result.speedKmH = +(rawSpeed / 10).toFixed(1);
  }

  // Byte 6: Cadence RPM
  if (value.byteLength >= 7) {
    result.cadenceRpm = value.getUint8(6);
  }

  // Byte 7-8: Rider Power (Watts)
  if (value.byteLength >= 9) {
    result.riderPowerWatts = value.getUint16(7, true);
  }

  // Byte 9-10: Motor Power (Watts)
  if (value.byteLength >= 11) {
    result.motorPowerWatts = value.getUint16(9, true);
  }

  // Byte 11: Assist Mode
  if (value.byteLength >= 12) {
    const rawMode = value.getUint8(11);
    result.motorAssistMode = BOSCH_MODE_MAP[rawMode] || 'auto';
  }

  return result;
}
