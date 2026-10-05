/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/services/coPilotService.test.ts',
      'src/services/PremiumKeyService.test.ts',
      'src/services/PremiumKeyService.mutation.test.ts',
      'src/services/consentService.test.ts',
      'tests/scenarios/**/*.test.ts',
      'src/services/ai/**/*.test.ts',
      'src/*.test.ts',
      'tests/scripts/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist'],
  },
});
