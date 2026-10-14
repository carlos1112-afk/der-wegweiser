#!/usr/bin/env node
/**
 * Lädt eine mit seed_poi_validate.mjs geprüfte Batch-Datei in die echte
 * Firestore-Collection `points_of_interest` hoch (siehe firestore.rules,
 * Abschnitt "3. Points of Interest" — Schreibzugriff dort bewusst nur über
 * das Admin-SDK vorgesehen, nicht über normale Client-Schreibrechte).
 *
 * Nutzt bewusst NICHT fetch()/die Client-SDK, sondern firebase-admin: das
 * Admin-SDK umgeht die Security Rules komplett und ist genau dafür gedacht,
 * kuratierte Seed-Daten einzuspielen, für die es keinen einzelnen
 * authentifizierten "Ersteller" gibt.
 *
 * Idempotent: Jeder Eintrag wird unter seiner eigenen `id` (aus
 * seed_poi_validate.mjs, randomUUID) als Dokument-ID geschrieben. Erneutes
 * Ausführen derselben Batch-Datei überschreibt dieselben Dokumente, statt sie
 * zu duplizieren.
 *
 * Voraussetzung: GOOGLE_APPLICATION_CREDENTIALS zeigt auf einen Service-
 * Account-Schlüssel mit Firestore-Schreibrechten für das Projekt.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/seed_poi_upload.mjs firebase_data/seed_poi_batch_002.json
 */

import { readFileSync } from "fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const inputFile = process.argv[2];

if (!inputFile) {
  console.error("Usage: node scripts/seed_poi_upload.mjs <seed_poi_batch.json>");
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "::error:: GOOGLE_APPLICATION_CREDENTIALS fehlt. Ohne Service-Account-Schlüssel " +
      "kein Admin-SDK-Zugriff auf Firestore. Niemals ungeprüft mit anderen " +
      "Zugangsdaten versuchen."
  );
  process.exit(2);
}

const batch = JSON.parse(readFileSync(inputFile, "utf-8"));

if (!Array.isArray(batch) || batch.length === 0) {
  console.error("Eingabedatei ist kein nicht-leeres JSON-Array. Abbruch.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

let written = 0;
let failed = 0;

for (const entry of batch) {
  if (!entry.id) {
    console.warn(`Übersprungen (keine id): "${entry.name ?? "(ohne Namen)"}"`);
    failed += 1;
    continue;
  }
  try {
    const { id, ...data } = entry;
    await db.collection("points_of_interest").doc(id).set(data, { merge: true });
    written += 1;
  } catch (err) {
    console.error(`Fehlgeschlagen: "${entry.name}" (${entry.id}) — ${err.message}`);
    failed += 1;
  }
}

console.log(`\nUpload abgeschlossen: ${written} geschrieben, ${failed} fehlgeschlagen.`);
if (failed > 0) process.exit(1);
