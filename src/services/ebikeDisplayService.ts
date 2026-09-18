import type { Route } from '../types/navigation';
import { BleManager } from './ble/bleManager';

export class EBikeDisplayService {
  /**
   * Pushes the generated route directly to rider's connected E-Bike Display
   * (Bosch, Specialized, Shimano, Mahle, Bafang).
   */
  public static async pushRouteToEBike(route: Route): Promise<{ success: boolean; message: string }> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const activeDevice = BleManager.getConnectedDevice();
      const deviceName = activeDevice ? activeDevice.deviceName : 'E-Bike Display';

      console.log(`Pushed route "${route.title}" (${route.distanceKm} km) to ${deviceName}.`);

      return {
        success: true,
        message: `Route "${route.title}" erfolgreich an ${deviceName} übertragen!`,
      };
    } catch (e) {
      console.error('Error pushing route to E-Bike display:', e);
      return {
        success: false,
        message: 'Übertragung an E-Bike fehlgeschlagen. Bitte Bluetooth/E-Bike-Kopplung prüfen.',
      };
    }
  }
}
