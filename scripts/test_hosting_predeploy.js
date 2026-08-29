import fs from 'fs';
import path from 'path';

console.log('🌐 ========================================================');
console.log('🌐 FIREBASE HOSTING STATIC ASSETS PRE-DEPLOY AUDIT');
console.log('🌐 ========================================================');

const files = [
  'public/privacy.html',
  'public/account-deletion.html'
];

for (const relPath of files) {
  const fullPath = path.resolve(process.cwd(), relPath);
  console.log(`\nAuditing ${relPath}...`);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ FAIL: File ${relPath} not found!`);
    process.exit(1);
  }

  const html = fs.readFileSync(fullPath, 'utf8');

  // Check 1: App Name
  if (!html.includes('Der Wegweiser')) {
    console.error(`❌ FAIL: App name "Der Wegweiser" not found in ${relPath}!`);
    process.exit(1);
  }
  console.log('  ✅ PASS: App name "Der Wegweiser" present.');

  // Check 2: Responsive viewport meta
  if (!html.includes('<meta name="viewport"')) {
    console.error(`❌ FAIL: Viewport meta tag missing for mobile rendering in ${relPath}!`);
    process.exit(1);
  }
  console.log('  ✅ PASS: Mobile viewport meta tag configured.');

  // Check 3: Zero dev/localhost URLs
  if (html.includes('localhost') || html.includes('127.0.0.1') || html.includes('10.0.2.2')) {
    console.error(`❌ FAIL: Development URL (localhost/127.0.0.1) found in ${relPath}!`);
    process.exit(1);
  }
  console.log('  ✅ PASS: Zero localhost / dev URLs.');

  // Check 4: Zero Secrets / Private Keys
  if (html.includes('AIzaSy') || html.includes('private_key') || html.includes('sk_live')) {
    console.error(`❌ FAIL: Suspected API Secret found in ${relPath}!`);
    process.exit(1);
  }
  console.log('  ✅ PASS: Zero hardcoded API keys or private credentials.');

  // Check 5: UTF-8 & Semantic Structure
  if (!html.includes('<!DOCTYPE html>') || !html.includes('charset="UTF-8"')) {
    console.error(`❌ FAIL: HTML5 doctype or UTF-8 charset missing in ${relPath}!`);
    process.exit(1);
  }
  console.log('  ✅ PASS: Valid HTML5 & UTF-8 structure.');
}

console.log('\n========================================================');
console.log('✅ ALL HOSTING PRE-DEPLOY CHECKS PASSED (10/10)');
console.log('========================================================\n');
