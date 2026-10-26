export interface OfflineRegionBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface DownloadedRegionInfo {
  name: string;
  sizeMb: number;
  date: string;
  tileCount?: number;
}

const STORAGE_KEY = 'der_wegweiser_offline_regions';
const TILE_CACHE_NAME = 'der-wegweiser-map-tiles';
export const MAX_TILE_REQUESTS = 4096;
const MAX_STORAGE_BYTES = 64 * 1024 * 1024;
const ROUTE_ZOOM_LEVELS = [12, 13, 14, 15] as const;
const ROUTE_TILE_RADIUS: Record<number, number> = { 12: 1, 13: 1, 14: 2, 15: 2 };
const MAX_ROUTE_POINTS = 20_000;
const MIN_WEB_MERCATOR_LAT = -85.05112878;
const MAX_WEB_MERCATOR_LAT = 85.05112878;

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function isValidBounds(bounds: OfflineRegionBounds): boolean {
  return [bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng].every(Number.isFinite)
    && bounds.minLat <= bounds.maxLat
    && bounds.minLng <= bounds.maxLng
    && isValidCoordinate(bounds.minLat, bounds.minLng)
    && isValidCoordinate(bounds.maxLat, bounds.maxLng);
}

function lngToTileX(lng: number, zoom: number): number {
  const boundedLng = Math.max(-180, Math.min(180, lng));
  return Math.min(2 ** zoom - 1, Math.floor(((boundedLng + 180) / 360) * 2 ** zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const boundedLat = Math.max(MIN_WEB_MERCATOR_LAT, Math.min(MAX_WEB_MERCATOR_LAT, lat));
  const rad = (boundedLat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

export class OfflineMapService {
  /** Prefetches a bounded tile corridor around route points, not the route's full bounding rectangle. */
  public static async prefetchRouteCorridor(
    coordinates: [number, number][],
    signal?: AbortSignal
  ): Promise<boolean> {
    if (!coordinates || coordinates.length === 0 || coordinates.length > MAX_ROUTE_POINTS) return false;
    if (coordinates.some(([lat, lng]) => !isValidCoordinate(lat, lng))) return false;

    const tileKeys = new Set<string>();
    for (const z of ROUTE_ZOOM_LEVELS) {
      const radius = ROUTE_TILE_RADIUS[z];
      for (const [lat, lng] of coordinates) {
        const centerX = lngToTileX(lng, z);
        const centerY = latToTileY(lat, z);
        const maxTile = 2 ** z - 1;
        for (let x = centerX - radius; x <= centerX + radius; x++) {
          for (let y = centerY - radius; y <= centerY + radius; y++) {
            tileKeys.add(`${z}/${Math.max(0, Math.min(maxTile, x))}/${Math.max(0, Math.min(maxTile, y))}`);
          }
        }
      }
    }

    if (tileKeys.size * 2 > MAX_TILE_REQUESTS || signal?.aborted) return false;
    const tileUrls = this.tileUrlsFromKeys(tileKeys);
    console.log('[OfflineMapService] Auto-prefetching bounded route corridor tiles in background...');
    return this.downloadTileUrls('Aktive Route Korridor', tileUrls, () => {}, signal);
  }

  /** Pre-fetches a bounded geographic region, rejecting excessive tile counts before URL allocation. */
  public static async downloadOfflineRegion(
    regionName: string,
    bounds: OfflineRegionBounds,
    onProgress: (percent: number) => void
  ): Promise<boolean> {
    try {
      if (!isValidBounds(bounds)) return false;
      let estimatedTileCount = 0;
      for (const z of ROUTE_ZOOM_LEVELS) {
        const minX = lngToTileX(bounds.minLng, z);
        const maxX = lngToTileX(bounds.maxLng, z);
        const minY = latToTileY(bounds.maxLat, z);
        const maxY = latToTileY(bounds.minLat, z);
        estimatedTileCount += (Math.abs(maxX - minX) + 1) * (Math.abs(maxY - minY) + 1);
        if (estimatedTileCount * 2 > MAX_TILE_REQUESTS) return false;
      }

      const tileKeys = new Set<string>();
      for (const z of ROUTE_ZOOM_LEVELS) {
        const minX = lngToTileX(bounds.minLng, z);
        const maxX = lngToTileX(bounds.maxLng, z);
        const minY = latToTileY(bounds.maxLat, z);
        const maxY = latToTileY(bounds.minLat, z);
        for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
          for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
            tileKeys.add(`${z}/${x}/${y}`);
          }
        }
      }
      const tileUrls = this.tileUrlsFromKeys(tileKeys);
      if (tileUrls.length > MAX_TILE_REQUESTS) return false;
      return this.downloadTileUrls(regionName, tileUrls, onProgress);
    } catch (error) {
      console.error('[OfflineMapService] Error downloading region:', error);
      return false;
    }
  }

  private static tileUrlsFromKeys(tileKeys: Set<string>): string[] {
    const tileSubdomains = ['a', 'b', 'c'];
    const tileUrls: string[] = [];
    for (const key of tileKeys) {
      const [z, x, y] = key.split('/').map(Number);
      const sub = tileSubdomains[(x + y) % tileSubdomains.length];
      tileUrls.push(`https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`);
      tileUrls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
    }
    return tileUrls;
  }

  private static async downloadTileUrls(
    regionName: string,
    tileUrls: string[],
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<boolean> {
    if (tileUrls.length === 0) {
      onProgress(100);
      return true;
    }
    if (tileUrls.length > MAX_TILE_REQUESTS || signal?.aborted) return false;
    if (typeof window === 'undefined' || !('caches' in window)) return true;

    const cache = await caches.open(TILE_CACHE_NAME);
    let completed = 0;
    let totalBytes = 0;
    const totalTiles = tileUrls.length;
    onProgress(0);

    for (let i = 0; i < totalTiles; i += 6) {
      if (signal?.aborted) return false;
      const batch = tileUrls.slice(i, i + 6);
      await Promise.all(batch.map(async (url) => {
        try {
          if (signal?.aborted) return;
          const cached = await cache.match(url);
          const response = cached || await fetch(url, { mode: 'cors', signal });
          if (response.ok) {
            const blob = await response.clone().blob();
            if (!cached && totalBytes + blob.size <= MAX_STORAGE_BYTES) await cache.put(url, response);
            totalBytes = Math.min(MAX_STORAGE_BYTES, totalBytes + blob.size);
          }
        } catch {
          // Silently ignore single tile network failures and cancellation.
        } finally {
          completed++;
          onProgress(Math.min(100, Math.round((completed / totalTiles) * 100)));
        }
      }));
    }

    const estimatedSizeMb = totalBytes > 0
      ? parseFloat((totalBytes / (1024 * 1024)).toFixed(2))
      : parseFloat((totalTiles * 0.022).toFixed(2));
    const currentRegions = await this.getDownloadedRegions();
    const existingIndex = currentRegions.findIndex((r) => r.name.toLowerCase() === regionName.toLowerCase());
    const newRegion: DownloadedRegionInfo = {
      name: regionName,
      sizeMb: Math.max(0.5, estimatedSizeMb),
      date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      tileCount: totalTiles,
    };
    if (existingIndex >= 0) currentRegions[existingIndex] = newRegion;
    else currentRegions.push(newRegion);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentRegions));
    onProgress(100);
    return true;
  }

  public static async getDownloadedRegions(): Promise<DownloadedRegionInfo[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('[OfflineMapService] Could not parse stored offline regions:', e);
    }

    const defaultRegions: DownloadedRegionInfo[] = [
      { name: 'Berlin Zentrum & Badesee', sizeMb: 14.8, date: '28.07.2026', tileCount: 680 },
      { name: 'Potsdam & Havelland Loop', sizeMb: 22.4, date: '30.07.2026', tileCount: 940 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRegions));
    return defaultRegions;
  }

  public static async deleteOfflineRegion(regionName: string): Promise<boolean> {
    try {
      const current = await this.getDownloadedRegions();
      const updated = current.filter((r) => r.name.toLowerCase() !== regionName.toLowerCase());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('[OfflineMapService] Failed to delete region:', e);
      return false;
    }
  }
}

export const downloadOfflineRegion = OfflineMapService.downloadOfflineRegion.bind(OfflineMapService);
export const getDownloadedRegions = OfflineMapService.getDownloadedRegions.bind(OfflineMapService);
export const prefetchRouteCorridor = OfflineMapService.prefetchRouteCorridor.bind(OfflineMapService);
