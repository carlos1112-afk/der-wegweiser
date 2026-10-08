import { describe, expect, it } from 'vitest';
import {
  assertGlowLarger,
  buildClusterInteractionSpecs,
  buildClusterLayerSpecs,
  clusterHoverPaintOverrides,
  cubeHeightFromStation,
  cubeHoverHeightExpression,
  DEFAULT_GLOW_SCALE,
  DEFAULT_HALF_SIDE_M,
  CLUSTER_CUBE_FILL,
  CLUSTER_CUBE_OUTLINE,
  CLUSTER_OUTLINE_LINE_WIDTH,
  expressionUsesFeatureStateHover,
  GLOW_HEIGHT_FACTOR,
  GLOW_HOVER_HEIGHT_BONUS,
  glowHoverHeightExpression,
  heightFromSize,
  HOVER_HEIGHT_MULTIPLIER,
  polygonLngSpan,
  PULSE_HEIGHT_FACTOR,
  PULSE_HOVER_HEIGHT_FACTOR,
  PULSE_LAYER_ID,
  PULSE_OPACITY_AMPLITUDE,
  PULSE_OPACITY_MIN,
  PULSE_PERIOD_MS,
  pulseHoverHeightExpression,
  pulseOpacity,
  squarePolygon,
  stationsToClusterGeoJSON,
} from './clusterCubes';
import type { ChargingStation } from '../../types/navigation';

const baseStation = (over: Partial<ChargingStation> = {}): ChargingStation => ({
  id: 'st-1',
  name: 'Test Lader',
  lat: 52.52,
  lng: 13.405,
  plugType: 'schuko_230v',
  isWeatherproof: true,
  isFree: true,
  openingHours: '24/7',
  nearbyAmenities: [],
  verifiedByCount: 2,
  createdAt: '2026-01-01',
  createdByUserId: 'u1',
  isVerifiedBikeInfrastructure: true,
  ...over,
});

describe('clusterCubes', () => {
  it('builds a closed square polygon around a point', () => {
    const poly = squarePolygon(52.52, 13.405, 20);
    expect(poly.type).toBe('Polygon');
    expect(poly.coordinates[0]).toHaveLength(5);
    expect(poly.coordinates[0][0]).toEqual(poly.coordinates[0][4]);
  });

  it('maps verifiedByCount into extrusion height', () => {
    expect(cubeHeightFromStation(baseStation({ verifiedByCount: 0 }))).toBe(28);
    expect(cubeHeightFromStation(baseStation({ verifiedByCount: 5 }))).toBe(88);
  });

  it('maps size attribute 1:1 to fill-extrusion-height meters', () => {
    expect(heightFromSize(55)).toBe(55);
    expect(heightFromSize(0)).toBe(0);
    expect(heightFromSize(-3)).toBe(0);
    const { cubes } = stationsToClusterGeoJSON([baseStation({ verifiedByCount: 5 })]);
    const size = cubes.features[0].properties.size;
    expect(heightFromSize(size)).toBe(88);
    expect(size).toBe(cubeHeightFromStation(baseStation({ verifiedByCount: 5 })));
  });

  it('emits cube + larger glow footprints with size attribute', () => {
    const { cubes, glow } = stationsToClusterGeoJSON([baseStation()]);
    expect(cubes.features.length).toBeGreaterThanOrEqual(1);
    expect(glow.features.length).toBe(cubes.features.length);
    expect(cubes.features[0].properties.size).toBeGreaterThan(0);

    const cubeSpan = polygonLngSpan(cubes.features[0].geometry);
    const glowSpan = polygonLngSpan(glow.features[0].geometry);
    expect(glowSpan).toBeGreaterThan(cubeSpan);
    expect(assertGlowLarger(DEFAULT_HALF_SIDE_M, DEFAULT_HALF_SIDE_M * DEFAULT_GLOW_SCALE)).toBe(true);
    expect(DEFAULT_GLOW_SCALE).toBeGreaterThan(1);
  });

  it('keeps glow footprint larger than cube for custom glowScale', () => {
    const half = 40;
    const glowScale = 1.5;
    const { cubes, glow } = stationsToClusterGeoJSON([baseStation()], {
      halfSideM: half,
      glowScale,
    });
    expect(assertGlowLarger(half, half * glowScale)).toBe(true);
    expect(polygonLngSpan(glow.features[0].geometry)).toBeGreaterThan(
      polygonLngSpan(cubes.features[0].geometry)
    );
  });

  it('adds demo cubes when station list is empty (visibility Negativpfad)', () => {
    const { cubes } = stationsToClusterGeoJSON([]);
    expect(cubes.features.length).toBeGreaterThanOrEqual(3);
    expect(cubes.features.every((f) => typeof f.properties.size === 'number')).toBe(true);
  });

  it('exposes neon fill/outline contract and line-width 2', () => {
    expect(CLUSTER_CUBE_FILL).toBe('#00ff9f');
    expect(CLUSTER_CUBE_OUTLINE).toBe('#39ff14');
    expect(CLUSTER_OUTLINE_LINE_WIDTH).toBe(2);

    const specs = buildClusterLayerSpecs();
    const outline = specs.find((s) => s.role === 'outline');
    const cubes = specs.find((s) => s.role === 'cubes');
    const glow = specs.find((s) => s.role === 'glow');

    expect(outline?.paint['line-color']).toBe('#39ff14');
    expect(outline?.paint['line-width']).toBe(2);
    expect(cubes?.paint['fill-extrusion-color']).toBe('#00ff9f');
    expect(cubes?.paint['fill-extrusion-height']).toEqual(['get', 'size']);
    expect(glow?.underCubes).toBe(true);
    expect(glow?.paint['fill-extrusion-height']).toEqual([
      '*',
      ['get', 'size'],
      GLOW_HEIGHT_FACTOR,
    ]);
  });

  it('orders glow under cubes in layer specs', () => {
    const specs = buildClusterLayerSpecs();
    const glowIdx = specs.findIndex((s) => s.role === 'glow');
    const cubeIdx = specs.findIndex((s) => s.role === 'cubes');
    expect(glowIdx).toBeGreaterThanOrEqual(0);
    expect(cubeIdx).toBeGreaterThan(glowIdx);
    expect(specs.some((s) => s.id.includes('pulse'))).toBe(false);
  });
});

