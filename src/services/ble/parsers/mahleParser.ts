import type { LiveBikeTelemetry } from '../../../types/navigation';

/**
 * Mahle SmartBike Systems (Ebikemotion X35, X20, Pulsar ONE) BLE GATT & ANT+ LEV Parser
 */

export const MAHLE_SERVICE_UUID = '0000a000-0000-1000-8000-00805f9b34fb';
export const MAHLE_TELEMETRY_CHAR = '0000a001-0000-1000-8000-00805f9b34fb';
export const MAHLE_CONTROL_CHAR = '0000a002-0000-1000-8000-00805f9b34fb';

export type MahleAssistLevel = 'off' | 'eco' | 'tour' | 'turbo';

const MAHLE_MODE_MAP: Record<number, MahleAssistLevel> = {
  0: 'off',
  1: 'eco',
  2: 'tour',
  3: 'turbo',
};

export function parseMahleTelemetry(value: DataView): Partial<LiveBikeTelemetry> {
  if (value.byteLength < 4) {
    return {};
  }

  // Byte 0: State of Charge (%)
  const batteryPercent = value.getUint8(0);

  // Byte 1-2: Battery Wh Remaining (uint16 LE)
  const batteryWhRemaining = value.byteLength >= 3 ? value.getUint16(1, true) : undefined;

  // Byte 3: Active Assist Level (0-3)
  const rawMode = value.getUint8(3);
  const motorAssistMode = MAHLE_MODE_MAP[rawMode] || 'eco';

  const result: Partial<LiveBikeTelemetry> = {
    manufacturer: 'mahle',
    batteryPercent,
    batteryWhRemaining,
    motorAssistMode,
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

  // Byte 7-8: Motor Power (Watts)
  if (value.byteLength >= 9) {
    result.motorPowerWatts = value.getUint16(7, true);
  }

  // Byte 9: Motor Temperature (°C)
  if (value.byteLength >= 10) {
    result.motorTemperatureC = value.getInt8(9);
  }

  return result;
}

/**
 * Erstellt einen Steuerbefehl zur Umschaltung der Mahle Unterstützungsstufe (0-3)
 */
export function buildMahleAssistCommand(level: MahleAssistLevel): ArrayBuffer {
  const map: Record<MahleAssistLevel, number> = {
    off: 0x00,
    eco: 0x01,
    tour: 0x02,
    turbo: 0x03,
  };

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint8(0, 0xA1); // Mahle Command Header
  view.setUint8(1, 0x02); // Set Assist Level Subcommand
  view.setUint8(2, map[level]);
  view.setUint8(3, (0xA1 ^ 0x02 ^ map[level]) & 0xFF); // XOR Checksum
  return buffer;
}
