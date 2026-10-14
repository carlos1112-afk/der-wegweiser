// Headless-Browser-Rendertest: beweist, dass CesiumPremiumCanvas tatsächlich ein WebGL-Canvas
// mit Inhalt zeigt — nicht nur, dass der Build fehlerfrei durchläuft (siehe
// tests/scripts/cesiumAssetsBuild.test.ts) oder die Logik korrekt ist (siehe
// CesiumPremiumCanvas.test.tsx, dort mit gemocktem Cesium-Modul).
//
// Aufbau wie in der Aufgabenbeschreibung gefordert: lokaler Vite-Dev-Server (echte
// vite.config.ts inkl. vite-plugin-cesium) + Playwright-Request-Interception, die echte
// Cesium-ion-/Token-Hosts (in dieser Sandbox ohnehin durch die Egress-Policy blockiert, siehe
// PR) durch einen abgebrochenen Request ersetzt — die Komponente behandelt das bereits als
// regulären Terrain-/Imagery-Ladefehler (siehe applyWorldTerrain()/configureLayers() in
// CesiumPremiumCanvas.tsx) und fällt sauber auf flaches Ellipsoid-Terrain zurück, rendert aber
// trotzdem (Sternenhimmel/Atmosphäre/Globus), was dieser Test als "kein leeres Canvas" prüft.
//
// Getestet wird nur satellite-3d (repräsentativ, wie in der vorgeschlagenen Umbau-Reihenfolge
// "erstmal nur für satellite-3d"). topo-premium/cycle-premium-Layer-Konfiguration ist durch
// CesiumPremiumCanvas.test.tsx abgedeckt (dort mit gemocktem Cesium — kein zweiter voller
// Browser-Rendertest, aus Zeit-/Laufzeitgründen bewusst nicht dupliziert).
import { describe, it, expect, afterAll } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');
const CHROMIUM_PATH = '/opt/pw-browsers/chromium';
const hasChromium = fs.existsSync(CHROMIUM_PATH);

let server: ViteDevServer | undefined;
let browser: Browser | undefined;

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

// Playwright braucht einen echten Chromium-Build (dieses Sandbox-Image liefert ihn vorinstalliert
// unter /opt/pw-browsers, siehe Umgebungsdoku). Ohne ihn wird der Test übersprungen statt rot zu
// laufen, statt den Build hier künstlich scheitern zu lassen.
describe.skipIf(!hasChromium)('CesiumPremiumCanvas — Headless-WebGL-Rendertest (satellite-3d)', () => {
  it(
    'zeigt ein WebGL-Canvas mit echtem Inhalt, keinen onError, keine Konsolenfehler',
    async () => {
      server = await createServer({
        root: projectRoot,
        server: { port: 0 },
        define: {
          // Dev-Fallback des CesiumKeyService — kein echter ion-Token nötig, da alle
          // ion-Requests unten ohnehin abgebrochen und als Ladefehler behandelt werden.
          'import.meta.env.VITE_CESIUM_ION_TOKEN': JSON.stringify('test-harness-fake-token'),
        },
      });
      await server.listen();
      const baseUrl = server.resolvedUrls?.local?.[0];
      if (!baseUrl) throw new Error('Vite-Dev-Server hat keine lokale URL geliefert');

      browser = await chromium.launch({
        executablePath: CHROMIUM_PATH,
        headless: true,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
      });
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

      // Request-Interception: echte Kachel-/Token-Hosts durch eine abgebrochene Anfrage ersetzt
      // (Cesium ion-API/Assets, OSM-Tile-Hosts). CesiumPremiumCanvas behandelt das als normalen
      // Lade-/Netzwerkfehler (console.warn + Fallback), nie als Absturz oder verzerrtes Rendering.
      await page.route('**/*', (route) => {
        const url = route.request().url();
        const isCesiumIon = /(^|\.)cesium\.com$/.test(new URL(url).hostname) || url.includes('ion.cesium');
        if (isCesiumIon) return route.abort('failed');
        return route.continue();
      });

      await page.goto(`${baseUrl}tests/fixtures/cesiumRenderHarness/index.html?theme=satellite-3d`);

      await page.waitForSelector('.cesium-widget canvas', { timeout: 20_000 });
      // Kurze Render-Beruhigungszeit: Terrain-/Imagery-Fallback-Promises (siehe oben) müssen
      // abgewickelt sein, bevor der Screenshot den stabilen Endzustand zeigt.
      await page.waitForTimeout(1500);

      const screenshot = await page.locator('.cesium-widget canvas').first().screenshot();
      // Eine leere/transparente Canvas-Fläche komprimiert als PNG auf wenige hundert Bytes;
      // echter Inhalt (Sternenhimmel, Atmosphäre, Credit-Wasserzeichen) liegt deutlich darüber.
      expect(screenshot.length).toBeGreaterThan(2000);

      const harnessState = await page.evaluate(
        () => (window as unknown as { __cesiumHarness: { error: string | null; mounted: boolean } }).__cesiumHarness,
      );
      expect(harnessState.mounted).toBe(true);
      expect(harnessState.error).toBeNull();

      // Bekannt, nicht Teil dieses PR: Chromium selbst protokolliert "Failed to load resource:
      // net::ERR_FAILED" als Konsolenfehler für jeden hier bewusst per route.abort()
      // unterbrochenen ion-Request — das ist die vom Test selbst injizierte Netzwerkstörung,
      // kein Anwendungsfehler. CesiumPremiumCanvas selbst protokolliert diese Fälle nur als
      // console.warn (siehe oben), nie als console.error.
      const unexpectedConsoleErrors = consoleErrors.filter(
        (msg) => !msg.includes('Failed to load resource: net::ERR_FAILED'),
      );
      expect(unexpectedConsoleErrors).toEqual([]);
    },
    60_000,
  );
});
