/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/services/accountDeletionService.test.ts',
      'src/services/coPilotService.test.ts',
      'src/services/PremiumKeyService.test.ts',
      'src/services/PremiumKeyService.mutation.test.ts',
      'src/services/CesiumKeyService.test.ts',
      'src/services/consentService.test.ts',
      'src/services/gpxImportService.test.ts',
      'src/services/ai/**/*.test.ts',
      'src/services/aiAssistantService.test.ts',
      'src/*.test.ts',
      'src/utils/*.test.ts',
      'src/components/Map/*.test.ts',
      'src/components/Map/*.test.tsx',
      'src/components/Search/*.test.tsx',
      'src/components/Navigation/*.test.tsx',
      'src/components/ChargeAndEarn/*.test.tsx',
      'tests/scenarios/**/*.test.ts',
      'tests/scripts/**/*.test.ts',
      'tests/services/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist'],
  },
});
