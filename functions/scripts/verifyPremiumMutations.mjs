#!/usr/bin/env node
/** Two targeted mutation checks against the demo Firestore emulator. Always restores the source. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
  || process.env.GCLOUD_PROJECT !== 'demo-wegweiser') {
  console.error('Only a loopback Firestore emulator with GCLOUD_PROJECT=demo-wegweiser is allowed.');
  process.exit(2);
}
const functionsDir = fileURLToPath(new URL('../', import.meta.url));
const source = fileURLToPath(new URL('../src/routing/premiumRoute.ts', import.meta.url));
const original = readFileSync(source);
const text = original.toString('utf8');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const mutants = [
  { name: 'wallet capture changed to release', from: "operation: 'capture', amount: current.data()!.amount",
    to: "operation: 'release', amount: current.data()!.amount" },
  { name: 'result ownership check removed',
    from: "if (!job || job.userId !== request.auth.uid) throw new HttpsError('not-found', 'Route job not found.');",
    to: "if (!job) throw new HttpsError('not-found', 'Route job not found.');" },
];
let killed = 0;
try {
  for (const mutant of mutants) {
    if (!text.includes(mutant.from)) throw new Error(`Mutation target missing: ${mutant.name}`);
    // Only the first matching ownership check is changed; candidate access remains independently guarded.
    writeFileSync(source, text.replace(mutant.from, mutant.to));
    const result = spawnSync('npm', ['test', '--', '--runInBand', '--runTestsByPath',
      'tests/premiumRoute.emulator.test.ts', '--testNamePattern=reserves once'], {
      cwd: functionsDir, encoding: 'utf8', timeout: 90_000, maxBuffer: 1_000_000,
    });
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    // A compile/startup failure is not evidence that a behavioral mutation was detected.
    const detected = !result.error && result.status === 1 && /expect\(received\)/.test(output)
      && /Tests:\s+1 failed/.test(output);
    if (!detected) {
      console.error(output.slice(-6000));
      throw new Error(`Mutation survived or test failed before an assertion: ${mutant.name}`);
    }
    killed++;
    console.log(`KILLED: ${mutant.name}`);
    writeFileSync(source, original);
  }
} finally {
  writeFileSync(source, original);
  if (hash(readFileSync(source)) !== hash(original)) throw new Error('Source restoration failed.');
  console.log(`Source restored: SHA-256 ${hash(original)}`);
}
console.log(`Targeted mutation checks: ${killed}/${mutants.length} killed. This is not a full mutation score.`);
