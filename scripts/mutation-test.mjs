#!/usr/bin/env node
/**
 * Custom mutation testing script for critical paths.
 * Bypasses @stryker-mutator/vitest-runner Vitest-5 incompatibility.
 *
 * Targets:
 *   coPilotService.ts  — goal: ≥80% mutation score
 *   PremiumKeyService.ts — goal: ≥95% mutation score (security-critical)
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';

function runTests(testFile) {
  try {
    execSync(
      `npx vitest run ${testFile} --config vitest.config.ts`,
      { stdio: 'pipe', cwd: process.cwd(), timeout: 20000 },
    );
    return true;  // tests passed → mutant survived
  } catch (err) {
    // timeout (ETIMEDOUT/SIGTERM) → treat as survived (test hung = infinite loop = mutant survived)
    if (err.code === 'ETIMEDOUT' || err.signal === 'SIGTERM' || err.killed) {
      return true;
    }
    return false; // tests failed  → mutant killed
  }
}

function applyMutationByReplacement(src, from, to, occurrence = 0) {
  let count = 0;
  return src.replace(new RegExp(escapeRe(from), 'g'), (match) => {
    return count++ === occurrence ? to : match;
  });
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function testMutations(label, filePath, testFile, mutations) {
  const original = readFileSync(filePath, 'utf8');
  let killed = 0;
  let survived = 0;
  const survivors = [];

  // Ensure the source file is always restored on SIGTERM/SIGINT
  const restore = () => { try { writeFileSync(filePath, original); } catch {} };
  process.once('SIGTERM', () => { restore(); process.exit(130); });
  process.once('SIGINT',  () => { restore(); process.exit(130); });

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${YELLOW}▶ ${label}${RESET}  (${mutations.length} mutants)`);
  console.log(`${'─'.repeat(60)}`);

  for (const { from, to, desc, occurrence = 0, skip } of mutations) {
    if (skip) {
      console.log(`  ${YELLOW}[SKIP]${RESET}  ${desc}  — marked skip (equivalent/untestable)`);
      continue;
    }
    const mutated = applyMutationByReplacement(original, from, to, occurrence);
    if (mutated === original) {
      console.log(`  ${YELLOW}[SKIP]${RESET}  ${desc}  — pattern not found`);
      continue;
    }

    writeFileSync(filePath, mutated);
    const survived_ = runTests(testFile);

    if (survived_) {
      survived++;
      survivors.push({ desc, from, to });
      console.log(`  ${RED}[SURVIVED]${RESET}  ${desc}`);
    } else {
      killed++;
      console.log(`  ${GREEN}[KILLED]${RESET}   ${desc}`);
    }

    writeFileSync(filePath, original); // restore
  }

  const total = killed + survived;
  const score = total === 0 ? 0 : Math.round((killed / total) * 100);

  console.log(`\n  Score: ${killed}/${total} (${score}%)`);
  if (survivors.length > 0) {
    console.log(`  Surviving mutants:`);
    for (const s of survivors) {
      console.log(`    • ${s.desc}  [${s.from}] → [${s.to}]`);
    }
  }
  return { killed, total, score, survivors };
}

// ─── CoPilotService mutations ──────────────────────────────────────────────

const coPilotMutations = [
  // isActive guard
  { from: 'if (!isActive) return;', to: 'if (true) return;',   desc: 'isActive guard → always return' },
  { from: 'if (!isActive) return;', to: '/* removed */',        desc: 'isActive guard → remove' },

  // isConnected guard
  { from: 'if (!telemetry.isConnected) return;', to: '/* removed */', desc: 'isConnected guard → remove' },

  // batteryPercent null check
  { from: "if (pct === null) return;", to: "if (false) return;", desc: 'pct null check → false' },

  // battery_10 threshold
  { from: 'if (pct <= 10) {', to: 'if (pct < 10) {',   desc: 'battery_10: <= 10 → < 10' },
  { from: 'if (pct <= 10) {', to: 'if (pct > 10) {',   desc: 'battery_10: <= 10 → > 10' },
  { from: 'if (pct <= 10) {', to: 'if (pct <= 20) {',  desc: 'battery_10: <= 10 → <= 20 (threshold shift)' },
  { from: 'if (pct <= 10) {', to: 'if (false) {',      desc: 'battery_10: condition → false' },

  // battery_10 canWarn branch
  { from: "if (canWarn('battery_10')) {", to: "if (true) {", desc: 'canWarn battery_10 → true' },
  { from: "if (canWarn('battery_10')) {", to: "if (false) {", desc: 'canWarn battery_10 → false' },

  // markWarned calls in battery_10 block
  { from: "markWarned('battery_10');", to: '/* removed */', desc: 'markWarned battery_10 → remove' },
  { from: "markWarned('battery_20'); // battery_10 supersedes battery_20", to: '/* removed */', desc: 'markWarned battery_20 (in battery_10 block) → remove' },

  // speak in battery_10 block
  { from: "speak(`Warnung! Akku kritisch bei ${pct} Prozent. ${advice}`);", to: '/* removed */', desc: 'speak battery_10 → remove' },

  // Always-return for battery_10
  { from: '      return; // always skip battery_20 check when pct ≤ 10', to: '/* removed */', desc: 'battery_10 early return → remove' },

  // battery_20 threshold
  { from: 'if (pct <= 20 && canWarn(\'battery_20\')) {', to: "if (pct < 20 && canWarn('battery_20')) {",  desc: 'battery_20: <= 20 → < 20' },
  { from: 'if (pct <= 20 && canWarn(\'battery_20\')) {', to: "if (pct > 20 && canWarn('battery_20')) {",  desc: 'battery_20: <= 20 → > 20' },
  { from: 'if (pct <= 20 && canWarn(\'battery_20\')) {', to: "if (false) {",  desc: 'battery_20: condition → false' },

  // canWarn battery_20
  { from: "pct <= 20 && canWarn('battery_20')", to: "pct <= 20 && true", desc: 'canWarn battery_20 → true' },
  { from: "pct <= 20 && canWarn('battery_20')", to: "pct <= 20 && false", desc: 'canWarn battery_20 → false' },

  // markWarned battery_20
  { from: "markWarned('battery_20');", to: '/* removed */', desc: 'markWarned battery_20 → remove', occurrence: 1 },

  // speak in battery_20 block
  { from: "speak(`Hinweis: Akku bei ${pct} Prozent. ${advice}`);", to: '/* removed */', desc: 'speak battery_20 → remove' },

  // WARN_COOLDOWN_MS in canWarn
  { from: 'return Date.now() - last > WARN_COOLDOWN_MS;', to: 'return Date.now() - last >= WARN_COOLDOWN_MS;', desc: 'canWarn: > COOLDOWN → >= COOLDOWN' },
  { from: 'return Date.now() - last > WARN_COOLDOWN_MS;', to: 'return Date.now() - last < WARN_COOLDOWN_MS;',  desc: 'canWarn: > COOLDOWN → < COOLDOWN (flip)' },
  { from: 'return Date.now() - last > WARN_COOLDOWN_MS;', to: 'return true;', desc: 'canWarn → always true' },
  { from: 'return Date.now() - last > WARN_COOLDOWN_MS;', to: 'return false;', desc: 'canWarn → always false' },

  // GEMINI_RATE_LIMIT in canCallGemini
  { from: 'return Date.now() - lastGeminiAt > GEMINI_RATE_LIMIT_MS;', to: 'return Date.now() - lastGeminiAt >= GEMINI_RATE_LIMIT_MS;', desc: 'canCallGemini: > → >= RATE_LIMIT' },
  { from: 'return Date.now() - lastGeminiAt > GEMINI_RATE_LIMIT_MS;', to: 'return Date.now() - lastGeminiAt < GEMINI_RATE_LIMIT_MS;',  desc: 'canCallGemini: > → < RATE_LIMIT (flip)' },
  { from: 'return Date.now() - lastGeminiAt > GEMINI_RATE_LIMIT_MS;', to: 'return true;',  desc: 'canCallGemini → always true' },
  { from: 'return Date.now() - lastGeminiAt > GEMINI_RATE_LIMIT_MS;', to: 'return false;', desc: 'canCallGemini → always false' },

  // lastGeminiAt assignment
  { from: 'lastGeminiAt = Date.now();', to: '/* removed */', desc: 'lastGeminiAt assignment → remove' },

  // speak() guard
  { from: 'if (!isActive) return;', to: '/* removed */', desc: 'speak isActive guard → remove' },

  // range checks
  { from: 'telemetry.rangeRemainingKm < 10', to: 'telemetry.rangeRemainingKm <= 10', desc: 'range < 10 → <= 10' },
  { from: 'telemetry.rangeRemainingKm < 10', to: 'telemetry.rangeRemainingKm > 10',  desc: 'range < 10 → > 10' },
  { from: 'telemetry.rangeRemainingKm < 5',  to: 'telemetry.rangeRemainingKm <= 5',  desc: 'range_critical < 5 → <= 5' },
  { from: 'telemetry.rangeRemainingKm < 5',  to: 'telemetry.rangeRemainingKm > 5',   desc: 'range_critical < 5 → > 5' },

  // start() resets
  { from: 'lastWarnAt = {};', to: '/* removed */', desc: 'start: lastWarnAt reset → remove' },
  { from: 'lastGeminiAt = 0;', to: '/* removed */', desc: 'start: lastGeminiAt reset → remove' },
  { from: 'isActive = true;', to: 'isActive = false;', desc: 'start: isActive → false' },

  // stop() — occurrence 1 targets stop(), occurrence 0 targets declaration
  { from: 'isActive = false;', to: 'isActive = true;', desc: 'stop: isActive → true', occurrence: 1 },
];

