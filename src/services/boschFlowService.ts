import type { Route, BoschDiagnosticProfile } from '../types/navigation';

export class BoschFlowService {
  private static STORAGE_KEY = 'der_wegweiser_bosch_profile';

  /**
   * Fetches bike diagnostic profile from Bosch eBike Flow Cloud API.
   * Includes SOH (State of Health), Charge Cycles, and Firmware details.
   */
  public static async syncWithBoschCloud(): Promise<BoschDiagnosticProfile> {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY) : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { ...parsed, isCloudSynced: false };
      } catch {
        // invalid cache
      }
    }

    throw new Error('[BoschFlowService] Echte Bosch eBike Flow Cloud API ist nicht angebunden. Keine simulierten Diagnosedaten erlaubt.');
  }

  /**
   * Pushes the generated AI route directly to rider's Bosch Handlebar Display (Kiox / Nyon).
   */
  public static async pushRouteToBoschDisplay(route: Route): Promise<{ success: boolean; message: string }> {
    throw new Error(`[BoschFlowService] Echte Kiox-/Bosch-Display-Schnittstelle nicht angebunden. Übertragung für "${route.title}" kann nicht simuliert werden.`);
  }
}
