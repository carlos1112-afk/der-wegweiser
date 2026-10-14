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
 * authentifizierten "Ersteller" gibt. Aus demselben Grund wird hier auch
 * keine eigene OAuth2/JWT-Signierung gegen die Firestore-REST-API gebaut —
 * das Admin-SDK deckt das bereits ab (inkl. FIRESTORE_EMULATOR_HOST).
 *
 * Idempotent: Jeder Eintrag wird unter seiner eigenen `id` (aus
 * seed_poi_validate.mjs, randomUUID) als Dokument-ID geschrieben. Erneutes
 * Ausführen derselben Batch-Datei überschreibt dieselben Dokumente, statt sie
 * zu duplizieren. Schreibt in Chunks von 400 (Firestore-Limit pro Batch-Commit
 * ist 500 Operationen).
 *
 * Voraussetzung: GOOGLE_APPLICATION_CREDENTIALS zeigt auf einen Service-
 * Account-Schlüssel mit Firestore-Schreibrechten für das Projekt (oder
 * FIRESTORE_EMULATOR_HOST für einen lokalen Testlauf ohne echte Credentials).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/seed_poi_upload.mjs firebase_data/seed_poi_batch_002.json
 *
 * Optionen:
 *   --dry-run   Prüft nur Datei, Struktur und Credentials; schreibt nichts.
 */

import { readFileSync } from "fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const inputFile = args.find((a) => !a.startsWith("--"));

if (!inputFile) {
  console.error("Usage: node scripts/seed_poi_upload.mjs <seed_poi_batch.json> [--dry-run]");
  process.exit(1);
}

const batch = JSON.parse(readFileSync(inputFile, "utf-8"));

if (!Array.isArray(batch) || batch.length === 0) {
  console.error("Eingabedatei ist kein nicht-leeres JSON-Array. Abbruch.");
  process.exit(1);
}

const missingId = batch.filter((entry) => !entry.id);
if (missingId.length > 0) {
  console.error(
    `${missingId.length} Einträge ohne 'id' gefunden (z.B. "${missingId[0].name ?? "(ohne Namen)"}"). ` +
      "Abbruch — die Datei muss zuerst durch seed_poi_validate.mjs laufen."
  );
  process.exit(1);
}

if (dryRun) {
  console.log(
    `[DRY-RUN] ${batch.length} Einträge in "${inputFile}" gefunden, alle mit 'id'. ` +
      `Zielprojekt wird nicht geschrieben.`
  );
  process.exit(0);
}

const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !hasEmulator) {
  console.error(
    "::error:: GOOGLE_APPLICATION_CREDENTIALS fehlt (und FIRESTORE_EMULATOR_HOST ist nicht " +
      "gesetzt). Ohne Service-Account-Schlüssel kein Admin-SDK-Zugriff auf Firestore. " +
      "Niemals ungeprüft mit anderen Zugangsdaten versuchen."
  );
  process.exit(2);
}

initializeApp(hasEmulator ? {} : { credential: applicationDefault() });
const db = getFirestore();
const collectionRef = db.collection("points_of_interest");

const CHUNK_SIZE = 400; // Firestore-Limit pro Batch-Commit ist 500 Operationen
let written = 0;
let failed = 0;

for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
  const chunk = batch.slice(i, i + CHUNK_SIZE);
  const writeBatch = db.batch();

  for (const entry of chunk) {
    const { id, ...data } = entry;
    writeBatch.set(collectionRef.doc(id), { ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  try {
    await writeBatch.commit();
    written += chunk.length;
    console.log(`Geschrieben: ${written}/${batch.length}`);
  } catch (err) {
    failed += chunk.length;
    console.error(`Chunk ${i}-${i + chunk.length} fehlgeschlagen: ${err.message}`);
  }
}

console.log(`\nUpload abgeschlossen: ${written} geschrieben, ${failed} fehlgeschlagen.`);
if (failed > 0) process.exit(1);
