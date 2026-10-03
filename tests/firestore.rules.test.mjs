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

  // user_preferences
  await assertSucceeds(setDoc(doc(alice, 'user_preferences', 'alice'), { bikeType: 'ebike' }));
  await assertFails(getDoc(doc(mallory, 'user_preferences', 'alice')));
  await assertFails(updateDoc(doc(mallory, 'user_preferences', 'alice'), { bikeType: 'cargo' }));

  // users collection isolation
  await assertSucceeds(setDoc(doc(alice, 'users', 'alice'), { name: 'Alice' }));
  await assertSucceeds(getDoc(doc(alice, 'users', 'alice')));
  await assertSucceeds(updateDoc(doc(alice, 'users', 'alice'), { name: 'Alice 2' }));

  await assertFails(setDoc(doc(mallory, 'users', 'alice'), { name: 'Mallory' }));
  await assertFails(getDoc(doc(mallory, 'users', 'alice')));
  await assertFails(updateDoc(doc(mallory, 'users', 'alice'), { name: 'Mallory 2' }));
  await assertFails(deleteDoc(doc(mallory, 'users', 'alice')));
  await assertSucceeds(deleteDoc(doc(alice, 'users', 'alice')));

  // user_tokens collection isolation
  await assertSucceeds(setDoc(doc(alice, 'user_tokens', 'alice'), { token: 'abc' }));
  await assertSucceeds(getDoc(doc(alice, 'user_tokens', 'alice')));
  await assertSucceeds(updateDoc(doc(alice, 'user_tokens', 'alice'), { token: 'def' }));

  await assertFails(setDoc(doc(mallory, 'user_tokens', 'alice'), { token: 'xyz' }));
  await assertFails(getDoc(doc(mallory, 'user_tokens', 'alice')));
  await assertFails(updateDoc(doc(mallory, 'user_tokens', 'alice'), { token: 'xyz' }));
  await assertFails(deleteDoc(doc(mallory, 'user_tokens', 'alice')));
  await assertSucceeds(deleteDoc(doc(alice, 'user_tokens', 'alice')));
});

test('Ladesäulen bleiben öffentlich lesbar (gemeinnützige Infrastruktur)', async () => {
  const db = ctx();
  const owner = ctx({ uid: 'owner-2' });
  const attacker = ctx({ uid: 'attacker-2' });

  await assertSucceeds(
    setDoc(doc(owner, 'charging_stations_v2', 'st-3'), {
      name: 'Öffentlich',
      createdByUserId: 'owner-2',
    })
  );
  await assertSucceeds(getDocs(collection(db, 'charging_stations_v2')));

  // Update / Delete checks for charging_stations_v2
  await assertFails(
    updateDoc(doc(attacker, 'charging_stations_v2', 'st-3'), { name: 'Gehackt' })
  );
  await assertFails(deleteDoc(doc(attacker, 'charging_stations_v2', 'st-3')));

  await assertSucceeds(updateDoc(doc(owner, 'charging_stations_v2', 'st-3'), { name: 'Aktualisiert' }));
  await assertSucceeds(deleteDoc(doc(owner, 'charging_stations_v2', 'st-3')));
});

test('Scout Reports (Community-Ladeinfrastruktur) sind öffentlich lesbar, aber nur vom Ersteller änderbar', async () => {
  const db = ctx();
  const owner = ctx({ uid: 'scout-1' });
  const attacker = ctx({ uid: 'attacker-3' });

  // Create
  await assertSucceeds(
    setDoc(doc(owner, 'scout_reports', 'rep-1'), {
      status: 'working',
      createdByUserId: 'scout-1',
    })
  );
  // Read
  await assertSucceeds(getDoc(doc(db, 'scout_reports', 'rep-1')));
  await assertSucceeds(getDocs(collection(db, 'scout_reports')));

  // Update/Delete by non-creator
  await assertFails(
    updateDoc(doc(attacker, 'scout_reports', 'rep-1'), { status: 'broken' })
  );
  await assertFails(deleteDoc(doc(attacker, 'scout_reports', 'rep-1')));

  // Update/Delete by creator
  await assertSucceeds(updateDoc(doc(owner, 'scout_reports', 'rep-1'), { status: 'maintenance' }));
  await assertSucceeds(deleteDoc(doc(owner, 'scout_reports', 'rep-1')));
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
  const leadRef = doc(user, 'partner_leads', 'lead-1');

  await assertSucceeds(setDoc(leadRef, { businessName: 'B' }));
  await assertFails(getDoc(leadRef));
  await assertFails(getDocs(collection(user, 'partner_leads')));
  await assertFails(updateDoc(leadRef, { businessName: 'C' }));
  await assertFails(deleteDoc(leadRef));
});

test('Fehlende oder interne Collections (b2b_sponsors, crowd_segments, app_config) sind standardmäßig gesperrt', async () => {
  const db = ctx();
  const user = ctx({ uid: 'u-admin' });

  for (const collectionName of ['b2b_sponsors', 'crowd_segments', 'app_config']) {
    const docRefAnon = doc(db, collectionName, 'doc-1');
    await assertFails(getDoc(docRefAnon));
    await assertFails(setDoc(docRefAnon, { test: 1 }));

    const docRefUser = doc(user, collectionName, 'doc-1');
    await assertFails(getDoc(docRefUser));
    await assertFails(setDoc(docRefUser, { test: 1 }));
    await assertFails(updateDoc(docRefUser, { test: 2 }));
    await assertFails(deleteDoc(docRefUser));
  }
});

test('Unbehandelte Pfade bleiben gesperrt', async () => {
  const user = ctx({ uid: 'u-1' });
  await assertFails(setDoc(doc(user, 'irgendwas', 'x'), { a: 1 }));
});
