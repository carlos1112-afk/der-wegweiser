import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const firebaseConfig = {
  projectId: 'der-wegweiser',
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: 'der-wegweiser.firebaseapp.com',
  storageBucket: 'der-wegweiser.firebasestorage.app',
  appId: '1:430891513864:web:6e7dedec657640a139f9bd',
  messagingSenderId: '430891513864',
  measurementId: 'G-ZVRKQK2NZ8',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collectionsToInspect = [
  'charging_stations',
  'user_preferences',
  'user_memory_patterns',
  'user_tokens',
  'routes',
  'users',
  'analytics',
  'logs',
  'feedback'
];

async function exportFirebase() {
  console.log('--- Fetching Firebase Firestore Collections for der-wegweiser ---');
  const outputDir = path.resolve('firebase_data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const exportSummary = {
    exportedAt: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    collections: {}
  };

  for (const colName of collectionsToInspect) {
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const docs = [];
      snapshot.forEach(docSnap => {
        docs.push({ id: docSnap.id, ...docSnap.data() });
      });

      console.log(`Collection [${colName}]: found ${docs.length} documents.`);
      exportSummary.collections[colName] = docs.length;

      const filePath = path.join(outputDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
    } catch (err) {
      console.warn(`Error fetching collection [${colName}]:`, err.message);
      exportSummary.collections[colName] = `Error: ${err.message}`;
    }
  }

  const summaryPath = path.join(outputDir, '_export_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(exportSummary, null, 2), 'utf-8');
  console.log('Firebase export complete. Saved to:', outputDir);
  process.exit(0);
}

exportFirebase().catch(err => {
  console.error('Fatal export error:', err);
  process.exit(1);
});
