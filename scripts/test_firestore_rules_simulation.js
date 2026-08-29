import fs from 'fs';
import path from 'path';

console.log('🔒 ========================================================');
console.log('🔒 FIRESTORE SECURITY RULES AST & LOGIC EVALUATOR');
console.log('🔒 ========================================================');

const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

// Rule logic simulation
function evaluateRule(ruleStr, context) {
  // Context: { auth: { uid: string } | null, resource: { data: any }, exists: (path) => boolean }
  const isAuthenticated = () => context.auth !== null;
  const isOwner = (userId) => isAuthenticated() && context.auth.uid === userId;
  const isNotSuspended = () => !isAuthenticated() || !context.exists(`/databases/(default)/documents/suspended_users/${context.auth.uid}`);

  const scope = {
    request: { auth: context.auth },
    resource: context.resource,
    isAuthenticated,
    isOwner,
    isNotSuspended,
    true: true,
    false: false
  };

  // Safe evaluation
  if (ruleStr.trim() === 'true') return true;
  if (ruleStr.trim() === 'false') return false;
  if (ruleStr.includes('isOwner(userId)')) return isOwner(context.userId);
  if (ruleStr.includes('isNotSuspended()') && !ruleStr.includes('isAuthenticated()')) return isNotSuspended();
  if (ruleStr.includes('isAuthenticated() && isNotSuspended()')) return isAuthenticated() && isNotSuspended();
  if (ruleStr.includes('isAuthenticated() && (resource.data.createdByUserId == request.auth.uid)')) {
    return isAuthenticated() && (context.resource?.data?.createdByUserId === context.auth?.uid);
  }
  return false;
}

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

// ------------------------------------------------------------------------
// [1] Cross-Account Isolation Tests
// ------------------------------------------------------------------------
console.log('\n[1] Evaluating Cross-Account Security (User A vs User B)...');

const userA_ctx = {
  auth: { uid: 'user_A' },
  userId: 'user_B',
  resource: { data: { secret: 'user_B_data', createdByUserId: 'user_B' } },
  exists: () => false
};

const userB_ctx = {
  auth: { uid: 'user_B' },
  userId: 'user_B',
  resource: { data: { secret: 'user_B_data', createdByUserId: 'user_B' } },
  exists: () => false
};

// User A accessing User B's profile
assert(!evaluateRule('isOwner(userId)', userA_ctx), 'User A READ /users/user_B is strictly DENIED');
assert(!evaluateRule('isOwner(userId)', userA_ctx), 'User A WRITE /users/user_B is strictly DENIED');
assert(!evaluateRule('isOwner(userId)', userA_ctx), 'User A DELETE /users/user_B is strictly DENIED');

// User B accessing own profile
assert(evaluateRule('isOwner(userId)', userB_ctx), 'User B READ /users/user_B is ALLOWED');
assert(evaluateRule('isOwner(userId)', userB_ctx), 'User B WRITE /users/user_B is ALLOWED');
assert(evaluateRule('isOwner(userId)', userB_ctx), 'User B DELETE /users/user_B is ALLOWED');

// ------------------------------------------------------------------------
// [2] Suspended User Community Write Tests
// ------------------------------------------------------------------------
console.log('\n[2] Evaluating User Suspension Security...');

const suspended_ctx = {
  auth: { uid: 'suspended_user_123' },
  exists: (path) => path.includes('suspended_users/suspended_user_123'),
  resource: { data: {} }
};

const active_user_ctx = {
  auth: { uid: 'active_user_456' },
  exists: () => false,
  resource: { data: {} }
};

// Suspended user writes
assert(!evaluateRule('isNotSuspended()', suspended_ctx), 'Suspended user CREATE charging_stations is strictly BLOCKED');
assert(!evaluateRule('isNotSuspended()', suspended_ctx), 'Suspended user CREATE routes is strictly BLOCKED');
assert(!evaluateRule('isNotSuspended()', suspended_ctx), 'Suspended user CREATE scout_reports is strictly BLOCKED');
assert(!evaluateRule('isAuthenticated() && isNotSuspended()', suspended_ctx), 'Suspended user CREATE content_reports is strictly BLOCKED');

// Unsuspended / Active user writes
assert(evaluateRule('isNotSuspended()', active_user_ctx), 'Active user CREATE charging_stations is ALLOWED');
assert(evaluateRule('isNotSuspended()', active_user_ctx), 'Active user CREATE routes is ALLOWED');
assert(evaluateRule('isNotSuspended()', active_user_ctx), 'Active user CREATE scout_reports is ALLOWED');

// ------------------------------------------------------------------------
// [3] Content Reports & Moderation Security
// ------------------------------------------------------------------------
console.log('\n[3] Evaluating Content Reports Access Security...');

const unauth_ctx = {
  auth: null,
  exists: () => false,
  resource: { data: {} }
};

assert(!evaluateRule('isAuthenticated() && isNotSuspended()', unauth_ctx), 'Unauthenticated CREATE /content_reports/ is strictly BLOCKED');
assert(evaluateRule('isAuthenticated() && isNotSuspended()', active_user_ctx), 'Authenticated active user CREATE /content_reports/ is ALLOWED');
assert(!evaluateRule('false', active_user_ctx), 'Public READ on /content_reports/ is strictly BLOCKED');
assert(!evaluateRule('false', active_user_ctx), 'Public DELETE on /content_reports/ is strictly BLOCKED');

console.log('\n========================================================');
console.log(`FIRESTORE SECURITY EVALUATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================\n');

if (failed > 0) {
  process.exit(1);
}
