import { describe, it, expect } from 'vitest';
import { parsePowerMeasurement, parseBatteryLevel } from '../../src/services/ble/parsers/standardSigParser';
import { parseBoschLdiTelemetry } from '../../src/services/ble/parsers/boschLdiParser';
import { parseSpecializedTelemetry } from '../../src/services/ble/parsers/specializedParser';
import { parseShimanoTelemetry } from '../../src/services/ble/parsers/shimanoParser';
import { parseMahleTelemetry } from '../../src/services/ble/parsers/mahleParser';
import { parseBafangPacket } from '../../src/services/ble/parsers/bafangParser';

function view(size: number, fill: (v: DataView) => void): DataView {
  const v = new DataView(new ArrayBuffer(size));
  fill(v);
  return v;
}

describe('Szenario 3: BLE-Parser (echter Code aus src/services/ble/parsers)', () => {
  it('SIG Cycling Power: 250 W', () => {
    const r = parsePowerMeasurement(view(4, (v) => { v.setUint16(0, 0, true); v.setInt16(2, 250, true); }));
    expect(r.riderPowerWatts).toBe(250);
  });

  it('SIG Battery Service: 87 %', () => {
    const r = parseBatteryLevel(view(1, (v) => v.setUint8(0, 87)));
    expect(r.batteryPercent).toBe(87);
    expect(r.batteryKnown).toBe(true);
  });

  it('Bosch LDI: vollständiges Telemetrie-Paket', () => {
    const r = parseBoschLdiTelemetry(view(12, (v) => {
      v.setUint8(0, 88); v.setUint16(1, 660, true); v.setUint8(3, 98); v.setUint16(4, 234, true);
      v.setUint8(6, 72); v.setUint16(7, 145, true); v.setUint16(9, 210, true); v.setUint8(11, 3);
    }));
    expect(r).toMatchObject({
      manufacturer: 'bosch', batteryPercent: 88, batteryWhRemaining: 660, batteryHealthPercent: 98,
      speedKmH: 23.4, cadenceRpm: 72, riderPowerWatts: 145, motorPowerWatts: 210, motorAssistMode: 'auto',
    });
  });

  it('Bosch LDI: zu kurzes Paket ergibt leeres Ergebnis statt Fantasiewerten', () => {
    expect(parseBoschLdiTelemetry(view(3, () => {}))).toEqual({});
  });

  it('Specialized: Akku, Geschwindigkeit, Kadenz, Leistung', () => {
    const r = parseSpecializedTelemetry(view(7, (v) => {
      v.setUint8(0, 82); v.setUint16(1, 2410, true); v.setUint8(3, 76); v.setUint16(4, 160, true); v.setUint8(6, 2);
    }));
    expect(r).toMatchObject({ batteryPercent: 82, speedKmH: 24.1, cadenceRpm: 76, riderPowerWatts: 160 });
    // Der echte Parser bildet Moduswert 2 auf 'tour' ab; das frühere Skript erwartete 'trail'.
    expect(r.motorAssistMode).toBe('tour');
  });

  it('Shimano STEPS: Akku, Gang, Reichweite', () => {
    const r = parseShimanoTelemetry(view(11, (v) => {
      v.setUint8(0, 90); v.setUint8(1, 7); v.setUint8(2, 2); v.setUint16(3, 800, true);
      v.setUint16(5, 2500, true); v.setUint16(7, 130, true); v.setUint16(9, 68, true);
    }));
    expect(r).toMatchObject({
      manufacturer: 'shimano', batteryPercent: 90, currentGear: 7, cadenceRpm: 80, speedKmH: 25, rangeRemainingKm: 68,
    });
  });

  it('Mahle: Akku, Wh, Motortemperatur', () => {
    const r = parseMahleTelemetry(view(10, (v) => {
      v.setUint8(0, 78); v.setUint16(1, 195, true); v.setUint8(3, 1); v.setUint16(4, 228, true);
      v.setUint8(6, 70); v.setUint16(7, 150, true); v.setInt8(9, 34);
    }));
    expect(r).toMatchObject({
      manufacturer: 'mahle', batteryPercent: 78, batteryWhRemaining: 195, motorTemperatureC: 34, motorPowerWatts: 150,
    });
  });

  it('Bafang: Frame 0x32 ergibt 85 % und 360 W', () => {
    const r = parseBafangPacket(view(7, (v) => {
      v.setUint8(0, 0x59); v.setUint8(1, 0x32); v.setUint16(2, 48000, true); v.setUint16(4, 7500, true); v.setUint8(6, 85);
    }));
    expect(r).toMatchObject({ manufacturer: 'bafang', batteryPercent: 85, motorPowerWatts: 360 });
  });

  it('Bafang: falscher Header wird nicht als Telemetrie interpretiert', () => {
    const r = parseBafangPacket(view(7, (v) => { v.setUint8(0, 0x00); v.setUint8(1, 0x32); }));
    expect(r.batteryPercent).toBeUndefined();
    expect(r.motorPowerWatts).toBeUndefined();
  });
});
