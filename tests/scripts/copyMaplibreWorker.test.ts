import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error reines ESM-Skript ohne Typdeklaration
import { copyMapLibreWorker, WORKER_FILES } from '../../scripts/copy_maplibre_worker.mjs';

let src: string;
let dest: string;

beforeEach(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mlw-'));
  src = path.join(base, 'src');
  dest = path.join(base, 'out', 'maplibre');
  fs.mkdirSync(src, { recursive: true });
});
afterEach(() => fs.rmSync(path.dirname(path.dirname(dest)), { recursive: true, force: true }));

describe('copy_maplibre_worker', () => {
  it('kopiert Worker und Shared-Datei unverändert in den Zielordner', () => {
    for (const n of WORKER_FILES as string[]) fs.writeFileSync(path.join(src, n), `// ${n}`);
    const written = copyMapLibreWorker(src, dest) as string[];
    expect(written).toHaveLength(2);
    for (const n of WORKER_FILES as string[]) {
      expect(fs.readFileSync(path.join(dest, n), 'utf8')).toBe(`// ${n}`);
    }
  });

  it('der Worker lädt "./maplibre-gl-shared.mjs": beide Dateien müssen im selben Ordner liegen', () => {
    expect(WORKER_FILES).toContain('maplibre-gl-worker.mjs');
    expect(WORKER_FILES).toContain('maplibre-gl-shared.mjs');
  });

  it('wirft mit klarer Meldung, wenn eine Datei fehlt', () => {
    fs.writeFileSync(path.join(src, 'maplibre-gl-worker.mjs'), 'x');
    expect(() => copyMapLibreWorker(src, dest)).toThrow(/maplibre-gl-shared\.mjs/);
  });

  it('überschreibt eine ältere Kopie (kein Versionsversatz)', () => {
    fs.mkdirSync(dest, { recursive: true });
    for (const n of WORKER_FILES as string[]) {
      fs.writeFileSync(path.join(dest, n), 'ALT');
      fs.writeFileSync(path.join(src, n), 'NEU');
    }
    copyMapLibreWorker(src, dest);
    expect(fs.readFileSync(path.join(dest, WORKER_FILES[0]), 'utf8')).toBe('NEU');
  });

  it('die im Projekt installierte MapLibre-Version enthält beide Dateien', () => {
    for (const n of WORKER_FILES as string[]) {
      expect(fs.existsSync(path.join('node_modules/maplibre-gl/dist', n))).toBe(true);
    }
  });
});
