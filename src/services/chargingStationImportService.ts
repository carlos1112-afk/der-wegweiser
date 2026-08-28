import type { ChargingStation, PlugType } from '../types/navigation';

const CACHE_KEY = 'osm_charging_stations_cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class ChargingStationImportService {
  static async fetchFromOSM(bounds: {
    south: number; west: number; north: number; east: number;
  }): Promise<ChargingStation[]> {
    const cacheKey = `${CACHE_KEY}_${bounds.south}_${bounds.west}_${bounds.north}_${bounds.east}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS) {
          return data;
        }
      } catch (e) {
        // ignore invalid cache
      }
    }

    const query = `
[out:json][timeout:10];
(
  node["amenity"="charging_station"]["bicycle"="yes"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
  node["amenity"="charging_station"]["socket:schuko"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
  node["amenity"="bicycle_repair_station"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
);
out body;
`;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });

      if (!response.ok) {
        throw new Error(`OSM API error: ${response.status}`);
      }

      const data = await response.json();
      const stations: ChargingStation[] = [];

      for (const element of data.elements) {
        if (element.type === 'node' && element.tags) {
          const tags = element.tags;
          
          let plugType: PlugType = 'unknown';
          if (tags['socket:schuko'] === 'yes' || tags['socket:schuko']) {
            plugType = 'schuko_230v';
          }
          
          const isFree = tags['fee'] === 'no' || tags['fee'] === '0';
          const name = tags['name'] || tags['operator'] || (tags['amenity'] === 'bicycle_repair_station' ? 'Fahrrad-Reparaturstation' : 'E-Bike Ladestation');

          const station: ChargingStation = {
            id: `osm_${element.id}`,
            name,
            lat: element.lat,
            lng: element.lon,
            plugType,
            isWeatherproof: tags['covered'] === 'yes',
            isFree,
            openingHours: tags['opening_hours'] || 'Unbekannt',
            nearbyAmenities: [],
            verifiedByCount: 1,
            createdAt: new Date().toISOString(),
            createdByUserId: 'system_osm',
            isVerifiedBikeInfrastructure: tags['amenity'] === 'bicycle_repair_station' || tags['bicycle'] === 'yes'
          };
          stations.push(station);
        }
      }

      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: stations
      }));

      return stations;
    } catch (error) {
      console.error('Failed to fetch OSM stations', error);
      return [];
    }
  }
}
