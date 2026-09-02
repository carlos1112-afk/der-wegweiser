import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔒 ========================================================');
console.log('🔒 COMPREHENSIVE REPOSITORY SECRET & KEY SCANNER');
console.log('🔒 ========================================================');

const SECRET_PATTERNS = [
  { name: 'Google / Firebase API Key', regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: 'GitHub Personal Access Token', regex: /ghp_[0-9A-Za-z]{36}/g },
  { name: 'GitHub Fine-grained PAT', regex: /github_pat_[0-9A-Za-z_]{82}/g },
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/g },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'RSA/EC/DSA Private Key', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g }
];

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'backups',
  'scripts/scan_secrets.js',
  'scripts/test_hosting_predeploy.js',
  'scripts/test_resilience_and_offline.js'
];

function scanFiles(dir) {
  let findings = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(process.cwd(), fullPath);

    if (IGNORED_PATHS.some(ignored => relPath.startsWith(ignored) || relPath === ignored)) {
      continue;
    }

    if (entry.isDirectory()) {
      findings = findings.concat(scanFiles(fullPath));
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of SECRET_PATTERNS) {
          const matches = content.match(pattern.regex);
          if (matches) {
            for (const match of matches) {
              findings.push({
                file: relPath,
                type: pattern.name,
                match: match.slice(0, 10) + '...' + match.slice(-4)
              });
            }
          }
        }
      } catch {
        // binary or unreadable file
      }
    }
  }
  return findings;
}

const findings = scanFiles(process.cwd());

if (findings.length > 0) {
  console.error(`❌ CRITICAL: ${findings.length} suspected secret(s) found in repository!`);
  for (const f of findings) {
    console.error(`   • [${f.type}] in ${f.file} (${f.match})`);
  }
  process.exit(1);
} else {
  console.log('✅ REPOSITORY CLEAN: Zero exposed secrets or hardcoded API keys detected across all source files.');
  process.exit(0);
}
