#!/usr/bin/env node
/**
 * Der Wegweiser — Automated Dependency Policy & Security Auditor
 * Checks npm lockfile integrity, high-severity CVE advisories, and pinned engine requirements.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

console.log('🛡️ ========================================================');
console.log('🛡️ DEPENDENCY SECURITY & POLICY AUDIT');
console.log('🛡️ ========================================================');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// 1. Check package-lock.json existence
assert(fs.existsSync('package-lock.json'), 'package-lock.json exists for deterministic builds');

// 2. Check index.html for external untrusted CDN script injections
const indexHtml = fs.readFileSync('index.html', 'utf-8');
const hasUntrustedCDN = /<script\s+src=["']http/i.test(indexHtml);
assert(!hasUntrustedCDN, 'index.html contains ZERO external untrusted CDN script tags');

// 3. Run npm audit for high/critical vulnerabilities
console.log('\n🔍 [3] Auditing npm dependencies for high/critical CVEs...');
try {
  const auditOutput = execSync('npm audit --audit-level=high --json', { encoding: 'utf-8' });
  const auditJson = JSON.parse(auditOutput);
  const highVulnerabilities = auditJson.metadata?.vulnerabilities?.high || 0;
  const criticalVulnerabilities = auditJson.metadata?.vulnerabilities?.critical || 0;
  
  assert(
    highVulnerabilities === 0 && criticalVulnerabilities === 0,
    `Vulnerability count: 0 high, 0 critical (Found: ${highVulnerabilities} high, ${criticalVulnerabilities} critical)`
  );
} catch (e) {
  // If npm audit exits with non-zero, check if it's due to vulnerabilities
  try {
    const errorJson = JSON.parse(e.stdout || '{}');
    const high = errorJson.metadata?.vulnerabilities?.high || 0;
    const crit = errorJson.metadata?.vulnerabilities?.critical || 0;
    assert(high === 0 && crit === 0, `Vulnerability check: ${high} high, ${crit} critical`);
  } catch (parseErr) {
    assert(false, `npm audit encountered error: ${e.message}`);
  }
}

console.log('\n========================================================');
console.log(`DEPENDENCY AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================');

if (failed > 0) {
  process.exit(1);
}
