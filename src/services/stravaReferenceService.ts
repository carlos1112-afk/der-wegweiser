/**
 * Strava Reference Service — echte, öffentlich dokumentierte Segment-Explore-API.
 *
 * Hinweis zur Quellenwahl: Komoot bietet KEINE offene öffentliche API — nur eine
 * Partner-API hinter Geschäftsvertrag (komoot.com/b2b/api) oder inoffizielle
 * Scraping-Dienste Dritter, die Komoots Nutzungsbedingungen verletzen würden.
 * Strava hingegen dokumentiert seine Segments-API öffentlich
 * (https://developers.strava.com/docs/reference/#api-Segments-exploreSegments)
 * und erlaubt echten, ToS-konformen Lesezugriff auf beliebte öffentliche Segmente.
 *
 * Diese Daten dienen NUR als Inspiration (Namen/Lage beliebter Radwege in der
 * Umgebung) für die KI-Routenerzählung — die tatsächliche Routen-Geometrie wird
 * weiterhin von RoutingService/BRouter erzeugt, nicht von Strava kopiert.
 *
 * Erfordert eine echte Nutzer-Anmeldung bei Strava via OAuth2 (3-legged), da
 * Strava keinen anonymen Server-zu-Server-Zugriff auf die Explore-API erlaubt.
 * Ohne verbundenes Strava-Konto liefert dieser Service ehrlich eine leere Liste —
 * kein Fake-Fallback mit erfundenen Segment-Namen.
 */

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || '';
const STRAVA_TOKEN_STORAGE_KEY = 'wegweiser_strava_access_token';

export interface StravaSegmentReference {
  id: number;
  name: string;
  distanceKm: number;
  avgGradePercent: number;
  elevationGainM: number;
}

export class StravaReferenceService {
  public static isConfigured(): boolean {
    return !!STRAVA_CLIENT_ID;
  }

  public static getStoredAccessToken(): string | null {
    try {
      return localStorage.getItem(STRAVA_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  public static isConnected(): boolean {
    return this.isConfigured() && !!this.getStoredAccessToken();
  }

  /**
   * Startet den echten Strava-OAuth2-Flow (Redirect zur offiziellen Strava-Login-Seite).
   * Der Rückkanal (Code-Austausch gegen Access-Token) muss serverseitig erfolgen,
   * da der Code-Austausch den Strava Client Secret erfordert, der niemals im
   * Client-Bundle liegen darf — siehe "Zero Client Keys"-Prinzip in AGENTS.md.
   * Diese Methode ist bewusst nur der Redirect-Trigger; die Rückverarbeitung ist
   * ein separater, serverseitiger Schritt (noch nicht Teil dieses Service).
   */
  public static beginOAuthRedirect(redirectUri: string): void {
    if (!this.isConfigured()) {
      throw new Error('[StravaReferenceService] VITE_STRAVA_CLIENT_ID ist nicht konfiguriert.');
    }
    const url = new URL('https://www.strava.com/oauth/authorize');
    url.searchParams.set('client_id', STRAVA_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('approval_prompt', 'auto');
    url.searchParams.set('scope', 'read');
    window.location.href = url.toString();
  }

  /**
   * Fragt echte, öffentlich beliebte Radsport-Segmente in einer Bounding-Box ab.
   * Liefert eine leere Liste (kein Fake-Fallback), wenn kein Strava-Konto
   * verbunden ist oder die API nicht erreichbar ist.
   */
  public static async exploreSegmentsNear(
    lat: number,
    lng: number,
    radiusKm: number = 5
  ): Promise<StravaSegmentReference[]> {
    const token = this.getStoredAccessToken();
    if (!token) {
      console.log('[StravaReferenceService] Kein verbundenes Strava-Konto — keine Referenz-Segmente abgefragt.');
      return [];
    }

    // Grobe Bounding-Box: 1° Breite ≈ 111km, Längengrad variiert mit cos(Breite).
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    const bounds = [
      (lat - latDelta).toFixed(6),
      (lng - lngDelta).toFixed(6),
      (lat + latDelta).toFixed(6),
      (lng + lngDelta).toFixed(6),
    ].join(',');

    try {
      const res = await fetch(
        `https://www.strava.com/api/v3/segments/explore?bounds=${bounds}&activity_type=riding`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        console.warn(`[StravaReferenceService] Explore-API fehlgeschlagen: HTTP ${res.status}`);
        return [];
      }
      const data = await res.json();
      const segments = Array.isArray(data?.segments) ? data.segments : [];
      return segments.map((s: any) => ({
        id: s.id,
        name: s.name,
        distanceKm: Number((s.distance / 1000).toFixed(1)),
        avgGradePercent: s.avg_grade,
        elevationGainM: Math.round(s.elev_difference),
      }));
    } catch (e) {
      console.warn('[StravaReferenceService] Netzwerkfehler bei Segment-Explore:', e);
      return [];
    }
  }
}
