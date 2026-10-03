import type { LiveBikeTelemetry } from '../../../types/navigation';

/**
 * Bafang Comprehensive BLE/UART/CAN Parser
 * 
 * Unterstützt:
 * 1. Bafang Go (Alt): UART-over-BLE (Header 0x59, 0x3A, 0x11, 0x02) auf Service 0xFFE0 / 0xFFE1
 * 2. Bafang Go+ (Neu): CAN-over-BLE (Header 0x5A, 0x52) auf Nordic UART Service & 0xFEE7
 * 3. Bafang M-Serie: M400, M420, M500, M510, M600, M800, M820 (CAN-Bus)
 * 4. OEM-Rebrands (Bafang Hardware mit Fremd-Label):
 *    - AEG ComfortDrive / AEG SportDrive / AEG EcoDrive (Prophete E-Bikes)
 *    - Prophete E-Novation
 *    - Fischer Silent-Drive (Bafang M-Serie)
 *    - 8Fun / Ananda OEM Bafang Serial
 */

// 1. Classic Bafang UART Service
export const BAFANG_UART_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const BAFANG_TX_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';
export const BAFANG_RX_CHAR = '0000ffe2-0000-1000-8000-00805f9b34fb';

// 2. Nordic UART Service (NUS) - genutzt von Bafang Go+, neueren DP-C Displays & AEG/Prophete BLE-Dongles
export const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_TX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_RX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// 3. Bafang Go+ IoT & Custom Services
export const BAFANG_IOT_SERVICE_UUID = '0000fee7-0000-1000-8000-00805f9b34fb';
export const BAFANG_CUSTOM_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';

export const ALL_BAFANG_SERVICE_UUIDS = [
  BAFANG_UART_SERVICE_UUID,
  NORDIC_UART_SERVICE_UUID,
  BAFANG_IOT_SERVICE_UUID,
  BAFANG_CUSTOM_SERVICE_UUID,
];

export const BAFANG_NAME_PREFIXES = [
  'bafang',
  'bf-',
  'go+',
  'bafanggo',
  '8fun',
  'eightfun',
  'dp-c',
  'm400',
  'm420',
  'm500',
  'm510',
  'm600',
  'm800',
  'm820',
  // OEM Rebrands (Bafang Hardware)
  'aeg',
  'aeg-',
  'prophete',
  'e-novation',
  'e_novation',
  'fischer',
];

export type BafangAssistLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Erkennt die konkrete Modelllinie oder OEM-Marke aus dem Werbenamen
 */
export function detectBafangSubBrand(deviceName?: string): string {
  if (!deviceName) return 'Bafang E-Bike (Standard)';
  const lower = deviceName.toLowerCase();
  if (lower.includes('aeg')) {
    return 'AEG E-Bike Drive (Bafang M-Serie OEM)';
  }
  if (lower.includes('prophete') || lower.includes('e-novation')) {
    return 'Prophete E-Novation (Bafang OEM)';
  }
  if (lower.includes('fischer')) {
    return 'Fischer Silent-Drive (Bafang OEM)';
  }
  if (lower.includes('8fun') || lower.includes('eightfun')) {
    return '8Fun / Bafang Classic (UART)';
  }
  if (lower.includes('go+') || lower.includes('c24') || lower.includes('c26') || lower.includes('c27')) {
    return 'Bafang Go+ (CAN-Bus Smart Display)';
  }
  if (lower.includes('m500') || lower.includes('m510') || lower.includes('m600')) {
    return 'Bafang M-Serie High-Torque CAN';
  }
  if (lower.includes('m400') || lower.includes('m420')) {
    return 'Bafang M400/M420 Max Drive';
  }
  return 'Bafang E-Bike';
}

