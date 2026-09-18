import type { LiveBikeTelemetry, BikeManufacturer } from '../types/navigation';
import { BleManager } from './ble/bleManager';

export class BleService {
  public static async connectToBike(targetManufacturer?: BikeManufacturer): Promise<LiveBikeTelemetry> {
    return BleManager.connectToBike(targetManufacturer);
  }

  public static subscribeTelemetry(
    initialState: LiveBikeTelemetry,
    onUpdate: (telemetry: LiveBikeTelemetry) => void
  ): () => void {
    return BleManager.subscribeTelemetry(initialState, onUpdate);
  }
}
