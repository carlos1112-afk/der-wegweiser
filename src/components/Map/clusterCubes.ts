import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';
import type { ChargingStation } from '../../types/navigation';
import { CLUSTER_FILL, CLUSTER_OUTLINE } from './cyberpunkStyle';

export interface ClusterCubeProps {
  id: string;
  name: string;
  size: number;
  baseSize: number;
}

/** Half edge length of a cube footprint in meters. */
export const DEFAULT_HALF_SIDE_M = 18;
/** Glow footprint scale vs cube; must be > 1 so glow sits under a larger area. */
export const DEFAULT_GLOW_SCALE = 1.85;
/** Neon rim line-width (px) on the outline layer. */
export const CLUSTER_OUTLINE_LINE_WIDTH = 2;
/** Soft glow extrusion height as fraction of `size` (under the solid cubes). */
export const GLOW_HEIGHT_FACTOR = 0.35;
/** Soft glow fill opacity. */
export const GLOW_OPACITY = 0.22;

/** Abschnitt-4: hover raises cube extrusion height by this factor via feature-state. */
export const HOVER_HEIGHT_MULTIPLIER = 1.45;
/** Glow height factor bonus while hovered (added to GLOW_HEIGHT_FACTOR). */
export const GLOW_HOVER_HEIGHT_BONUS = 0.2;
/** Dedicated pulse-glow layer id — opacity animated, never a full style swap. */
export const PULSE_LAYER_ID = 'cluster-pulse-glow';
/** Pulse opacity floor / amplitude / period (rAF setPaintProperty). */
export const PULSE_OPACITY_MIN = 0.06;
export const PULSE_OPACITY_AMPLITUDE = 0.28;
export const PULSE_PERIOD_MS = 380;
/** Pulse extrusion height factors (idle / hover). */
export const PULSE_HEIGHT_FACTOR = 0.45;
export const PULSE_HOVER_HEIGHT_FACTOR = 0.7;

/** Fill color for cluster cube extrusions (#00ff9f). */
export const CLUSTER_CUBE_FILL = CLUSTER_FILL;
/** Neon outline color (#39ff14). */
export const CLUSTER_CUBE_OUTLINE = CLUSTER_OUTLINE;

/** MapLibre expression: feature-state hover → raised vs base height. */
export function cubeHoverHeightExpression(): unknown[] {
  return [
    'case',
    ['boolean', ['feature-state', 'hover'], false],
    ['*', ['get', 'size'], HOVER_HEIGHT_MULTIPLIER],
    ['get', 'size'],
  ];
}

/** Soft-glow height with a smaller hover lift (still feature-state, not style swap). */
export function glowHoverHeightExpression(): unknown[] {
  return [
    'case',
    ['boolean', ['feature-state', 'hover'], false],
    ['*', ['get', 'size'], GLOW_HEIGHT_FACTOR + GLOW_HOVER_HEIGHT_BONUS],
    ['*', ['get', 'size'], GLOW_HEIGHT_FACTOR],
  ];
}

/** Pulse layer height (feature-state hover); opacity is animated separately. */
export function pulseHoverHeightExpression(): unknown[] {
  return [
    'case',
    ['boolean', ['feature-state', 'hover'], false],
    ['*', ['get', 'size'], PULSE_HOVER_HEIGHT_FACTOR],
    ['*', ['get', 'size'], PULSE_HEIGHT_FACTOR],
  ];
}

/**
 * Opacity for the dedicated pulse layer from rAF timestamp.
 * Range: [PULSE_OPACITY_MIN, PULSE_OPACITY_MIN + PULSE_OPACITY_AMPLITUDE].
 */
export function pulseOpacity(tMs: number): number {
  const wave = 0.5 + 0.5 * Math.sin(tMs / PULSE_PERIOD_MS);
  return PULSE_OPACITY_MIN + wave * PULSE_OPACITY_AMPLITUDE;
}

/** True when an expression tree references feature-state hover (not a style swap). */
export function expressionUsesFeatureStateHover(expr: unknown): boolean {
  if (!Array.isArray(expr)) return false;
  if (expr[0] === 'feature-state' && expr[1] === 'hover') return true;
  return expr.some((part) => expressionUsesFeatureStateHover(part));
}

const METERS_PER_DEG_LAT = 111_320;

function offsetMeters(lat: number, lng: number, northM: number, eastM: number): Position {
  const degLat = northM / METERS_PER_DEG_LAT;
  const degLng = eastM / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [lng + degLng, lat + degLat];
}

/** Axis-aligned square polygon centered on lat/lng. halfSideM = half edge length in meters. */
export function squarePolygon(lat: number, lng: number, halfSideM: number): Polygon {
  const nw = offsetMeters(lat, lng, halfSideM, -halfSideM);
  const ne = offsetMeters(lat, lng, halfSideM, halfSideM);
  const se = offsetMeters(lat, lng, -halfSideM, halfSideM);
  const sw = offsetMeters(lat, lng, -halfSideM, -halfSideM);
  return {
    type: 'Polygon',
    coordinates: [[nw, ne, se, sw, nw]],
  };
}

/** GeoJSON `size` is already meters — maps 1:1 to fill-extrusion-height. */
export function heightFromSize(size: number): number {
  return Math.max(0, size);
}

/** True when glow half-side is strictly larger than the cube footprint. */
export function assertGlowLarger(cubeHalfSideM: number, glowHalfSideM: number): boolean {
  return glowHalfSideM > cubeHalfSideM && cubeHalfSideM > 0;
}

/** Longitude span of a closed ring (maxLng - minLng). */
export function polygonLngSpan(poly: Polygon): number {
  const lngs = poly.coordinates[0].map((c) => c[0]);
  return Math.max(...lngs) - Math.min(...lngs);
}

