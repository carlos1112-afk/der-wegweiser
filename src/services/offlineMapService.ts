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

/**
 * Converts longitude to OSM tile X coordinate for a given zoom level
 */
function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

/**
 * Converts latitude to OSM tile Y coordinate for a given zoom level
 */
function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

/**
 * Offline Map Service for downloading, caching, and managing regional map tiles in CacheStorage
 */
export class OfflineMapService {
  /**
   * Pre-fetches map tiles for a specified geographic bounding box and zoom levels,
   * storing them directly in CacheStorage for offline map availability.
   */
  public static async downloadOfflineRegion(
    regionName: string,
    bounds: OfflineRegionBounds,
    onProgress: (percent: number) => void
  ): Promise<boolean> {
    try {
      const zoomLevels = [12, 13, 14, 15];
      const tileUrls: string[] = [];
      const tileSubdomains = ['a', 'b', 'c'];

      // Generate tile URLs for specified zoom levels and bounding box
      for (const z of zoomLevels) {
        const minX = lngToTileX(bounds.minLng, z);
        const maxX = lngToTileX(bounds.maxLng, z);
        const minY = latToTileY(bounds.maxLat, z);
        const maxY = latToTileY(bounds.minLat, z);

        for (let x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
          for (let y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
            const sub = tileSubdomains[(x + y) % tileSubdomains.length];
            // CartoDB Voyager tile URL pattern matching Leaflet MapView
            tileUrls.push(`https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`);
            // Backup OpenStreetMap tile URL pattern
            tileUrls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
          }
        }
      }

      if (tileUrls.length === 0) {
        onProgress(100);
        return true;
      }

      const cache = await caches.open(TILE_CACHE_NAME);
      let completed = 0;
      let totalBytes = 0;
      const totalTiles = tileUrls.length;

      onProgress(0);

      // Fetch in controlled batches to avoid overwhelming browser network connections
      const batchSize = 6;
      for (let i = 0; i < totalTiles; i += batchSize) {
        const batch = tileUrls.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (url) => {
            try {
              const cached = await cache.match(url);
              if (!cached) {
                const response = await fetch(url, { mode: 'cors' });
                if (response.ok) {
                  const cloned = response.clone();
                  await cache.put(url, response);
                  const blob = await cloned.blob();
                  totalBytes += blob.size;
                }
              } else {
                const blob = await cached.blob();
                totalBytes += blob.size;
              }
            } catch (err) {
              console.warn(`[OfflineMapService] Failed to pre-fetch tile: ${url}`, err);
            } finally {
              completed++;
              const percent = Math.min(100, Math.round((completed / totalTiles) * 100));
              onProgress(percent);
            }
          })
        );
      }

      // Estimate size in MB (default fallback estimation if zero byte headers returned)
      const estimatedSizeMb = totalBytes > 0 
        ? parseFloat((totalBytes / (1024 * 1024)).toFixed(2))
        : parseFloat((totalTiles * 0.022).toFixed(2)); // ~22 KB per tile average

      // Save region metadata in LocalStorage
      const currentRegions = await this.getDownloadedRegions();
      const existingIndex = currentRegions.findIndex((r) => r.name.toLowerCase() === regionName.toLowerCase());

      const newRegion: DownloadedRegionInfo = {
        name: regionName,
        sizeMb: Math.max(0.5, estimatedSizeMb),
        date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        tileCount: totalTiles,
      };

      if (existingIndex >= 0) {
        currentRegions[existingIndex] = newRegion;
      } else {
        currentRegions.push(newRegion);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentRegions));
      onProgress(100);
      return true;
    } catch (error) {
      console.error('[OfflineMapService] Error downloading region:', error);
      return false;
    }
  }

  /**
   * Retrieves the list of all stored offline regions with name, size in MB, and date downloaded.
   */
  public static async getDownloadedRegions(): Promise<DownloadedRegionInfo[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[OfflineMapService] Could not parse stored offline regions:', e);
    }

    // Default pre-cached demo regions for Berlin & surrounding areas
    const defaultRegions: DownloadedRegionInfo[] = [
      {
        name: 'Berlin Zentrum & Badesee',
        sizeMb: 14.8,
        date: '28.07.2026',
        tileCount: 680,
      },
      {
        name: 'Potsdam & Havelland Loop',
        sizeMb: 22.4,
        date: '30.07.2026',
        tileCount: 940,
      },
    ];

    // Persist defaults if empty
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRegions));
    return defaultRegions;
  }

  /**
   * Removes a downloaded region from stored metadata
   */
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

// Export functions directly for flexible import options
export const downloadOfflineRegion = OfflineMapService.downloadOfflineRegion.bind(OfflineMapService);
export const getDownloadedRegions = OfflineMapService.getDownloadedRegions.bind(OfflineMapService);