// ─── PremiumKeyService mutations ──────────────────────────────────────────

const premiumKeyMutations = [
  // Rate limit window cleanup
  { from: 'now - rateLimitTimestamps[0] > RATE_LIMIT_WINDOW_MS',
    to:   'now - rateLimitTimestamps[0] >= RATE_LIMIT_WINDOW_MS',
    desc: 'rate window: > → >= WINDOW_MS' },
  { from: 'now - rateLimitTimestamps[0] > RATE_LIMIT_WINDOW_MS',
    to:   'now - rateLimitTimestamps[0] < RATE_LIMIT_WINDOW_MS',
    desc: 'rate window: > → < WINDOW_MS (flip)' },
  { from: 'now - rateLimitTimestamps[0] > RATE_LIMIT_WINDOW_MS',
    to:   'now + rateLimitTimestamps[0] > RATE_LIMIT_WINDOW_MS',
    desc: 'rate window: now - ts → now + ts' },

  // Rate limit shift (cleanup old timestamps)
  { from: 'rateLimitTimestamps.shift();', to: '/* removed */', desc: 'shift() → remove (no cleanup)' },

  // Rate limit count check
  { from: 'if (rateLimitTimestamps.length >= RATE_LIMIT_MAX) {',
    to:   'if (rateLimitTimestamps.length > RATE_LIMIT_MAX) {',
    desc: 'rate check: >= MAX → > MAX' },
  { from: 'if (rateLimitTimestamps.length >= RATE_LIMIT_MAX) {',
    to:   'if (rateLimitTimestamps.length <= RATE_LIMIT_MAX) {',
    desc: 'rate check: >= MAX → <= MAX (flip)' },
  { from: 'if (rateLimitTimestamps.length >= RATE_LIMIT_MAX) {',
    to:   'if (false) {',
    desc: 'rate check → false (never throttle)' },

  // Rate limit throw
  { from: "throw new UserFacingError(\n      'Zu viele Schlüsselanforderungen. Bitte warte eine Minute.',\n      'RATE_LIMIT_EXCEEDED',\n    );",
    to:   '/* removed */',
    desc: 'RATE_LIMIT throw → remove' },

  // Rate limit push (record timestamp)
  { from: 'rateLimitTimestamps.push(now);', to: '/* removed */', desc: 'push(now) → remove (no recording)' },

  // Cache TTL check
  { from: 'now - cachedAt < CACHE_TTL_MS',  to: 'now - cachedAt <= CACHE_TTL_MS', desc: 'cache TTL: < → <=' },
  { from: 'now - cachedAt < CACHE_TTL_MS',  to: 'now - cachedAt > CACHE_TTL_MS',  desc: 'cache TTL: < → > (flip)' },
  { from: 'if (cachedKey && now - cachedAt < CACHE_TTL_MS) {', to: 'if (true) {', desc: 'cache check → always true' },
  { from: 'if (cachedKey && now - cachedAt < CACHE_TTL_MS) {', to: 'if (false) {', desc: 'cache check → always false' },

  // Cache store
  { from: 'cachedKey = key;', to: '/* removed */', desc: 'cachedKey = key → remove' },
  { from: 'cachedAt = now;',  to: '/* removed */', desc: 'cachedAt = now → remove', occurrence: 1 },

  // Dev key branch
  { from: 'if (envKey) {', to: 'if (true) {',  desc: 'dev key: envKey → always true' },
  { from: 'if (envKey) {', to: 'if (false) {', desc: 'dev key: envKey → always false' },
  { from: 'cachedKey = envKey;', to: '/* removed */', desc: 'cachedKey = envKey → remove' },

  // UserFacingError constructor
  { from: "this.name = 'UserFacingError';", to: '/* removed */', desc: "name = 'UserFacingError' → remove" },
  { from: 'this.code = code;', to: '/* removed */',              desc: 'this.code = code → remove' },

  // HTTP status checks
  { from: 'if (response.status === 402) {', to: 'if (false) {',  desc: '402 check → false' },
  { from: 'if (response.status === 403) {', to: 'if (false) {',  desc: '403 check → false' },
  { from: 'if (!response.ok) {',            to: 'if (false) {',  desc: '!response.ok → false' },

  // MISSING_FUNCTIONS_URL check
  { from: 'if (!functionsUrl) {', to: 'if (false) {', desc: '!functionsUrl → false (skip check)' },

  // INVALID_RESPONSE check
  { from: 'if (!data.key) {', to: 'if (false) {', desc: '!data.key → false (skip check)' },

  // setAppCheckInstance — skip: firebase/app-check mock hangs in Node env (getToken with fake instance)
  { from: '_appCheckInstance = instance;', to: '/* removed */', desc: '_appCheckInstance = instance → remove', skip: true },

  // App Check token header — skip: requires firebase/app-check mock (same hang issue)
  { from: "headers['Authorization'] = `Bearer ${appCheckToken}`;", to: '/* removed */', desc: 'Authorization header → remove', skip: true },

  // clearKeyCache
  { from: 'cachedKey = null;\n  cachedAt = 0;\n}', to: '/* removed */\n}', desc: 'clearKeyCache body → remove' },

  // RATE_LIMIT_MAX value
  { from: 'const RATE_LIMIT_MAX = 5;', to: 'const RATE_LIMIT_MAX = 4;', desc: 'RATE_LIMIT_MAX: 5 → 4' },
  { from: 'const RATE_LIMIT_MAX = 5;', to: 'const RATE_LIMIT_MAX = 6;', desc: 'RATE_LIMIT_MAX: 5 → 6' },
];

