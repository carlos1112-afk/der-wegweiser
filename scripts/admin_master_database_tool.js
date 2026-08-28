import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Admin Firebase Configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForAdminTool12345",
  authDomain: "der-wegweiser.firebaseapp.com",
  projectId: "der-wegweiser",
  storageBucket: "der-wegweiser.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BACKUP_DIR = path.resolve('backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });

async function runAdminTool() {
  const args = process.argv.slice(2);
  const isExport = args.includes('--export') || args.includes('-e') || args.length === 0;
  const isPurge = args.includes('--purge') || args.includes('--nuke');
  const isStats = args.includes('--stats');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   DER WEGWEISER — ADMIN MASTER DATABASE BACKDOOR TOOL   ');
  console.log('   (Exklusiv für Carlos • Vollständig getrennt von App)  ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Fetch Charging Stations
  let cloudStations = [];
  const stationIds = [];
  try {
    const snap = await getDocs(collection(db, 'charging_stations'));
    snap.docs.forEach((d) => {
      stationIds.push(d.id);
      cloudStations.push({ id: d.id, ...d.data() });
    });
  } catch (e) {
    console.warn('⚠️ Cloud charging_stations:', e.message);
  }

  // 2. Fetch Routes
  let cloudRoutes = [];
  const routeIds = [];
  try {
    const snap = await getDocs(collection(db, 'routes'));
    snap.docs.forEach((d) => {
      routeIds.push(d.id);
      cloudRoutes.push({ id: d.id, ...d.data() });
    });
  } catch (e) {
    console.warn('⚠️ Cloud routes:', e.message);
  }

  // 3. Fetch Partner Leads
  let partnerLeads = [];
  const leadIds = [];
  try {
    const snap = await getDocs(collection(db, 'partner_leads'));
    snap.docs.forEach((d) => {
      leadIds.push(d.id);
      partnerLeads.push({ id: d.id, ...d.data() });
    });
  } catch (e) {
    console.warn('⚠️ Cloud partner_leads:', e.message);
  }

  // 4. Fetch Reviews
  let stationReviews = [];
  const reviewIds = [];
  try {
    const snap = await getDocs(collection(db, 'charging_station_reviews'));
    snap.docs.forEach((d) => {
      reviewIds.push(d.id);
      stationReviews.push({ id: d.id, ...d.data() });
    });
  } catch (e) {
    console.warn('⚠️ Cloud reviews:', e.message);
  }

  console.log('📊 Aktueller Datenbank-Status:');
  console.log(`  • Ladesäulen (Cloud):     ${cloudStations.length}`);
  console.log(`  • Routen (Cloud):         ${cloudRoutes.length}`);
  console.log(`  • B2B Partner Leads:      ${partnerLeads.length}`);
  console.log(`  • Community Reviews:      ${stationReviews.length}\n`);

  if (isStats) {
    process.exit(0);
  }

  if (isExport) {
    const dump = {
      metadata: {
        exportTimestamp: new Date().toISOString(),
        operator: 'Carlos (Sole Owner)',
        schemaVersion: '2.0.0-production',
        totalRecords: cloudStations.length + cloudRoutes.length + partnerLeads.length + stationReviews.length,
      },
      collections: {
        chargingStations: cloudStations,
        routes: cloudRoutes,
        partnerLeads,
        stationReviews,
      },
    };

    const fileName = `der-wegweiser-MASTER-DUMP-${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(dump, null, 2));
    console.log(`✅ [EXPORT ERFOLGREICH] Master-Datenbank gesichert in:\n   📁 ${filePath}\n`);

    if (isPurge) {
      console.log('⚠️ [PURGE / NUKE AKTIVIERT] Lösche alle Online-Cloud-Dokumente...');
      let deletedCount = 0;

      for (const id of stationIds) {
        await deleteDoc(doc(db, 'charging_stations', id));
        deletedCount++;
      }
      for (const id of routeIds) {
        await deleteDoc(doc(db, 'routes', id));
        deletedCount++;
      }
      for (const id of leadIds) {
        await deleteDoc(doc(db, 'partner_leads', id));
        deletedCount++;
      }
      for (const id of reviewIds) {
        await deleteDoc(doc(db, 'charging_station_reviews', id));
        deletedCount++;
      }

      console.log(`🔥 [PURGE ERFOLGREICH] ${deletedCount} Cloud-Einträge restlos aus der Online-Datenbank bereinigt.`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════\n');
  process.exit(0);
}

runAdminTool().catch((e) => {
  console.error('❌ Admin Tool Error:', e);
  process.exit(1);
});
