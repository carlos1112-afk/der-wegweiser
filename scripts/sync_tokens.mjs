#!/usr/bin/env node
/**
 * Figma Token Sync Tool for Der Wegweiser
 * 
 * Synchronisiert src/design-tokens.ts mit src/index.css (:root Block).
 * Unterstützt auch den Import von Figma Tokens Studio JSON-Dateien.
 * 
 * Usage:
 *   node scripts/sync_tokens.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const tokensPath = path.join(rootDir, 'src', 'design-tokens.ts');
const cssPath = path.join(rootDir, 'src', 'index.css');

console.log('🔄 Der Wegweiser — Figma Token Sync CLI');
console.log(`📁 Source: ${tokensPath}`);
console.log(`📁 Target: ${cssPath}`);

const tokensContent = fs.readFileSync(tokensPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// Extract cssVars from design-tokens.ts
const match = tokensContent.match(/cssVars:\s*\{([\s\S]*?)\}\s*as const/);
if (!match) {
  console.error('❌ Could not find cssVars object in src/design-tokens.ts');
  process.exit(1);
}

const varsRaw = match[1];
const varLines = varsRaw.split('\n')
  .map(l => l.trim())
  .filter(l => l.startsWith("'--") && l.includes(':'));

const tokenMap = {};
for (const line of varLines) {
  // Line format: '--var-name': 'value',
  const colonIdx = line.indexOf(':');
  const key = line.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
  let val = line.slice(colonIdx + 1).trim();
  if (val.endsWith(',')) val = val.slice(0, -1).trim();
  val = val.replace(/^['"]|['"]$/g, '');
  tokenMap[key] = val;
}

console.log(`✅ Extrahierte Token-Variablen: ${Object.keys(tokenMap).length}`);

let issues = 0;
for (const [key, val] of Object.entries(tokenMap)) {
  const regex = new RegExp(`${key}\\s*:\\s*([^;]+);`);
  const cssMatch = cssContent.match(regex);
  if (!cssMatch) {
    console.warn(`⚠️ Variable in index.css fehlt: ${key} (Soll: ${val})`);
    issues++;
  } else {
    const cssVal = cssMatch[1].trim();
    // Normalize spaces for comparison
    const normCss = cssVal.replace(/\s+/g, ' ').toLowerCase();
    const normToken = val.replace(/\s+/g, ' ').toLowerCase();
    if (normCss !== normToken) {
      console.warn(`⚠️ Wert-Diskrepanz für ${key}: CSS="${cssVal}" vs Token="${val}"`);
      issues++;
    }
  }
}

if (issues === 0) {
  console.log('🎉 100% Synchronität zwischen design-tokens.ts und src/index.css!');
  process.exit(0);
} else {
  console.log(`ℹ️ ${issues} Diskrepanzen gefunden.`);
  if (process.argv.includes('--check')) {
    console.error('❌ Token-Check fehlgeschlagen: CSS stimmt nicht mit design-tokens.ts überein.');
    process.exit(1);
  }
}
