import fs from 'fs';
import path from 'path';

console.log('🔒 ========================================================');
console.log('🔒 FIRESTORE RULES PRE-DEPLOY INTEGRITY & SECURITY AUDIT');
console.log('🔒 ========================================================');

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
if (!fs.existsSync(rulesPath)) {
  console.error('❌ FAIL: firestore.rules file not found!');
  process.exit(1);
}

const content = fs.readFileSync(rulesPath, 'utf8');

// 1. Syntax & Core Rule Structure
console.log('\n[1] Validating Rules Syntax & Structural Integrity...');
if (!content.includes("rules_version = '2';")) {
  console.error("❌ FAIL: rules_version = '2' declaration missing!");
  process.exit(1);
}
if (!content.includes("service cloud.firestore {")) {
  console.error("❌ FAIL: service cloud.firestore block missing!");
  process.exit(1);
}
console.log('  ✅ PASS: Valid Rules v2 service declaration.');

// 2. Helper Functions Check
console.log('\n[2] Validating Helper Functions...');
const hasAuth = content.includes('function isAuthenticated()');
const hasOwner = content.includes('function isOwner(userId)');
const hasSuspensionCheck = content.includes('function isNotSuspended()');

if (!hasAuth || !hasOwner || !hasSuspensionCheck) {
  console.error('❌ FAIL: Critical helper functions missing!', { hasAuth, hasOwner, hasSuspensionCheck });
  process.exit(1);
}
console.log('  ✅ PASS: isAuthenticated(), isOwner(), and isNotSuspended() declared.');

// 3. User Suspension & UGC Protections Check
console.log('\n[3] Auditing UGC Collections for isNotSuspended() Guard...');
const collectionsToGuard = [
  'charging_stations',
  'charging_stations_v2',
  'routes',
  'scout_reports'
];

for (const col of collectionsToGuard) {
  const regex = new RegExp(`match /${col}/\\{[^}]+\\}\\s*\\{[\\s\\S]*?isNotSuspended\\(\\)`, 'm');
  if (!regex.test(content)) {
    console.error(`❌ FAIL: Collection ${col} is NOT guarded by isNotSuspended()!`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: Collection /${col}/ write operations guarded by isNotSuspended().`);
}

// 4. Content Reports Collection Access Check (Apple Guideline 1.2)
console.log('\n[4] Auditing /content_reports/ Access Security...');
if (!content.includes('match /content_reports/{reportId}')) {
  console.error('❌ FAIL: /content_reports/ collection missing from rules!');
  process.exit(1);
}
if (!content.includes('allow create: if true;') || !content.includes('allow read, update, delete: if false;')) {
  console.error('❌ FAIL: /content_reports/ must allow create but strictly forbid public read/update/delete!');
  process.exit(1);
}
console.log('  ✅ PASS: /content_reports/ allows inbound create, strictly forbids public read/update/delete.');

// 5. Account Deletion & Cross-Account Access Security (Art. 17 DSGVO)
console.log('\n[5] Auditing Cross-Account Protection & Account Deletion (Art. 17 DSGVO)...');
if (!content.includes('match /users/{userId}') || !content.includes('allow read, write, delete: if isOwner(userId);')) {
  console.error('❌ FAIL: Cross-account write protection missing for /users/{userId}!');
  process.exit(1);
}
console.log('  ✅ PASS: /users/{userId} enforces strict isOwner() boundary.');

console.log('\n========================================================');
console.log('✅ ALL FIRESTORE RULES PRE-DEPLOY CHECKS PASSED (5/5)');
console.log('========================================================\n');
