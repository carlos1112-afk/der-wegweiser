import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error reines ESM-Skript ohne Typdeklaration
import { findLeaks, FORBIDDEN_KEYS } from '../../scripts/check_bundle_env.mjs';

const SCRIPT = path.resolve('scripts/check_bundle_env.mjs');
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-'));
  fs.mkdirSync(path.join(dir, 'assets'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const write = (name: string, content: string) => fs.writeFileSync(path.join(dir, 'assets', name), content);
const run = () => spawnSync('node', [SCRIPT, dir], { encoding: 'utf8' });

describe('check_bundle_env: findLeaks', () => {
  it('meldet nichts bei sauberem Bundle', () => {
    write('a.js', 'var e={VITE_FIREBASE_API_KEY:`abc`,VITE_AI_PROVIDER:`firebase_ai`};');
    expect(findLeaks(dir)).toEqual([]);
  });

  it.each(FORBIDDEN_KEYS as string[])('erkennt %s mit Wert in Backtick-Schreibweise', (key) => {
    write('a.js', `var e={${key}:\`geheim\`};`);
    expect(findLeaks(dir)).toEqual([{ file: path.join('assets', 'a.js'), key }]);
  });

  it('erkennt Werte in doppelten und einfachen Anführungszeichen und mit Schlüssel in Anführungszeichen', () => {
    write('a.js', 'var e={"VITE_GOOGLE_MAPS_API_KEY":"x"};');
    write('b.js', "var e={VITE_APPCHECK_DEBUG_TOKEN:'x'};");
    write('c.js', 'var e={VITE_GEMINI_API_KEY : `x`};');
    expect(findLeaks(dir).map((l: { key: string }) => l.key).sort()).toEqual([
      'VITE_APPCHECK_DEBUG_TOKEN', 'VITE_GEMINI_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY',
    ]);
  });

  it('ignoriert leere Werte', () => {
    write('a.js', 'var e={VITE_GOOGLE_MAPS_API_KEY:``,VITE_APPCHECK_DEBUG_TOKEN:"",VITE_GEMINI_API_KEY:\'\'};');
    expect(findLeaks(dir)).toEqual([]);
  });

  it('ignoriert reine Erwähnungen des Namens ohne Wert, etwa im Quelltext der App', () => {
    write('a.js', 'const k=r.VITE_GOOGLE_MAPS_API_KEY;if(!r.VITE_APPCHECK_DEBUG_TOKEN)x();');
    expect(findLeaks(dir)).toEqual([]);
  });

  it('findet Treffer in Unterverzeichnissen und ignoriert Nicht-JS-Dateien', () => {
    fs.mkdirSync(path.join(dir, 'assets', 'sub'));
    fs.writeFileSync(path.join(dir, 'assets', 'sub', 'deep.js'), 'var e={VITE_GEMINI_API_KEY:`x`};');
    write('notes.txt', 'VITE_GOOGLE_MAPS_API_KEY:`x`');
    expect(findLeaks(dir)).toEqual([{ file: path.join('assets', 'sub', 'deep.js'), key: 'VITE_GEMINI_API_KEY' }]);
  });
});

describe('check_bundle_env: Kommandozeile', () => {
  it('endet mit 0 bei sauberem Bundle', () => {
    write('a.js', 'var e={VITE_AI_MODEL:`m`};');
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('OK');
  });

  it('endet mit 1 bei Treffer und gibt nur Namen, nie den Wert aus', () => {
    write('a.js', 'var e={VITE_GOOGLE_MAPS_API_KEY:`SUPER-GEHEIMER-WERT`};');
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('VITE_GOOGLE_MAPS_API_KEY');
    expect(r.stderr).toContain('a.js');
    expect(r.stderr + r.stdout).not.toContain('SUPER-GEHEIMER-WERT');
  });

  it('endet mit 2, wenn das Verzeichnis fehlt', () => {
    const r = spawnSync('node', [SCRIPT, path.join(dir, 'gibt-es-nicht')], { encoding: 'utf8' });
    expect(r.status).toBe(2);
  });
});
