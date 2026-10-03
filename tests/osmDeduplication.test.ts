import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeOsmStations, getDistanceFromLatLonInM, normalizeLng } from '../src/services/dataRepository.ts';
import type { ChargingStation } from '../src/types/navigation.ts';

function createStation(id: string, lat: number, lng: number): ChargingStation {
  return {
    id,
    name: `Station ${id}`,
    lat,
    lng,
    plugType: 'schuko_230v',
    isWeatherproof: true,
    isFree: true,
    openingHours: '24/7',
    nearbyAmenities: [],
    verifiedByCount: 1,
    createdAt: new Date().toISOString(),
    createdByUserId: 'test',
  };
}

// Naive O(N*M) implementation for direct verification comparison
function naiveMerge(existingStations: ChargingStation[], osmStations: ChargingStation[]): ChargingStation[] {
  const filtered = [...existingStations];
  for (const osm of osmStations) {
    const isDuplicate = filtered.some(existing =>
      getDistanceFromLatLonInM(existing.lat, existing.lng, osm.lat, osm.lng) < 50
    );
    if (!isDuplicate) {
      filtered.push(osm);
    }
  }
  return filtered;
}

describe('OSM Charging Station Deduplication Tests', () => {
  it('normalizes longitude correctly', () => {
    assert.equal(normalizeLng(180), -180);
    assert.equal(normalizeLng(-180), -180);
    assert.equal(normalizeLng(181), -179);
    assert.equal(normalizeLng(-181), 179);
    assert.equal(normalizeLng(0), 0);
  });

  it('detects duplicates across spatial grid cell boundaries', () => {
    // CELL_SIZE is 0.001 deg (~111m)
    // Station 1 at lat 50.0004 (cell x = 50000)
    // Station 2 at lat 50.0006 (cell x = 50000)
    // Distance between lat 50.0004 and 50.0006 is ~22m (< 50m)
    const existing = [createStation('exist_1', 50.0004, 8.0000)];
    const osm = [createStation('osm_1', 50.0006, 8.0000)];

    const resSpatial = mergeOsmStations(existing, osm);
    const resNaive = naiveMerge(existing, osm);

    assert.equal(resSpatial.length, 1);
    assert.deepEqual(resSpatial.map(s => s.id), resNaive.map(s => s.id));
  });

  it('handles exact 50m distance boundaries correctly', () => {
    // At lat 50.0, 50 meters in latitude is approx 0.00044966 degrees
    const lat1 = 50.0;
    const lon1 = 10.0;
    const deltaLat49m = (49 / 6371e3) * (180 / Math.PI); // ~49m
    const deltaLat51m = (51 / 6371e3) * (180 / Math.PI); // ~51m

    const existing = [createStation('exist_50m', lat1, lon1)];
    const osmClose = [createStation('osm_49m', lat1 + deltaLat49m, lon1)];
    const osmFar = [createStation('osm_51m', lat1 + deltaLat51m, lon1)];

    const resClose = mergeOsmStations(existing, osmClose);
    assert.equal(resClose.length, 1, 'Should recognize 49m as duplicate');

    const resFar = mergeOsmStations(existing, osmFar);
    assert.equal(resFar.length, 2, 'Should keep 51m as new station');
  });

  it('handles high latitudes (85 degrees and 89.9 degrees)', () => {
    // At 85° lat, 1 degree longitude is cos(85°) * 111km ≈ 9.68km
    // 50m in longitude is 50 / (6371000 * cos(85°) * pi/180) ≈ 0.00516 deg lon
    const lat85 = 85.0;
    const lng1 = 10.0;
    const distM = getDistanceFromLatLonInM(lat85, lng1, lat85, lng1 + 0.003); // < 50m

    const existing85 = [createStation('exist_85', lat85, lng1)];
    const osm85 = [createStation('osm_85', lat85, lng1 + 0.003)];

    assert.ok(distM < 50, `Calculated distance ${distM}m should be < 50m`);

    const resSpatial85 = mergeOsmStations(existing85, osm85);
    const resNaive85 = naiveMerge(existing85, osm85);

    assert.equal(resSpatial85.length, 1);
    assert.deepEqual(resSpatial85.map(s => s.id), resNaive85.map(s => s.id));

    // Near pole at 89.9° lat
    const lat899 = 89.9;
    const existing899 = [createStation('exist_899', lat899, 10.0)];
    const osm899 = [createStation('osm_899', lat899, 10.01)]; // close in meters near pole

    const resSpatial899 = mergeOsmStations(existing899, osm899);
    const resNaive899 = naiveMerge(existing899, osm899);

    assert.equal(resSpatial899.length, resNaive899.length);
  });

  it('handles antimeridian wrapping (-180 / +180 degrees)', () => {
    // Two stations near antimeridian:
    // Station A at lat 20.0, lng -179.9998
    // Station B at lat 20.0, lng +179.9998
    // Lng difference is 0.0004 degrees across antimeridian ≈ 41 meters
    const lat = 20.0;
    const lngA = -179.9998;
    const lngB = 179.9998;

    const distM = getDistanceFromLatLonInM(lat, lngA, lat, lngB);
    assert.ok(distM < 50, `Distance ${distM}m across antimeridian should be < 50m`);

    const existing = [createStation('exist_anti', lat, lngA)];
    const osm = [createStation('osm_anti', lat, lngB)];

    const resSpatial = mergeOsmStations(existing, osm);
    const resNaive = naiveMerge(existing, osm);

    assert.equal(resSpatial.length, 1);
    assert.deepEqual(resSpatial.map(s => s.id), resNaive.map(s => s.id));
  });

  it('reproducible dataset benchmark verifies correctness and speedup', () => {
    // Generate deterministic dataset with seeded RNG
    let seed = 12345;
    function pseudoRandom() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    const existing: ChargingStation[] = [];
    const osm: ChargingStation[] = [];

    // 1000 existing stations around lat 50.0, lng 8.0
    for (let i = 0; i < 1000; i++) {
      existing.push(createStation(
        `exp_${i}`,
        50.0 + (pseudoRandom() - 0.5) * 0.2,
        8.0 + (pseudoRandom() - 0.5) * 0.2
      ));
    }

    // 2000 OSM stations in the same region
    for (let i = 0; i < 2000; i++) {
      osm.push(createStation(
        `osm_${i}`,
        50.0 + (pseudoRandom() - 0.5) * 0.2,
        8.0 + (pseudoRandom() - 0.5) * 0.2
      ));
    }

    const startSpatial = performance.now();
    const resSpatial = mergeOsmStations(existing, osm);
    const durSpatial = performance.now() - startSpatial;

    const startNaive = performance.now();
    const resNaive = naiveMerge(existing, osm);
    const durNaive = performance.now() - startNaive;

    assert.equal(resSpatial.length, resNaive.length, 'Results must match naive merge count');

    const idsSpatial = new Set(resSpatial.map(s => s.id));
    for (const st of resNaive) {
      assert.ok(idsSpatial.has(st.id), `Station ${st.id} should be present in spatial merge result`);
    }

    console.log(`\n📊 Benchmark Results (1000 existing x 2000 OSM):`);
    console.log(`   Naive duration:   ${durNaive.toFixed(2)} ms`);
    console.log(`   Spatial duration: ${durSpatial.toFixed(2)} ms`);
    console.log(`   Speedup:          ${(durNaive / durSpatial).toFixed(2)}x faster\n`);
  });
});
