// Build-Infra-Test (Analog zu copyMaplibreWorker.test.ts, aber für Cesium):
//
// Für MapLibre braucht es ein eigenes Kopier-Skript (scripts/copy_maplibre_worker.mjs), weil
// MapLibre v6 seine Worker-Datei zur Laufzeit aus import.meta.url ableitet und Vite sie sonst
// nicht ausliefert. Für Cesium übernimmt das bereits `vite-plugin-cesium` selbst (Dev-Middleware
// + closeBundle-Hook kopieren Assets/Workers/Widgets/ThirdParty automatisch) — ein eigenes
// Kopier-Skript wäre hier eine Dopplung bereits vorhandener Plugin-Logik (siehe Kommentar in
// vite.config.ts). Dieser Test verifiziert deshalb das tatsächliche Build-Ergebnis des echten
// Projekt-Builds, statt eine nicht-existente Kopierlogik zu testen.
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');
const distDir = path.join(projectRoot, 'dist');

describe('Cesium-Asset-Kopie im Production-Build (vite-plugin-cesium)', () => {
  afterAll(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('baut fehlerfrei und kopiert Cesiums statische Assets nach dist/cesium/', () => {
    fs.rmSync(distDir, { recursive: true, force: true });

    const result = spawnSync('npx', ['vite', 'build'], {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 120_000,
    });

    expect(result.status, `vite build fehlgeschlagen:\n${result.stdout}\n${result.stderr}`).toBe(0);

    const cesiumAssetsDir = path.join(distDir, 'cesium');
    for (const sub of ['Assets', 'Workers', 'Widgets', 'ThirdParty']) {
      expect(
        fs.existsSync(path.join(cesiumAssetsDir, sub)),
        `dist/cesium/${sub} fehlt — vite-plugin-cesium hat die Assets nicht kopiert`,
      ).toBe(true);
    }
    expect(fs.existsSync(path.join(cesiumAssetsDir, 'Cesium.js'))).toBe(true);

    const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    expect(indexHtml).toContain('cesium/Widgets/widgets.css');
    expect(indexHtml).toContain('cesium/Cesium.js');
  }, 150_000);

  it('die im Projekt installierte vite-plugin-cesium-Version liefert die erwartete Cesium-Build-Quelle', () => {
    // Precondition, auf die sich vite-plugin-cesium verlässt (cesiumBuildPath-Default):
    // ohne diese Ordner würde der Plugin-closeBundle-Hook fehlschlagen (siehe vite.config.ts).
    const cesiumBuildDir = path.join(projectRoot, 'node_modules/cesium/Build/Cesium');
    for (const sub of ['Assets', 'Workers', 'Widgets', 'ThirdParty']) {
      expect(fs.existsSync(path.join(cesiumBuildDir, sub))).toBe(true);
    }
  });
});
