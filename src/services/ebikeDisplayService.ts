import type { Route } from '../types/navigation';

export class EBikeDisplayService {
  /**
   * Pushes the generated route directly to rider's connected E-Bike Display
   * (Bosch, Specialized, Shimano, Mahle, Bafang).
   */
  public static async pushRouteToEBike(route: Route): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: `[EBikeDisplayService] Echte E-Bike-Display-Schnittstelle nicht angebunden. Übertragung für "${route.title}" kann nicht simuliert werden.`,
    };
  }
}
