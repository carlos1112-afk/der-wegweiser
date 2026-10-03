#!/usr/bin/env node
/**
 * Deterministischer Zufallspunkt-Generator für Deutschland.
 * PRNG: mulberry32, SEED=1759320000
 * Bounding Box: 47.27–55.06N / 5.87–15.04E
 *
 * Usage: node scripts/poi_region_sampler.mjs [count=60]
 */

const SEED = 1759320000;
const BBOX = { latMin: 47.27, latMax: 55.06, lngMin: 5.87, lngMax: 15.04 };

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const count = parseInt(process.argv[2] ?? "60", 10);
const rand = mulberry32(SEED);

const points = Array.from({ length: count }, (_, i) => {
  const lat = BBOX.latMin + rand() * (BBOX.latMax - BBOX.latMin);
  const lng = BBOX.lngMin + rand() * (BBOX.lngMax - BBOX.lngMin);
  return { index: i + 1, lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
});

const output = { seed: SEED, count, bbox: BBOX, points };
process.stdout.write(JSON.stringify(output, null, 2) + "\n");