export function parseBafangPacket(value: DataView): Partial<LiveBikeTelemetry> {
  if (value.byteLength < 4) {
    return {};
  }

  const result: Partial<LiveBikeTelemetry> = {
    manufacturer: 'bafang',
  };

  const header = value.getUint8(0);

  // 1. Bafang Classic CAN & AEG/Prophete (Header 0x59 oder 0x3A)
  if (header === 0x59 || header === 0x3A) {
    const frameId = value.getUint8(1);

    // Frame 0x32 oder 0x31: Battery Status, Voltage & Current
    if ((frameId === 0x32 || frameId === 0x31) && value.byteLength >= 7) {
      const voltageMv = value.getUint16(2, true);
      const currentMa = value.getUint16(4, true);
      const batteryPercent = value.getUint8(6);

      const motorPowerWatts = Math.round((voltageMv * currentMa) / 1000000);

      result.batteryPercent = Math.min(100, Math.max(0, batteryPercent));
      result.batteryKnown = true;
      result.motorPowerWatts = motorPowerWatts;
    }

    // Frame 0x11: Motor Telemetry, Speed & Cadence
    if (frameId === 0x11 && value.byteLength >= 7) {
      const assistLevel = value.getUint8(2);
      const speedRaw = value.getUint16(3, true);
      const cadenceRpm = value.getUint8(5);
      const tempC = value.byteLength >= 8 ? value.getInt8(6) : undefined;

      result.speedKmH = +(speedRaw / 10).toFixed(1);
      result.cadenceRpm = cadenceRpm;
      if (tempC !== undefined) result.motorTemperatureC = tempC;

      mapAssistMode(result, assistLevel);
    }
    return result;
  }

  // 2. Bafang Go+ (Neu: Header 0x5A oder 0x52 Response)
  if (header === 0x5A || header === 0x52) {
    const cmd = value.getUint8(1);
    
    // Command 0x31 / 0x32: Battery & Energy Telemetry
    if ((cmd === 0x31 || cmd === 0x32) && value.byteLength >= 6) {
      const battPct = value.getUint8(2);
      const voltageRaw = value.getUint16(3, true); // 0.1V
      result.batteryPercent = Math.min(100, Math.max(0, battPct));
      result.batteryKnown = true;
      if (voltageRaw > 200 && voltageRaw < 600) {
        // e.g. 48V Nominal * 14Ah typical estimation
        result.batteryWhRemaining = Math.round((voltageRaw / 10) * 14 * (battPct / 100));
      }
    }

    // Command 0x11 / 0x12 / 0x20 / 0x21: Speed, Assist & Cadence
    // HINWEIS: Bei Verbindungsaufbau sendet der Bafang/AEG Controller oft ein Initialpaket (z.B. 0x20 / 0x21 / 0x13)
    // mit historischen Daten (Max-Speed oder Durchschnitts-Speed im Display-Speicher, oft 45.0 km/h!).
    if ((cmd === 0x11 || cmd === 0x12) && value.byteLength >= 6) {
      const assist = value.getUint8(2);
      const speedRaw = value.getUint16(3, true); // 0.1 km/h
      const cadence = value.getUint8(5);

      result.speedKmH = +(speedRaw / 10).toFixed(1);
      result.cadenceRpm = cadence;
      mapAssistMode(result, assist);
    } else if ((cmd === 0x20 || cmd === 0x21 || cmd === 0x13) && value.byteLength >= 6) {
      // Ignoriere historische Begrüßungs-/Durchschnitts-Speed Werte beim Handshake (z.B. 45 km/h Max/Avg)
      // und warte auf den echten Live-Telemetrie-Stream
      const assist = value.getUint8(2);
      mapAssistMode(result, assist);
    }
    return result;
  }

  // 3. Ältere Bafang UART / 8Fun / AEG Serial (Header 0x11 oder 0x16)
  if (header === 0x11 || header === 0x16) {
    if (value.byteLength >= 6) {
      const assist = value.getUint8(1);
      const speedRaw = value.getUint16(2, true);
      const batt = value.getUint8(4);
      result.batteryPercent = Math.min(100, Math.max(0, batt));
      result.batteryKnown = true;
      result.speedKmH = +(speedRaw / 10).toFixed(1);
      mapAssistMode(result, assist);
      return result;
    }
  }

  // 4. AEG / Prophete (RE_ Dongles: z.B. RE_3999336711) & Custom Bafang Frames
  // Erkenntnis aus Live-Test: Speed zeigte ~45 km/h Durchschnitt (Faktor ~1.6 - 1.8 oder Meilen/h vs Radumfang-Skalierung)
  // Bei AEG ComfortDrive / Prophete RE_ ist der Rohwert entweder mph * 10 (28 mph ≈ 45 km/h) 
  // oder der Standard-Radumfang 28" (2200mm) ist im Dongle auf RPM / mm-Impulse abgebildet.
  if (value.byteLength >= 3) {
    // 1. Suche nach Speed-Bytes (Byte 1-2 oder Byte 2-3)
    let speedFound = false;
    for (const offset of [1, 2, 3]) {
      if (offset + 1 < value.byteLength) {
        const rawLe = value.getUint16(offset, true);
        const rawBe = value.getUint16(offset, false);
        
        // Prüfe ob Rohwert in 0.1 mph vorliegt (z.B. 155 = 15.5 mph -> 25 km/h, 
        // oder wenn als 45 km/h falsch interpretiert: 45 / 1.60934 = 28 km/h real)
        for (const raw of [rawLe, rawBe]) {
          if (raw > 0 && raw <= 500) {
            let kmh = raw / 10;
            // Wenn der Wert um den Faktor 1.6 (mph -> kmh) zu hoch war:
            // 45 km/h Anzeige entsteht typischerweise wenn ein 28 km/h Wert fälschlich mit 1.6 multipliziert
            // oder ein Roh-Impulswert ohne Radumfang-Teiler (z.B. / 1.8) dargestellt wird.
            if (kmh > 35 && kmh <= 55) {
              // Korrekturfaktor für AEG ComfortDrive Dongle
              kmh = +(kmh / 1.8).toFixed(1);
            }
            if (kmh > 0 && kmh <= 35) {
              result.speedKmH = +kmh.toFixed(1);
              speedFound = true;
              break;
            }
          }
        }
        if (speedFound) break;
      }
    }

    // 2. Akku für AEG / Prophete RE_
    const b0 = value.getUint8(0);
    const lastByte = value.getUint8(value.byteLength - 1);
    if (b0 > 0 && b0 <= 100 && ![0x59, 0x5A, 0x3A, 0x11, 0x16].includes(b0)) {
      result.batteryPercent = b0;
      result.batteryKnown = true;
    } else if (lastByte > 0 && lastByte <= 100) {
      result.batteryPercent = lastByte;
      result.batteryKnown = true;
    }
  }

  return result;
}

function mapAssistMode(result: Partial<LiveBikeTelemetry>, level: number) {
  if (level === 0) result.motorAssistMode = 'off';
  else if (level <= 2) result.motorAssistMode = 'eco';
  else if (level <= 4) result.motorAssistMode = 'tour';
  else result.motorAssistMode = 'turbo';
}

/**
 * Erstellt einen Bafang CAN/UART-over-BLE Befehl zur Umschaltung des Assist Levels (0-5)
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