/** Height in meters from station verification signal (or fallback). */
export function cubeHeightFromStation(station: ChargingStation): number {
  const v = Math.max(0, station.verifiedByCount || 0);
  return Math.min(180, 28 + v * 12);
}

export type ClusterLayerRole = 'glow' | 'cubes' | 'outline' | 'pulse';

export interface ClusterLayerSpec {
  id: string;
  role: ClusterLayerRole;
  type: 'fill-extrusion' | 'line';
  /** Logical source key; map wiring maps this to concrete source ids. */
  source: 'cubes' | 'glow';
  /** Soft glow must be added before cube extrusion so it sits underneath. */
  underCubes: boolean;
  paint: Record<string, unknown>;
}

/**
 * Declarative Abschnitt-3 layer paint (no hover/pulse — interaction is Abschnitt 4).
 * Order: glow (under) → cubes → outline.
 */
export function buildClusterLayerSpecs(): ClusterLayerSpec[] {
  return [
    {
      id: 'cluster-glow-extrusion',
      role: 'glow',
      type: 'fill-extrusion',
      source: 'glow',
      underCubes: true,
      paint: {
        'fill-extrusion-color': CLUSTER_CUBE_FILL,
        'fill-extrusion-height': ['*', ['get', 'size'], GLOW_HEIGHT_FACTOR],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': GLOW_OPACITY,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'cluster-cubes-extrusion',
      role: 'cubes',
      type: 'fill-extrusion',
      source: 'cubes',
      underCubes: false,
      paint: {
        'fill-extrusion-color': CLUSTER_CUBE_FILL,
        'fill-extrusion-height': ['get', 'size'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.88,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'cluster-cubes-outline',
      role: 'outline',
      type: 'line',
      source: 'cubes',
      underCubes: false,
      paint: {
        'line-color': CLUSTER_CUBE_OUTLINE,
        'line-width': CLUSTER_OUTLINE_LINE_WIDTH,
        'line-opacity': 0.95,
        'line-blur': 0.2,
      },
    },
  ];
}

/**
 * Abschnitt-4 interaction layers: dedicated pulse-glow (opacity via rAF/setPaintProperty).
 * Kept separate from buildClusterLayerSpecs so Abschnit-3 contracts stay pulse-free.
 */
export function buildClusterInteractionSpecs(): ClusterLayerSpec[] {
  return [
    {
      id: PULSE_LAYER_ID,
      role: 'pulse',
      type: 'fill-extrusion',
      source: 'glow',
      underCubes: true,
      paint: {
        'fill-extrusion-color': CLUSTER_CUBE_OUTLINE,
        'fill-extrusion-height': pulseHoverHeightExpression(),
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': PULSE_OPACITY_MIN,
        'fill-extrusion-vertical-gradient': false,
      },
    },
  ];
}

/** Runtime paint overrides for Abschnit-3 layers that gain feature-state hover height. */
export function clusterHoverPaintOverrides(): {
  cubesHeight: unknown[];
  glowHeight: unknown[];
} {
  return {
    cubesHeight: cubeHoverHeightExpression(),
    glowHeight: glowHoverHeightExpression(),
  };
}

export function stationsToClusterGeoJSON(
  stations: ChargingStation[],
  options?: { halfSideM?: number; glowScale?: number }
): { cubes: FeatureCollection<Polygon, ClusterCubeProps>; glow: FeatureCollection<Polygon, ClusterCubeProps> } {
  const halfSideM = options?.halfSideM ?? DEFAULT_HALF_SIDE_M;
  const glowScale = options?.glowScale ?? DEFAULT_GLOW_SCALE;
  const glowHalf = halfSideM * glowScale;

  const cubeFeatures: Feature<Polygon, ClusterCubeProps>[] = [];
  const glowFeatures: Feature<Polygon, ClusterCubeProps>[] = [];

  stations.forEach((station) => {
    const size = cubeHeightFromStation(station);
    const props: ClusterCubeProps = {
      id: station.id,
      name: station.name,
      size,
      baseSize: size,
    };

    cubeFeatures.push({
      type: 'Feature',
      id: station.id,
      properties: props,
      geometry: squarePolygon(station.lat, station.lng, halfSideM),
    });

    glowFeatures.push({
      type: 'Feature',
      id: station.id,
      properties: props,
      geometry: squarePolygon(station.lat, station.lng, glowHalf),
    });
  });

  // Demo cubes when few/no stations so the mode is visibly 3D
  if (cubeFeatures.length < 3) {
    const seed = stations[0] ?? { lat: 52.52, lng: 13.405, id: 'demo', name: 'Demo' };
    const offsets: Array<[number, number, number]> = [
      [0.0018, 0.0012, 55],
      [-0.0015, 0.002, 90],
      [0.0012, -0.0018, 70],
      [-0.0022, -0.001, 110],
    ];
    offsets.forEach(([dLat, dLng, size], i) => {
      const id = `demo-cube-${i}`;
      const lat = seed.lat + dLat;
      const lng = seed.lng + dLng;
      const props: ClusterCubeProps = {
        id,
        name: `Cluster ${i + 1}`,
        size,
        baseSize: size,
      };
      cubeFeatures.push({
        type: 'Feature',
        id,
        properties: props,
        geometry: squarePolygon(lat, lng, halfSideM),
      });
      glowFeatures.push({
        type: 'Feature',
        id,
        properties: props,
        geometry: squarePolygon(lat, lng, glowHalf),
      });
    });
  }

  return {
    cubes: { type: 'FeatureCollection', features: cubeFeatures },
    glow: { type: 'FeatureCollection', features: glowFeatures },
  };
}
