/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
    related: false,
  },
  mutate: [
    'src/services/coPilotService.ts',
    'src/services/PremiumKeyService.ts',
  ],
  reporters: ['html', 'clear-text', 'progress'],
  coverageAnalysis: 'off',
  timeoutMS: 60000,
  concurrency: 1,
};
