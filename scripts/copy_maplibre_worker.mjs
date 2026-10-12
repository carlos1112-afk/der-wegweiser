// MapLibre GL JS v6 lädt seinen Worker als eigene Moduldatei ("maplibre-gl-worker.mjs"),
// die ihrerseits "./maplibre-gl-shared.mjs" nachlädt. Vite liefert beides nicht aus.
// Dieses Skript legt beide Dateien aus node_modules unter public/maplibre/ ab, damit sie
// unverändert und im selben Ordner ausgeliefert werden. Aufruf vor "dev" und "build".
import fs from 'node:fs';
import path from 'node:path';

export const WORKER_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

export function copyMapLibreWorker(srcDir = 'node_modules/maplibre-gl/dist', destDir = 'public/maplibre') {
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of WORKER_FILES) {
    const from = path.join(srcDir, name);
    if (!fs.existsSync(from)) {
      throw new Error(`MapLibre-Worker-Datei fehlt: ${from} (andere MapLibre-Version installiert?)`);
    }
    fs.copyFileSync(from, path.join(destDir, name));
  }
  return WORKER_FILES.map((n) => path.join(destDir, n));
}

import { fileURLToPath } from 'node:url';

/** Kommandozeilen-Logik: gibt den Exit-Code zurück (0 = ok, 1 = Datei fehlt). */
export function runCli(srcDir, destDir, log = console.log, logError = console.error) {
  try {
    const written = copyMapLibreWorker(srcDir, destDir);
    log(`copy_maplibre_worker: ${written.length} Dateien nach public/maplibre/ kopiert.`);
    return 0;
  } catch (e) {
    logError(`copy_maplibre_worker: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(runCli());
}
