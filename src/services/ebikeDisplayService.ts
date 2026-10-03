import type { Route } from '../types/navigation';

export class EBikeDisplayService {
  /**
   * Pushes the generated route directly to rider's connected E-Bike Display
   * (Bosch, Specialized, Shimano, Mahle, Bafang).
   */
  public static async pushRouteToEBike(route: Route): Promise<{ success: boolean; message: string }> {
    throw new Error(`[EBikeDisplayService] Echte Display-Schnittstellen (Bosch, Specialized, Shimano, Mahle, Bafang) nicht angebunden. Übertragung für "${route.title}" kann nicht simuliert werden.`);
  }
}
