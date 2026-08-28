import type { LiveBikeTelemetry } from '../types/navigation';
import { BleManager } from './ble/bleManager';

export class BleService {
  public static async connectToBike(): Promise<LiveBikeTelemetry> {
    return BleManager.connectToBike();
  }

  public static subscribeTelemetry(
    initialState: LiveBikeTelemetry,
    onUpdate: (telemetry: LiveBikeTelemetry) => void
  ): () => void {
    return BleManager.subscribeTelemetry(initialState, onUpdate);
  }
}
