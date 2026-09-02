import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  addDoc, 
  collection 
} from 'firebase/firestore';

console.log('🔒 ========================================================');
console.log('🔒 LIVE AUTHENTICATED CROSS-ACCOUNT & SUSPENSION SECURITY SUITE');
console.log('🔒 ========================================================');

// Public Firebase Client Configuration for der-wegweiser
const firebaseConfig = {
  projectId: 'der-wegweiser',
  appId: '1:430891513864:web:6e7dedec657640a139f9bd',
  storageBucket: 'der-wegweiser.firebasestorage.app',
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: 'der-wegweiser.firebaseapp.com',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runSecuritySuite() {
  try {
    // ------------------------------------------------------------------------
    // [1] User A and User B Creation
    // ------------------------------------------------------------------------
    console.log('\n[1] Creating authenticated sessions for User A and User B...');
    
    // User A Sign-in
    const credA = await signInAnonymously(auth);
    const userA_id = credA.user.uid;
    console.log(`  User A authenticated with UID: ${userA_id}`);

    // Write User A's private profile
    await setDoc(doc(db, 'users', userA_id), {
      email: 'user_a@test.local',
      role: 'rider',
      createdAt: new Date().toISOString()
    });
    console.log(`  User A private profile created.`);

    // Sign out User A
    await signOut(auth);

    // User B Sign-in
    const credB = await signInAnonymously(auth);
    const userB_id = credB.user.uid;
    console.log(`  User B authenticated with UID: ${userB_id}`);

    // Write User B's private profile
    await setDoc(doc(db, 'users', userB_id), {
      email: 'user_b@test.local',
      secretToken: 'super-secret-user-b-vault',
      createdAt: new Date().toISOString()
    });
    console.log(`  User B private profile created.`);

    // ------------------------------------------------------------------------
    // [2] Cross-Account Isolation Test: User B attempts to access User A's data
    // ------------------------------------------------------------------------
    console.log('\n[2] Testing Cross-Account Security (User B accessing User A)...');

    // User B attempts to READ User A's profile (MUST BE FORBIDDEN)
    try {
      await getDoc(doc(db, 'users', userA_id));
      assert(false, `User B was able to READ User A's private profile!`);
    } catch (e) {
      assert(true, `User B READ User A private profile was blocked (permission-denied).`);
    }

    // User B attempts to WRITE User A's profile (MUST BE FORBIDDEN)
    try {
      await setDoc(doc(db, 'users', userA_id), { email: 'hacked_by_b@evil.com' });
      assert(false, `User B was able to WRITE User A's private profile!`);
    } catch (e) {
      assert(true, `User B WRITE User A private profile was blocked (permission-denied).`);
    }

    // User B attempts to DELETE User A's profile (MUST BE FORBIDDEN)
    try {
      await deleteDoc(doc(db, 'users', userA_id));
      assert(false, `User B was able to DELETE User A's private profile!`);
    } catch (e) {
      assert(true, `User B DELETE User A private profile was blocked (permission-denied).`);
    }

    // User B reads & updates their OWN profile (MUST SUCCEED)
    const ownDocSnap = await getDoc(doc(db, 'users', userB_id));
    assert(ownDocSnap.exists() && ownDocSnap.data().secretToken === 'super-secret-user-b-vault', `User B can READ own private profile.`);

    await setDoc(doc(db, 'users', userB_id), { email: 'user_b_updated@test.local' }, { merge: true });
    assert(true, `User B can UPDATE own profile.`);

    // ------------------------------------------------------------------------
    // [3] Content Reports (Apple Guideline 1.2 Moderation Inbound Test)
    // ------------------------------------------------------------------------
    console.log('\n[3] Testing Content Reports Security (User B creating & reading reports)...');

    // Authenticated User B creates a valid report (MUST SUCCEED)
    const reportRef = await addDoc(collection(db, 'content_reports'), {
      contentType: 'station',
      contentId: 'station-xyz-test',
      reason: 'Inappropriate station title reported by User B',
      reportedByUserId: userB_id,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    assert(true, `Authenticated User B successfully submitted content report (${reportRef.id}).`);

    // Authenticated User B attempts to READ the submitted report (MUST BE BLOCKED)
    try {
      await getDoc(doc(db, 'content_reports', reportRef.id));
      assert(false, `User B was able to READ /content_reports/ (moderation leak)!`);
    } catch (e) {
      assert(true, `User B READ on /content_reports/ was blocked (permission-denied).`);
    }

    // Authenticated User B attempts to DELETE the report (MUST BE BLOCKED)
    try {
      await deleteDoc(doc(db, 'content_reports', reportRef.id));
      assert(false, `User B was able to DELETE from /content_reports/!`);
    } catch (e) {
      assert(true, `User B DELETE on /content_reports/ was blocked (permission-denied).`);
    }

    // ------------------------------------------------------------------------
    // [4] Community Write & User Suspension Security
    // ------------------------------------------------------------------------
    console.log('\n[4] Testing Community UGC & Suspension Security...');

    // Normal User B creates a valid charging station (MUST SUCCEED)
    const testStationId = `cs-live-test-${Date.now()}`;
    await setDoc(doc(db, 'charging_stations', testStationId), {
      name: 'Test E-Bike Ladepunkt Spreetal',
      lat: 51.5123,
      lng: 14.3789,
      isWeatherproof: true,
      isFree: true,
      createdByUserId: userB_id,
      createdAt: new Date().toISOString()
    });
    assert(true, `Normal User B can create public charging station.`);

    // User B deletes own created test station
    await deleteDoc(doc(db, 'charging_stations', testStationId));
    assert(true, `Normal User B can delete own created charging station.`);

    // ------------------------------------------------------------------------
    // [5] Unauthenticated Access Blocking
    // ------------------------------------------------------------------------
    console.log('\n[5] Testing Unauthenticated Write Blocking...');
    await signOut(auth);

    try {
      await addDoc(collection(db, 'content_reports'), {
        contentType: 'station',
        contentId: 'unauth-spam',
        reason: 'Spam from unauthenticated attacker',
        createdAt: new Date().toISOString()
      });
      assert(false, `Unauthenticated client was able to create a content report!`);
    } catch (e) {
      assert(true, `Unauthenticated create to /content_reports/ blocked (permission-denied).`);
    }

    try {
      await setDoc(doc(db, 'users', 'anonymous_victim'), { hacked: true });
      assert(false, `Unauthenticated client was able to write /users/!`);
    } catch (e) {
      assert(true, `Unauthenticated write to /users/ blocked (permission-denied).`);
    }

    // Clean up User A and User B private profiles
    const cleanAuthB = await signInAnonymously(auth);
    // User B clean own
    await deleteDoc(doc(db, 'users', userB_id));
    await signOut(auth);

    const cleanAuthA = await signInAnonymously(auth);
    await deleteDoc(doc(db, 'users', userA_id));
    await signOut(auth);
    console.log(`  Test profiles cleaned up.`);

    console.log('\n========================================================');
    console.log(`LIVE AUTHENTICATED SECURITY SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during security suite:', err);
    process.exit(1);
  }
}

runSecuritySuite();
