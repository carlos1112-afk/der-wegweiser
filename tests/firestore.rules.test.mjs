/**
 * Security-Rules-Tests für firestore.rules.
 *
 * Diese Tests prüfen die tatsächlich deployten Regeln gegen den
 * Firestore-Emulator. Sie ergänzen scripts/test_15_scenarios.mjs, das
 * bislang lediglich eine MockLocalStorage nachgebildet und nie den
 * AccountDeletionService ausgeführt hat — ein "grünes" CI bedeutete dort
 * nichts über die Sicherheit der installierten Regeln.
 *
 * Ausführen:
 *   npx firebase emulators:exec --only firestore --project demo-wegweiser \
 *     "node --test tests/firestore.rules.test.mjs"
 */

import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

const projectId = 'demo-wegweiser';

// `rules` erwartet den Dateiinhalt, nicht den Pfad.
const rulesSource = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: rulesSource,
    },
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

/** Kontext für anonyme oder angemeldete Aufrufer. */
function ctx(opts = {}) {
  const { uid } = opts;
  if (uid) return testEnv.authenticatedContext(uid).firestore();
  return testEnv.unauthenticatedContext().firestore();
}

const { doc, setDoc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc } =
  await import('firebase/firestore');

test('Anonyme Aufrufer dürfen keine Community-Inhalte anlegen', async () => {
  const db = ctx();
  await assertFails(
    setDoc(doc(db, 'charging_stations', 'anon-1'), { name: 'X', createdByUserId: 'anon' })
  );
  await assertFails(setDoc(doc(db, 'routes', 'anon-1'), { title: 'X' }));
  await assertFails(setDoc(doc(db, 'station_reviews', 'anon-1'), { rating: 5 }));
  await assertFails(setDoc(doc(db, 'spatial_road_intelligence', 'seg-1'), { avgSlopePercent: 3 }));
});

test('Anonyme Aufrufer dürfen gespeicherte Routen nicht auflisten', async () => {
  const db = ctx();
  await assertFails(getDocs(collection(db, 'routes')));
});

test('Angemeldete Nutzer dürfen Inhalte anlegen, aber nicht fremde ändern', async () => {
  const owner = ctx({ uid: 'owner-1' });
  const attacker = ctx({ uid: 'attacker-1' });

  await assertSucceeds(
    setDoc(doc(owner, 'charging_stations', 'st-1'), {
      name: 'Ladesäule 1',
      createdByUserId: 'owner-1',
    })
  );

  // Fremder darf weder überschreiben noch löschen.
  await assertFails(
    updateDoc(doc(attacker, 'charging_stations', 'st-1'), { name: 'Übernommen' })
  );
  await assertFails(deleteDoc(doc(attacker, 'charging_stations', 'st-1')));

  // Ersteller darf beides.
  await assertSucceeds(updateDoc(doc(owner, 'charging_stations', 'st-1'), { name: 'Aktualisiert' }));
  await assertSucceeds(deleteDoc(doc(owner, 'charging_stations', 'st-1')));
});

test('Private Routen bleiben privat: nur der Ersteller liest sie', async () => {
  const owner = ctx({ uid: 'owner-1' });
  const other = ctx({ uid: 'other-1' });

  await assertSucceeds(
    setDoc(doc(owner, 'routes', 'route-1'), { title: 'Meine Tour', userId: 'owner-1' })
  );

  await assertSucceeds(getDoc(doc(owner, 'routes', 'route-1')));
  await assertFails(getDoc(doc(other, 'routes', 'route-1')));
  await assertFails(getDocs(collection(other, 'routes')));
});

test('Gelöschte Dokumente geben kein Eigentum mehr preis', async () => {
  // Ohne vorheriges Lesen/Existieren darf niemand den Besitz ausnutzen.
  const attacker = ctx({ uid: 'attacker-1' });
  await assertFails(updateDoc(doc(attacker, 'routes', 'ghost'), { title: 'Übernommen' }));
  await assertFails(deleteDoc(doc(attacker, 'routes', 'ghost')));
});

test('Gesperrte Nutzer werden auch bei inhaltlich passendem UID-Feld abgewiesen', async () => {
  // Die Sperrliste ist für Clients gesperrt, daher mit deaktivierter
  // Regelprüfung (Admin-Kontext) vorbereiten.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const { doc: adminDoc, setDoc: adminSetDoc } = await import('firebase/firestore');
    await adminSetDoc(adminDoc(context.firestore(), 'suspended_users', 'blocked-1'), {
      suspendedAt: new Date().toISOString(),
      reason: 'Test',
    });
  });

  const suspended = ctx({ uid: 'blocked-1' });
  await assertFails(
    setDoc(doc(suspended, 'charging_stations', 'st-2'), {
      name: 'Von gesperrtem Nutzer',
      createdByUserId: 'blocked-1',
    })
  );

  // Öffentliches Lesen der Ladeinfrastruktur bleibt auch für gesperrte
  // Nutzer möglich (sie können nur nicht selbst schreiben).
  await assertFails(
    setDoc(doc(suspended, 'content_reports', 'rep-blocked'), { reason: 'spam' })
  );
});

test('Fremde Konten sind strikt isoliert', async () => {
  const alice = ctx({ uid: 'alice' });
  const mallory = ctx({ uid: 'mallory' });

  await assertSucceeds(setDoc(doc(alice, 'user_preferences', 'alice'), { bikeType: 'ebike' }));
  await assertFails(getDoc(doc(mallory, 'user_preferences', 'alice')));
  await assertFails(updateDoc(doc(mallory, 'user_preferences', 'alice'), { bikeType: 'cargo' }));
  await assertFails(deleteDoc(doc(mallory, 'user_tokens', 'alice')));
});

test('Ladesäulen bleiben öffentlich lesbar (gemeinnützige Infrastruktur)', async () => {
  const db = ctx();
  const owner = ctx({ uid: 'owner-2' });
  await assertSucceeds(
    setDoc(doc(owner, 'charging_stations_v2', 'st-3'), {
      name: 'Öffentlich',
      createdByUserId: 'owner-2',
    })
  );
  await assertSucceeds(getDocs(collection(db, 'charging_stations_v2')));
});

test('Content-Reports können gemeldet, aber nicht gelesen oder gelöscht werden', async () => {
  const reporter = ctx({ uid: 'reporter-1' });
  const reportRef = doc(reporter, 'content_reports', 'rep-1');

  await assertSucceeds(setDoc(reportRef, { contentType: 'station', reason: 'spam' }));
  await assertFails(getDoc(reportRef));
  await assertFails(deleteDoc(reportRef));
});

test('Partner-Leads sind nur eingehend beschreibbar', async () => {
  const user = ctx({ uid: 'biz-1' });
  await assertSucceeds(addDoc(collection(user, 'partner_leads'), { businessName: 'B' }));
  await assertFails(getDocs(collection(user, 'partner_leads')));
});

test('Unbehandelte Pfade bleiben gesperrt', async () => {
  const user = ctx({ uid: 'u-1' });
  await assertFails(setDoc(doc(user, 'irgendwas', 'x'), { a: 1 }));
});