// ─── Run ──────────────────────────────────────────────────────────────────

const results = {};

results.copilot = testMutations(
  'CoPilotService',
  'src/services/coPilotService.ts',
  'src/services/coPilotService.test.ts',
  coPilotMutations,
);

results.premiumKey = testMutations(
  'PremiumKeyService',
  'src/services/PremiumKeyService.ts',
  'src/services/PremiumKeyService.test.ts',
  premiumKeyMutations,
);

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log('MUTATION SCORE SUMMARY');
console.log(`${'═'.repeat(60)}`);

const GOAL_COPILOT     = 80;
const GOAL_PREMIUMKEY  = 95;

function scoreLine(name, { killed, total, score }, goal) {
  const mark = score >= goal ? `${GREEN}✓ PASS${RESET}` : `${RED}✗ FAIL${RESET}`;
  return `  ${name.padEnd(22)}  ${String(killed).padStart(3)}/${total}  ${String(score).padStart(3)}%  goal ${goal}%  ${mark}`;
}

console.log(scoreLine('CoPilotService',    results.copilot,    GOAL_COPILOT));
console.log(scoreLine('PremiumKeyService', results.premiumKey, GOAL_PREMIUMKEY));
console.log('');

const allGoalsMet = results.copilot.score >= GOAL_COPILOT &&
                   results.premiumKey.score >= GOAL_PREMIUMKEY;

if (allGoalsMet) {
  console.log(`${GREEN}All mutation score goals met.${RESET}`);
  process.exit(0);
} else {
  console.log(`${RED}One or more goals not met. Add tests for surviving mutants above.${RESET}`);
  process.exit(1);
}
