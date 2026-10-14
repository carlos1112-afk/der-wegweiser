/// <reference types="vitest/config" />
import { createRequire } from 'node:module'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// vite-plugin-cesium ist ein CJS-Paket ohne "type": "module". Unter `module: "nodenext"` +
// `verbatimModuleSyntax` (tsconfig.node.json) bildet ein gewöhnlicher Default-Import
// (`import cesium from 'vite-plugin-cesium'`) node-treu auf das GESAMTE module.exports-Objekt
// ab, nicht auf dessen `.default` — das Objekt selbst ist dann nicht aufrufbar. `createRequire`
// umgeht diese CJS/ESM-Interop-Falle explizit und typsicher, ohne projektweite tsconfig-Module-
// Einstellungen zu ändern.
const require = createRequire(import.meta.url)
const cesium: (options?: Record<string, unknown>) => Plugin = require('vite-plugin-cesium').default

// https://vite.dev/config/
export default defineConfig({
  // vite-plugin-cesium übernimmt für Cesium das, was scripts/copy_maplibre_worker.mjs für
  // MapLibre von Hand macht: Dev-Middleware + Build-closeBundle-Hook kopieren Cesiums
  // statische Assets/Workers/Widgets/ThirdParty automatisch. Anders als bei MapLibre v6
  // (Worker-URL wird zur Laufzeit aus import.meta.url abgeleitet, Vite liefert die Datei
  // sonst nicht aus) gibt es hier keine Packaging-Lücke, die ein eigenes Kopier-Skript
  // bräuchte — ein solches Skript wäre eine Dopplung der bereits vorhandenen Plugin-Logik.
  plugins: [react(), cesium()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('leaflet') || id.includes('@react-leaflet') || id.includes('maplibre')) {
              return 'vendor-map';
            }
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/firestore.rules.test.mjs', 'node_modules', 'dist'],
  },
})
