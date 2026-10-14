import type { LiveBikeTelemetry } from '../../../types/navigation';

/**
 * Bosch eBike Systems "Live Data Interface" (LDI) V1.0 BLE GATT Parser.
 *
 * [FAKT, Quelle: Grok-Recherchebericht 2026-10, LDI-Spec-PDF "20260501_LiveDataInterface_V1_28042026.pdf"]
 * Offizielle, von Bosch veröffentlichte Spec (Apache-2.0, kein Partnervertrag nötig), Stand V1.0 vom
 * 2026-05-01, bislang ohne neue Version. Der Lesezugriff ist read-only. Die zuvor hier eingetragenen
 * UUIDs (0000fe59.../00000001-0000-1000-8000-00805f9b34fb) waren KEINE Bosch-Vendor-UUIDs, sondern die
 * generische Bluetooth-SIG-Base-UUID mit falschem Präfix — sie gehörten zu keiner realen Bosch-Hardware.
 * Korrigiert auf die in der Spec genannten UUIDs.
 *
 * [RISIKO] Architektur-Einschränkung laut Spec: Das Rad ist GAP-Central und GATT-Server, das Zubehör
 * ist GAP-Peripheral und GATT-Client. Ein Smartphone, das als gewöhnlicher GATT-Client direkt nach dem
 * Rad scannt (wie es dieser BleManager für alle anderen Hersteller tut), ist damit NICHT spec-konform
 * und wird gegen ein echtes Bosch-Smart-System-Rad vermutlich nicht funktionieren. Produktiv genutzt
 * werden kann die LDI nur über eine Brücke, die selbst als spec-konformes LDI-Peripheral auftritt und
 * nach außen ein Standardprofil (z.B. FTMS Indoor Bike) exponiert — z.B. BEStie (GPL-3.0, nRF-Firmware)
 * oder Xunil99/ha-bosch-ebike (Apache-2.0, ESPHome). Ohne eine solche Brücke bleibt die Verbindung
 * experimentell.
 *
 * [NICHT GEPRÜFT] Die Spec definiert zusätzlich drei boolesche Felder (light_reserve_state,
 * diagnosis_program_active, bike_not_driving), die hier noch NICHT dekodiert werden: Bit-Position und
 * Byte-Offset innerhalb der Telemetrie-Notification sind aus dem vorliegenden Bericht nicht entnehmbar,
 * nur dass sie in V1.0 enthalten sind. Siehe docs/ebike_communication_protocols.md für die komplette
 * Einordnung.
 *
 * [RISIKO] Nicht zu verwechseln mit den Community-Reverse-Engineering-Projekten radiohound/
 * bosch-smart-system-ble und rweijnen/bosch-bes3-reader: Diese sprechen den separaten, nicht
 * sanktionierten Diagnose-Kanal (0x0011) an, NICHT die LDI, und sollten für Der Wegweiser nicht
 * genutzt werden.
 */

export const BOSCH_DIAGNOSTIC_SERVICE_UUID = '0000eb20-eaa2-11e9-81b4-2a2ae2dbcce4';
export const BOSCH_LDI_TELEMETRY_CHAR = '0000eb21-eaa2-11e9-81b4-2a2ae2dbcce4';

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
    batteryKnown: true,
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
