#!/usr/bin/env node
/**
 * Unified 5-Stage Verification Gate for Claude Cloud Workflow
 * Der Wegweiser — V2 Finalization Gatekeeper
 * 
 * Verifies that all 5 critical quality and security gates pass with 0 errors:
 *  Stage 1: Secret & Credential Scan (scripts/scan_secrets.js)
 *  Stage 2: Design Token & CSS Sync (scripts/sync_tokens.mjs --check)
 *  Stage 3: Code Linting & Static Analysis (npm run lint / Oxlint)
 *  Stage 4: TypeScript & Production Build (npm run build)
 *  Stage 5: 15 Android Scenarios (test:scenarios) & Firestore Security Rules (test:rules)
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const stages = [
  {
    name: 'Gate 1: Secret & Credential Scanner',
    cmd: 'node',
    args: ['scripts/scan_secrets.js'],
  },
  {
    name: 'Gate 2: Design Token & CSS Synchronicity',
    cmd: 'node',
    args: ['scripts/sync_tokens.mjs', '--check'],
  },
  {
    name: 'Gate 3: Oxlint Code Quality & Hygiene',
    cmd: 'npm',
    args: ['run', 'lint'],
  },
  {
    name: 'Gate 4: TypeScript Compilation & Vite Production Build',
    cmd: 'npm',
    args: ['run', 'build'],
  },
  {
    name: 'Gate 5a: 15 Android Mission-Critical Scenarios (51/51)',
    cmd: 'npm',
    args: ['run', 'test:scenarios'],
  },
  {
    name: 'Gate 5b: Cloud Firestore Security Rules (11/11)',
    cmd: 'npm',
    args: ['run', 'test:rules'],
  },
];

console.log('🛡️ ========================================================');
console.log('🛡️ DER WEGWEISER — CLAUDE V2 CLOUD WORKFLOW GATEKEEPER');
console.log('🛡️ ========================================================\n');

let allPassed = true;
const results = [];

for (const stage of stages) {
  console.log(`▶️ Executing [${stage.name}]...`);
  const startTime = Date.now();
  const res = spawnSync(stage.cmd, stage.args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  if (res.status === 0) {
    console.log(`✅ [${stage.name}] PASSED (${durationSec}s)\n`);
    results.push({ name: stage.name, status: 'PASS', duration: `${durationSec}s` });
  } else {
    console.error(`❌ [${stage.name}] FAILED with exit code ${res.status} (${durationSec}s)\n`);
    results.push({ name: stage.name, status: 'FAIL', code: res.status, duration: `${durationSec}s` });
    allPassed = false;
    break; // Stop at first failing gate
  }
}

console.log('========================================================');
console.log('📊 GATE EXECUTION SUMMARY:');
console.log('========================================================');
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : '❌';
  console.log(` ${icon} ${r.name.padEnd(60)} : ${r.status} (${r.duration})`);
}

if (!allPassed) {
  console.error('\n🚫 GATE REJECTED: One or more gates failed. Push blocked.');
  process.exit(1);
}

console.log('\n🎉 ALL GATES VERIFIED 100% CLEAN! Ready for branch push and PR creation.');
process.exit(0);
