export class ElevationService {

  /**
   * Fetches real elevation (meters above sea level) for a batch of lat/lng coordinates.
   * ZERO CLIENT SECRETS: Commercial API keys reside exclusively on the server backend.
   * Client calls backend proxy (/api/elevation) or direct standard/custom endpoint.
   */
  public static async getElevations(
    coords: [number, number][]
  ): Promise<number[]> {
    if (!coords || coords.length === 0) return [];

    const customEndpoint = import.meta.env?.VITE_ELEVATION_PROVIDER_URL || (globalThis as any).process?.env?.VITE_ELEVATION_PROVIDER_URL;
    const lats = coords.map((c) => c[0]).join(',');
    const lngs = coords.map((c) => c[1]).join(',');

    const proxyUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/elevation?latitude=${lats}&longitude=${lngs}` : '';
    const directUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
    
    const urlToTry = customEndpoint ? `${customEndpoint}?latitude=${lats}&longitude=${lngs}` : (proxyUrl || directUrl);

    try {
      let res = await fetch(urlToTry).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(directUrl);
      }

      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data.elevation)) {
          return data.elevation.map((e: number) => Math.round(e));
        }
      }
    } catch (err) {
      console.warn('[ElevationService] Elevation fetch failed:', err);
    }

    throw new Error('[ElevationService] Live elevation integration unavailable; no fallback is permitted.');
  }
}
