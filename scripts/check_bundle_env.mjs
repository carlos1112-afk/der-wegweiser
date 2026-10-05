import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_KEYS = [
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_APPCHECK_DEBUG_TOKEN',
  'VITE_GEMINI_API_KEY',
];

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

export function findLeaks(dir) {
  const leaks = [];
  for (const file of listJsFiles(dir)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const key of FORBIDDEN_KEYS) {
      const pattern = new RegExp(`${key}["']?\\s*:\\s*[\`"'][^\`"']+[\`"']`);
      if (pattern.test(content)) leaks.push({ file: path.relative(dir, file), key });
    }
  }
  return leaks;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] || 'dist';
  if (!fs.existsSync(dir)) {
    console.error(`check_bundle_env: Verzeichnis "${dir}" nicht gefunden.`);
    process.exit(2);
  }
  const leaks = findLeaks(dir);
  if (leaks.length > 0) {
    console.error('check_bundle_env: VERBOTENE Schlüssel mit Wert im Bundle gefunden (Werte werden nicht ausgegeben):');
    for (const { file, key } of leaks) console.error(`  - ${key} in ${file}`);
    process.exit(1);
  }
  console.log(`check_bundle_env: OK, keine verbotenen Schlüssel in "${dir}".`);
}
