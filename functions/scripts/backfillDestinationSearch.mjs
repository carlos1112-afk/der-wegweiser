#!/usr/bin/env node
/**
 * Bounded, idempotent backfill of the public destination search projection.
 * Dry-run is the default. Applying writes requires an explicit --apply flag.
 * Only a public label and coordinates are indexed; ownership and other source fields are excluded.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';

const collections = ['points_of_interest', 'charging_stations', 'charging_stations_v2'];
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const valueFor = (name, fallback) => {
  const prefix = `--${name}=`;
  const item = args.find(argument => argument.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
};
const projectId = valueFor('project', process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '');
const maxDocuments = Number(valueFor('max-documents', '50000'));
const pageSize = Number(valueFor('page-size', '200'));
const help = args.includes('--help');

if (help) {
  console.log('Usage: node functions/scripts/backfillDestinationSearch.mjs --project=PROJECT_ID [--max-documents=50000] [--page-size=200] [--apply]');
  console.log('Without --apply the script performs bounded reads and reports counts only.');
  process.exit(0);
}
if (!projectId || !Number.isSafeInteger(maxDocuments) || maxDocuments < 1 || maxDocuments > 1_000_000
  || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 400) {
  console.error('Invalid arguments. Use --help for usage. A project ID, positive max-documents (<= 1,000,000), and page-size (1..400) are required.');
  process.exit(2);
}

initializeApp({ projectId });
const db = getFirestore();
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss')
  .toLocaleLowerCase('de-DE').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
function makeRecord(collection, value) {
  const name = [value.name, value.label, value.title].find(item => typeof item === 'string' && item.trim());
  const lat = value.lat ?? value.latitude;
  const lng = value.lng ?? value.lon ?? value.longitude;
  if (typeof name !== 'string' || !name.trim() || name.length > 200
    || typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90
    || typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  const normalizedName = normalize(name);
  if (!normalizedName) return null;
  const prefixes = new Set();
  for (const term of new Set([normalizedName, ...normalizedName.split(' ')])) {
    for (let end = 1; end <= Math.min(term.length, 100); end++) prefixes.add(term.slice(0, end));
  }
  // Deliberately omit owner IDs, descriptions, images, source URLs, and all other source fields.
  return { sourceCollection: collection, label: name.trim(), lat, lng, normalizedName,
    searchPrefixes: [...prefixes], schemaVersion: 1 };
}

let overallScanned = 0, overallIndexed = 0, overallSkipped = 0, incomplete = false;
for (const collectionName of collections) {
  const source = db.collection(collectionName);
  let cursor = null, scanned = 0, indexed = 0, skipped = 0;
  while (scanned < maxDocuments) {
    const limit = Math.min(pageSize, maxDocuments - scanned);
    let query = source.orderBy(FieldPath.documentId()).limit(limit);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (!page.size) break;
    for (const snapshot of page.docs) {
      scanned++;
      const indexRef = snapshot.ref.collection('destination_search').doc('v1');
      // Read current source state transactionally to avoid overwriting a newer event-trigger projection.
      if (apply) {
        const wasIndexed = await db.runTransaction(async transaction => {
          const current = await transaction.get(snapshot.ref);
          const record = current.exists ? makeRecord(collectionName, current.data()) : null;
          if (!record) { transaction.delete(indexRef); return false; }
          transaction.set(indexRef, record);
          return true;
        });
        if (wasIndexed) indexed++;
        else skipped++;
      } else if (makeRecord(collectionName, snapshot.data())) indexed++;
      else skipped++;
    }
    cursor = page.docs[page.docs.length - 1];
    if (page.size < limit) break;
    if (scanned === maxDocuments) {
      const remaining = await source.orderBy(FieldPath.documentId()).startAfter(cursor).limit(1).get();
      if (!remaining.empty) incomplete = true;
    }
  }
  overallScanned += scanned; overallIndexed += indexed; overallSkipped += skipped;
  console.log(`${collectionName}: scanned=${scanned}, indexable=${indexed}, skipped=${skipped}, mode=${apply ? 'apply' : 'dry-run'}`);
}
console.log(`Summary: scanned=${overallScanned}, indexable=${overallIndexed}, skipped=${overallSkipped}, mode=${apply ? 'apply' : 'dry-run'}`);
if (incomplete) {
  console.error('At least one collection exceeded --max-documents. Increase the explicit bound and rerun; completed writes are safe to repeat.');
  process.exitCode = 3;
}
