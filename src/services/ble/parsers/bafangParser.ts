import type { LiveBikeTelemetry } from '../../../types/navigation';

/**
 * Bafang M-Series (M400, M500, M600, Bafang Go) CAN-over-BLE GATT Parser
 */

export const BAFANG_UART_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const BAFANG_TX_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';

export type BafangAssistLevel = 0 | 1 | 2 | 3 | 4 | 5;

export function parseBafangPacket(value: DataView): Partial<LiveBikeTelemetry> {
  if (value.byteLength < 5) {
    return {};
  }

  const result: Partial<LiveBikeTelemetry> = {
    manufacturer: 'bafang',
  };

  // Header check: 0x59 is Bafang CAN Frame start
  const header = value.getUint8(0);
  if (header === 0x59 || header === 0x3A) {
    const frameId = value.getUint8(1);

    // Frame 0x32: Battery Status & Power
    if (frameId === 0x32 && value.byteLength >= 7) {
      const voltageMv = value.getUint16(2, true);
      const currentMa = value.getUint16(4, true);
      const batteryPercent = value.getUint8(6);

      const motorPowerWatts = Math.round((voltageMv * currentMa) / 1000000);

      result.batteryPercent = batteryPercent;
      result.motorPowerWatts = motorPowerWatts;
    }

    // Frame 0x11: Motor Telemetry & Speed
    if (frameId === 0x11 && value.byteLength >= 7) {
      const assistLevel = value.getUint8(2);
      const speedRaw = value.getUint16(3, true);
      const cadenceRpm = value.getUint8(5);
      const tempC = value.byteLength >= 8 ? value.getInt8(6) : undefined;

      result.speedKmH = +(speedRaw / 10).toFixed(1);
      result.cadenceRpm = cadenceRpm;
      if (tempC !== undefined) result.motorTemperatureC = tempC;

      if (assistLevel === 0) result.motorAssistMode = 'off';
      else if (assistLevel <= 2) result.motorAssistMode = 'eco';
      else if (assistLevel <= 4) result.motorAssistMode = 'tour';
      else result.motorAssistMode = 'turbo';
    }
  } else {
    // Direct raw packet fallback
    const batteryPercent = value.getUint8(0);
    const speedRaw = value.getUint16(1, true);
    result.batteryPercent = batteryPercent;
    result.speedKmH = +(speedRaw / 100).toFixed(1);
  }

  return result;
}

/**
 * Erstellt einen Bafang CAN-over-BLE Befehl zur Umschaltung des Assist Levels (0-5)
 */
export function buildBafangAssistCommand(level: BafangAssistLevel): ArrayBuffer {
  const buffer = new ArrayBuffer(6);
  const view = new DataView(buffer);
  view.setUint8(0, 0x59); // Frame Header
  view.setUint8(1, 0x11); // Target Command ID: Assist & Motor
  view.setUint8(2, 0x02); // Payload Length
  view.setUint8(3, Math.min(5, Math.max(0, level))); // Assist Level (0-5)
  view.setUint8(4, 0x00); // Walk assist off
  
  // Checksum calculation (Sum of payload bytes)
  const checksum = (0x59 + 0x11 + 0x02 + level) & 0xFF;
  view.setUint8(5, checksum);

  return buffer;
}
