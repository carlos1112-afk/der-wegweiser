import type { LiveBikeTelemetry } from '../../../types/navigation';

/**
 * Specialized Turbo (MasterMind TCU) BLE GATT Parser
 * Custom Service UUID: 00000000-3dd4-425e-8d3e-3ff16a611bda
 * Requires PIN pairing (printed on TCU unit)
 */

export const SPECIALIZED_SERVICE_UUID = '00000000-3dd4-425e-8d3e-3ff16a611bda';
export const SPECIALIZED_TELEMETRY_CHAR = '00000001-3dd4-425e-8d3e-3ff16a611bda';
export const SPECIALIZED_ASSIST_CHAR = '00000002-3dd4-425e-8d3e-3ff16a611bda';

type SpecializedAssistMode = 'off' | 'eco' | 'trail' | 'turbo';

const ASSIST_MODE_MAP: Record<number, SpecializedAssistMode> = {
  0: 'off',
  1: 'eco',
  2: 'trail',
  3: 'turbo',
};

export function parseSpecializedTelemetry(value: DataView): Partial<LiveBikeTelemetry> {
  // Specialized Protocol Revision 3 Byte Layout
  const batteryPercent = value.getUint8(0);
  const speedRaw = value.getUint16(1, true);
  const speedKmH = +(speedRaw / 100).toFixed(1);
  const cadenceRpm = value.getUint8(3);
  const riderPowerWatts = value.getUint16(4, true);

  let motorAssistMode: LiveBikeTelemetry['motorAssistMode'] = 'auto';
  if (value.byteLength > 6) {
    const rawMode = value.getUint8(6);
    const mapped = ASSIST_MODE_MAP[rawMode];
    if (mapped) {
      motorAssistMode = mapped === 'trail' ? 'tour' : mapped;
    }
  }

  return {
    batteryPercent,
    speedKmH,
    cadenceRpm,
    riderPowerWatts,
    motorAssistMode,
  };
}

/**
 * Build a payload to set the assist mode on Specialized Turbo
 */
export function buildSpecializedAssistCommand(
  mode: SpecializedAssistMode
): ArrayBuffer {
  const modeValues: Record<SpecializedAssistMode, number> = {
    off: 0x00,
    eco: 0x01,
    trail: 0x02,
    turbo: 0x03,
  };
  const buffer = new ArrayBuffer(3);
  const view = new DataView(buffer);
  view.setUint8(0, 0x53); // Command prefix
  view.setUint8(1, 0x01); // Sub-command: set assist
  view.setUint8(2, modeValues[mode]);
  return buffer;
}
