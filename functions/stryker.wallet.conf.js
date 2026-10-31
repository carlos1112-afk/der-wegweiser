/** Local invariant suite only. Does not certify Firestore concurrency or runtime auth. */
module.exports = {
  testRunner: 'jest',
  jest: { projectType: 'custom', enableFindRelatedTests: false, config: {
    preset: 'ts-jest', testEnvironment: 'node', testMatch: ['**/tests/walletLedger.test.ts'],
  } },
  mutate: ['src/wallet/ledger.ts'],
  reporters: ['clear-text', 'json'],
  jsonReporter: { fileName: 'reports/wallet-mutation.json' },
  coverageAnalysis: 'perTest', concurrency: 1, timeoutMS: 10000,
};
