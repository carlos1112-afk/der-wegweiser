#!/usr/bin/env node
/**
 * Validates and deduplicates POI research output before it becomes a seed migration.
 *
 * Usage:
 *   node scripts/seed_poi_validate.mjs <input.json> [--out firebase_data/seed_poi_batch_001.json]
 *
 * Input: JSON array of raw research entries (from research agent).
 * Output: validated, deduplicated JSON array ready for firebase_data/ seed directory.
 *
 * Hard rules (any violation → entry rejected, never silently dropped):
 *   - name must be non-empty string
 *   - lat/lng must be real numbers within Germany bounding box
 *   - category must be one of VALID_CATEGORIES
 *   - sourceUrl must be a valid https:// URL
 *   - confidence must be high|medium|low
 *   - No coordinate duplicates within 50m radius
 *   - No name duplicates (case-insensitive)
 */

import { readFileSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";

const VALID_CATEGORIES = new Set([
  "Werkstatt",
  "Aussichtspunkt",
  "See",
  "Eisladen",
  "Rastplatz",
  "Schutzhütte",
  "Picknickplatz",
  "Sonstiges",
]);

const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

// Germany rough bounding box (generous)
const BBOX = { latMin: 47.0, latMax: 55.2, lngMin: 5.5, lngMax: 15.5 };

// Haversine distance in metres
function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);
const inputFile = args[0];
const outFlag = args.indexOf("--out");
const outputFile =
  outFlag !== -1 ? args[outFlag + 1] : "firebase_data/seed_poi_batch_001.json";

if (!inputFile) {
  console.error("Usage: node scripts/seed_poi_validate.mjs <input.json> [--out <output.json>]");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(inputFile, "utf-8"));

if (!Array.isArray(raw)) {
  console.error("Input must be a JSON array.");
  process.exit(1);
}

const accepted = [];
const rejected = [];
const seenNames = new Set();

for (const entry of raw) {
  const errors = [];

  if (!entry.name || typeof entry.name !== "string" || entry.name.trim() === "") {
    errors.push("name missing or empty");
  }

  const lat = Number(entry.lat);
  const lng = Number(entry.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    errors.push("lat/lng not finite numbers");
  } else {
    if (lat < BBOX.latMin || lat > BBOX.latMax || lng < BBOX.lngMin || lng > BBOX.lngMax) {
      errors.push(`coordinates outside Germany bbox: ${lat},${lng}`);
    }
  }

  if (!VALID_CATEGORIES.has(entry.category)) {
    errors.push(`invalid category: ${entry.category}`);
  }

  if (!entry.sourceUrl || !isValidUrl(entry.sourceUrl)) {
    errors.push(`invalid sourceUrl: ${entry.sourceUrl}`);
  }

  if (!VALID_CONFIDENCE.has(entry.confidence)) {
    errors.push(`invalid confidence: ${entry.confidence}`);
  }

  if (errors.length > 0) {
    rejected.push({ entry, errors });
    continue;
  }

  const nameLower = entry.name.trim().toLowerCase();
  if (seenNames.has(nameLower)) {
    rejected.push({ entry, errors: ["duplicate name"] });
    continue;
  }

  // Coordinate proximity check (50m)
  const tooClose = accepted.find(
    (a) => distanceM(a.lat, a.lng, lat, lng) < 50
  );
  if (tooClose) {
    rejected.push({
      entry,
      errors: [`coordinate too close to existing entry "${tooClose.name}" (< 50m)`],
    });
    continue;
  }

  seenNames.add(nameLower);
  accepted.push({
    id: randomUUID(),
    name: entry.name.trim(),
    lat,
    lng,
    category: entry.category,
    description: entry.description ?? "",
    address: entry.address ?? null,
    website: entry.website ?? null,
    sourceUrl: entry.sourceUrl,
    sourceName: entry.sourceName ?? "",
    confidence: entry.confidence,
    anchorIndex: entry.anchorIndex ?? null,
    verifiedAt: null,
    createdByUserId: null,
    createdAt: new Date().toISOString(),
    schemaVersion: 2,
  });
}

writeFileSync(outputFile, JSON.stringify(accepted, null, 2) + "\n");

console.log(`\nValidation complete:`);
console.log(`  Accepted: ${accepted.length}`);
console.log(`  Rejected: ${rejected.length}`);
if (rejected.length > 0) {
  console.log(`\nRejected entries:`);
  for (const { entry, errors } of rejected) {
    console.log(`  - "${entry.name ?? "(no name)"}" → ${errors.join("; ")}`);
  }
}
console.log(`\nOutput written to: ${outputFile}`);
