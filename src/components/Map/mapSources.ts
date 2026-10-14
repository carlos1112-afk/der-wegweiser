// Kartenquellen der freien MapLibre-Modi (topo, cycle, satellite).
// Ohne Schlüssel gelten die bisherigen schlüsselfreien Quellen. Mit Schlüssel werden MapTiler bzw.
// Thunderforest genutzt. Die Schlüssel stehen in VITE_*-Variablen und landen dadurch im öffentlichen
// Bundle und in jeder Kachel-URL: Sie MÜSSEN in der Anbieter-Console auf die eigenen Domains
// beschränkt werden. Die Premium-Modi (Google Maps) laufen weiterhin über den PremiumKeyService.

export interface MapKeys {
  maptiler?: string;
  thunderforest?: string;
}

export interface RasterSourceDef {
  tiles: string[];
  attribution: string;
  maxzoom: number;
}

export interface DemSourceDef {
  tiles: string[];
  encoding: 'terrarium' | 'mapbox';
  tileSize: 256;
  /** Nur gesetzt, wo die Quelle nach unten begrenzt ist; darüber wird mit dem letzten Level überzoomt. */
  maxzoom?: number;
}

/** Konservativ: Quellen nennen für terrain-rgb-v2 Zoom 12 bis 14. Bei 12 gibt es nie eine 404-Kachel. */
export const MAPTILER_TERRAIN_MAXZOOM = 12;

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readMapKeys(env: Env = (import.meta.env ?? {}) as Env): MapKeys {
  return {
    maptiler: clean(env.VITE_MAPTILER_API_KEY),
    thunderforest: clean(env.VITE_THUNDERFOREST_API_KEY),
  };
}

const enc = encodeURIComponent;

export function demSource(keys: MapKeys): DemSourceDef {
  if (keys.maptiler) {
    return {
      tiles: [`https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${enc(keys.maptiler)}`],
      encoding: 'mapbox',
      tileSize: 256,
      maxzoom: MAPTILER_TERRAIN_MAXZOOM,
    };
  }
  return {
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
  };
}

export function cycleSource(keys: MapKeys): RasterSourceDef {
  if (keys.thunderforest) {
    return {
      tiles: [`https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=${enc(keys.thunderforest)}`],
      attribution: '© Thunderforest, © OpenStreetMap contributors',
      maxzoom: 18,
    };
  }
  return {
    tiles: ['https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors, CyclOSM',
    maxzoom: 18,
  };
}

/** `allSubdomains`: das Topo-Thema nutzt a/b/c, die Überlagerung im Cycle-Thema nur a (wie bisher). */
export function topoSource(keys: MapKeys, allSubdomains: boolean): RasterSourceDef {
  if (keys.maptiler) {
    return {
      tiles: [`https://api.maptiler.com/maps/topo-v2/256/{z}/{x}/{y}.png?key=${enc(keys.maptiler)}`],
      attribution: '© MapTiler © OpenStreetMap contributors',
      maxzoom: 17,
    };
  }
  const hosts = allSubdomains ? ['a', 'b', 'c'] : ['a'];
  return {
    tiles: hosts.map((h) => `https://${h}.tile.opentopomap.org/{z}/{x}/{y}.png`),
    attribution: '© OpenStreetMap contributors, SRTM',
    maxzoom: 17,
  };
}

export function satelliteSource(keys: MapKeys): RasterSourceDef {
  if (keys.maptiler) {
    return {
      tiles: [`https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key=${enc(keys.maptiler)}`],
      attribution: '© MapTiler © OpenStreetMap contributors',
      maxzoom: 19,
    };
  }
  return {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: '© Esri, DigitalGlobe, GeoEye, i-cubed, USDA FSA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo',
    maxzoom: 19,
  };
}
