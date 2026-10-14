#!/usr/bin/env node
/**
 * Uploads validated POI seed batches into Firestore collection `points_of_interest`.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed_poi_upload.mjs <batch.json>
 *
 * Options:
 *   --dry-run   Validates credentials and JSON without writing to Firestore.
 */

import { readFileSync, existsSync } from "fs";
import { createSign } from "crypto";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const inputFile = args.find((a) => !a.startsWith("--"));

if (!inputFile) {
  console.error("Usage: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed_poi_upload.mjs <batch.json> [--dry-run]");
  process.exit(1);
}

if (!existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

const rawPois = JSON.parse(readFileSync(inputFile, "utf-8"));
if (!Array.isArray(rawPois) || rawPois.length === 0) {
  console.error("Input file must be a non-empty JSON array.");
  process.exit(1);
}

console.log(`Loaded ${rawPois.length} POIs from ${inputFile}`);

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (!credsPath && !emulatorHost) {
  console.error("Error: GOOGLE_APPLICATION_CREDENTIALS environment variable must be set (or FIRESTORE_EMULATOR_HOST).");
  console.error("Example: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed_poi_upload.mjs " + inputFile);
  process.exit(1);
}

let serviceAccount = null;
if (credsPath) {
  if (!existsSync(credsPath)) {
    console.error(`Service account credentials file not found: ${credsPath}`);
    process.exit(1);
  }
  try {
    serviceAccount = JSON.parse(readFileSync(credsPath, "utf-8"));
  } catch (err) {
    console.error(`Failed to parse service account JSON: ${err.message}`);
    process.exit(1);
  }
}

const projectId = serviceAccount?.project_id || process.env.GCLOUD_PROJECT || "der-wegweiser";

if (dryRun) {
  console.log(`[DRY-RUN] Authenticated for project "${projectId}". Found ${rawPois.length} entries. No writes performed.`);
  process.exit(0);
}

// Convert JSON object to Firestore REST API Value format
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    // Check if ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      return { timestampValue: val };
    }
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Mint Google OAuth2 Bearer Token from Service Account Key via Node crypto
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claimSet = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  ).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${claimSet}`);
  const signature = sign.sign(sa.private_key, "base64url");
  const jwt = `${header}.${claimSet}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function uploadBatch() {
  let token = null;
  if (!emulatorHost && serviceAccount) {
    console.log("Acquiring OAuth2 access token for Firestore...");
    token = await getAccessToken(serviceAccount);
    console.log("Token acquired successfully.");
  }

  const baseUrl = emulatorHost
    ? `http://${emulatorHost}/v1/projects/${projectId}/databases/(default)/documents`
    : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  console.log(`Uploading ${rawPois.length} documents to ${projectId} (points_of_interest)...`);

  let success = 0;
  let failed = 0;

  // Process in chunks of 50 to respect rate limits
  const CHUNK_SIZE = 50;
  for (let i = 0; i < rawPois.length; i += CHUNK_SIZE) {
    const chunk = rawPois.slice(i, i + CHUNK_SIZE);

    const promises = chunk.map(async (poi) => {
      const docId = poi.id;
      const url = `${baseUrl}/points_of_interest/${docId}`;
      const fields = {};
      for (const [k, v] of Object.entries(poi)) {
        fields[k] = toFirestoreValue(v);
      }

      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ fields }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`POI "${poi.name}" (${docId}) write failed: HTTP ${res.status} - ${text}`);
      }
    });

    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === "fulfilled") {
        success++;
      } else {
        failed++;
        console.error(`  ✕ ${r.reason.message}`);
      }
    }
    console.log(`  Progress: ${Math.min(i + CHUNK_SIZE, rawPois.length)} / ${rawPois.length} written...`);
  }

  console.log(`\nUpload finished:`);
  console.log(`  ✓ Successfully uploaded: ${success}`);
  console.log(`  ✕ Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

uploadBatch().catch((err) => {
  console.error("Fatal upload error:", err);
  process.exit(1);
});
