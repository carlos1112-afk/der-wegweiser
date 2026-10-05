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
    ],
    exclude: ['node_modules', 'dist'],
  },
});