describe('cluster interaction (Abschnitt 4)', () => {
  it('keeps HOVER_HEIGHT_MULTIPLIER at 1.45 and pulse layer id stable', () => {
    expect(HOVER_HEIGHT_MULTIPLIER).toBe(1.45);
    expect(PULSE_LAYER_ID).toBe('cluster-pulse-glow');
    expect(GLOW_HOVER_HEIGHT_BONUS).toBe(0.2);
    expect(PULSE_HEIGHT_FACTOR).toBe(0.45);
    expect(PULSE_HOVER_HEIGHT_FACTOR).toBe(0.7);
  });

  it('builds cube/glow/pulse height expressions via feature-state hover (no style swap)', () => {
    const cube = cubeHoverHeightExpression();
    const glow = glowHoverHeightExpression();
    const pulse = pulseHoverHeightExpression();

    expect(expressionUsesFeatureStateHover(cube)).toBe(true);
    expect(expressionUsesFeatureStateHover(glow)).toBe(true);
    expect(expressionUsesFeatureStateHover(pulse)).toBe(true);

    expect(cube).toEqual([
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      ['*', ['get', 'size'], HOVER_HEIGHT_MULTIPLIER],
      ['get', 'size'],
    ]);
    expect(glow).toEqual([
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      ['*', ['get', 'size'], GLOW_HEIGHT_FACTOR + GLOW_HOVER_HEIGHT_BONUS],
      ['*', ['get', 'size'], GLOW_HEIGHT_FACTOR],
    ]);

    const overrides = clusterHoverPaintOverrides();
    expect(overrides.cubesHeight).toEqual(cube);
    expect(overrides.glowHeight).toEqual(glow);
  });

  it('exposes dedicated pulse interaction layer separate from Abschnitt-3 specs', () => {
    const base = buildClusterLayerSpecs();
    const interaction = buildClusterInteractionSpecs();

    expect(base.some((s) => s.id.includes('pulse') || s.role === 'pulse')).toBe(false);
    expect(interaction).toHaveLength(1);
    expect(interaction[0].id).toBe(PULSE_LAYER_ID);
    expect(interaction[0].role).toBe('pulse');
    expect(interaction[0].type).toBe('fill-extrusion');
    expect(interaction[0].source).toBe('glow');
    expect(interaction[0].paint['fill-extrusion-height']).toEqual(pulseHoverHeightExpression());
    expect(interaction[0].paint['fill-extrusion-opacity']).toBe(PULSE_OPACITY_MIN);
    expect(expressionUsesFeatureStateHover(interaction[0].paint['fill-extrusion-height'])).toBe(
      true
    );
  });

  it('animates pulse opacity in [min, min+amplitude] without style swap', () => {
    expect(PULSE_OPACITY_MIN).toBe(0.06);
    expect(PULSE_OPACITY_AMPLITUDE).toBe(0.28);
    expect(PULSE_PERIOD_MS).toBe(380);

    const lo = PULSE_OPACITY_MIN;
    const hi = PULSE_OPACITY_MIN + PULSE_OPACITY_AMPLITUDE;
    // sin(t/period) = -1 → wave 0 → min; = +1 → wave 1 → max
    const tMin = (3 * Math.PI) / 2 * PULSE_PERIOD_MS;
    const tMax = (Math.PI / 2) * PULSE_PERIOD_MS;
    expect(pulseOpacity(tMin)).toBeCloseTo(lo, 10);
    expect(pulseOpacity(tMax)).toBeCloseTo(hi, 10);

    for (let i = 0; i < 20; i++) {
      const v = pulseOpacity(i * 37);
      expect(v).toBeGreaterThanOrEqual(lo - 1e-12);
      expect(v).toBeLessThanOrEqual(hi + 1e-12);
    }
  });
});
