import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error reines ESM-Skript ohne Typdeklaration
import { copyMapLibreWorker, runCli, WORKER_FILES } from '../../scripts/copy_maplibre_worker.mjs';

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

  describe('runCli (im selben Prozess)', () => {
    it('gibt 0 zurück und meldet die Anzahl der Dateien', () => {
      for (const n of WORKER_FILES as string[]) fs.writeFileSync(path.join(src, n), 'x');
      const out: string[] = [];
      expect(runCli(src, dest, (m: string) => out.push(m), () => {})).toBe(0);
      expect(out.join()).toContain('2 Dateien');
    });

    it('gibt 1 zurück und meldet die fehlende Datei, schreibt nichts weiter', () => {
      const errs: string[] = [];
      expect(runCli(src, dest, () => {}, (m: string) => errs.push(m))).toBe(1);
      expect(errs.join()).toContain('MapLibre-Worker-Datei fehlt');
    });
  });

  describe('Kommandozeile', () => {
    const SCRIPT = path.resolve('scripts/copy_maplibre_worker.mjs');
    let cwd: string;
    beforeEach(() => {
      cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'mlw-cli-'));
    });
    afterEach(() => fs.rmSync(cwd, { recursive: true, force: true }));

    it('Exit 0, kopiert aus node_modules nach public/maplibre/ und meldet die Anzahl', () => {
      const dist = path.join(cwd, 'node_modules', 'maplibre-gl', 'dist');
      fs.mkdirSync(dist, { recursive: true });
      for (const n of WORKER_FILES as string[]) fs.writeFileSync(path.join(dist, n), `// ${n}`);
      const r = spawnSync('node', [SCRIPT], { cwd, encoding: 'utf8' });
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('2 Dateien');
      for (const n of WORKER_FILES as string[]) {
        expect(fs.existsSync(path.join(cwd, 'public', 'maplibre', n))).toBe(true);
      }
    });

    it('Exit 1 mit klarer Meldung, wenn MapLibre nicht installiert ist (Build bricht ab statt leere Karte)', () => {
      const r = spawnSync('node', [SCRIPT], { cwd, encoding: 'utf8' });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('MapLibre-Worker-Datei fehlt');
      expect(fs.existsSync(path.join(cwd, 'public', 'maplibre', 'maplibre-gl-worker.mjs'))).toBe(false);
    });
  });

  it('die im Projekt installierte MapLibre-Version enthält beide Dateien', () => {
    for (const n of WORKER_FILES as string[]) {
      expect(fs.existsSync(path.join('node_modules/maplibre-gl/dist', n))).toBe(true);
    }
  });
});
