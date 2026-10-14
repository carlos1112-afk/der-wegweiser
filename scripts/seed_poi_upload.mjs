#!/usr/bin/env node
/**
 * Uploads validated POI seed batches into Firestore points_of_interest collection.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed_poi_upload.mjs firebase_data/seed_poi_batch_002.json
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import admin from "firebase-admin";

const inputFile = process.argv[2];

if (!inputFile) {
  console.error("Usage: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed_poi_upload.mjs <batch_file.json>");
  process.exit(1);
}

const resolvedPath = resolve(process.cwd(), inputFile);
if (!existsSync(resolvedPath)) {
  console.error(`Error: File not found: ${resolvedPath}`);
  process.exit(1);
}

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credsPath) {
  console.error("Error: GOOGLE_APPLICATION_CREDENTIALS environment variable is required.");
  console.error("Example: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed_poi_upload.mjs " + inputFile);
  process.exit(1);
}

const resolvedCreds = resolve(process.cwd(), credsPath);
if (!existsSync(resolvedCreds)) {
  console.error(`Error: Credentials file not found at: ${resolvedCreds}`);
  process.exit(1);
}

console.log(`Loading credentials from: ${resolvedCreds}`);
const serviceAccount = JSON.parse(readFileSync(resolvedCreds, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || "der-wegweiser"
  });
}

const db = admin.firestore();
const collectionRef = db.collection("points_of_interest");

const pois = JSON.parse(readFileSync(resolvedPath, "utf-8"));
if (!Array.isArray(pois)) {
  console.error("Error: Input file must contain a JSON array.");
  process.exit(1);
}

console.log(`Starting Firestore batch upload for ${pois.length} POIs...`);

async function uploadInBatches() {
  const BATCH_SIZE = 400; // Firestore max is 500 operations per batch
  let totalCommitted = 0;

  for (let i = 0; i < pois.length; i += BATCH_SIZE) {
    const chunk = pois.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const poi of chunk) {
      const docId = poi.id || poi.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const docRef = collectionRef.doc(docId);
      
      const payload = {
        ...poi,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      batch.set(docRef, payload, { merge: true });
    }

    await batch.commit();
    totalCommitted += chunk.length;
    console.log(`Committed batch: ${totalCommitted}/${pois.length} POIs`);
  }

  console.log(`\nUpload complete! Successfully uploaded ${totalCommitted} POIs into 'points_of_interest'.`);
}

uploadInBatches().catch((err) => {
  console.error("Firestore upload failed:", err);
  process.exit(1);
});
