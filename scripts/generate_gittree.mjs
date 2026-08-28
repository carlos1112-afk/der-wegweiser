import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const ignoreList = new Set(['node_modules', '.git', 'dist', '.gemini', '.commandcode', '.vscode', '.zed', '.agents']);

function getDirectoryTree(dir, prefix = '') {
  let output = '';
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const filtered = entries
    .filter(e => !ignoreList.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
      return a.isDirectory() ? -1 : 1;
    });

  filtered.forEach((entry, idx) => {
    const isLast = idx === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const subPrefix = isLast ? '    ' : '│   ';
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      output += `${prefix}${connector}📁 **${entry.name}/**\n`;
      output += getDirectoryTree(fullPath, `${prefix}${subPrefix}`);
    } else {
      const stats = fs.statSync(fullPath);
      const sizeStr = stats.size > 1024 ? `${(stats.size / 1024).toFixed(1)} KB` : `${stats.size} B`;
      output += `${prefix}${connector}📄 \`${entry.name}\` (${sizeStr})\n`;
    }
  });

  return output;
}

function getGitLog() {
  try {
    return execSync('git log --graph --oneline --decorate --all -n 15', { encoding: 'utf-8' });
  } catch {
    return 'Git log not available.';
  }
}

function getGitBranchInfo() {
  try {
    return execSync('git status -s -b', { encoding: 'utf-8' });
  } catch {
    return 'Git status not available.';
  }
}

const tree = getDirectoryTree(rootDir);
const gitLog = getGitLog();
const gitStatus = getGitBranchInfo();

const content = `# 🌳 Git- & Projekt-Tree: Der Wegweiser

*Generiert am: ${new Date().toISOString()}*

---

## 📌 Git Repository Status

\`\`\`
${gitStatus.trim()}
\`\`\`

## 📜 Commit-Historie

\`\`\`
${gitLog.trim()}
\`\`\`

---

## 📂 Vollständige Projekt-Struktur

\`\`\`markdown
📁 DER WEGWEISER/
${tree}\`\`\`

---

## 🔗 Schnellübersicht der Schlüsselkomponenten

- **Frontend & Navigation:** [\`src/App.tsx\`](src/App.tsx), [\`src/components/Map/MapView.tsx\`](src/components/Map/MapView.tsx)
- **KI-Services (Gemini & Vertex):** [\`src/services/aiAssistantService.ts\`](src/services/aiAssistantService.ts), [\`scripts/cloud/vertex_proxy.py\`](scripts/cloud/vertex_proxy.py)
- **BLE & Bike Telemetrie:** [\`src/services/bleService.ts\`](src/services/bleService.ts), [\`src/components/BatteryHUD/BatteryHUD.tsx\`](src/components/BatteryHUD/BatteryHUD.tsx)
- **Ladesäulen & Gamification:** [\`src/components/ChargingScanner/ScannerModal.tsx\`](src/components/ChargingScanner/ScannerModal.tsx), [\`src/components/ChargeAndEarn/LoungeModal.tsx\`](src/components/ChargeAndEarn/LoungeModal.tsx)
- **Firebase Firestore Daten-Layer:** [\`src/firebase.ts\`](src/firebase.ts), [\`src/services/dataRepository.ts\`](src/services/dataRepository.ts), [\`firebase_data/\`](firebase_data/)
- **GitHub & CI/CD:** [\`.github/workflows/ci.yml\`](.github/workflows/ci.yml), [\`.github/workflows/deploy.yml\`](.github/workflows/deploy.yml)
- **Dokumentation & Pläne:** [\`docs/Entwicklungsplan_Der_Wegweiser.md\`](docs/Entwicklungsplan_Der_Wegweiser.md), [\`docs/Wegweiser_Fortschrittsbericht.pdf\`](docs/Wegweiser_Fortschrittsbericht.pdf)
`;

fs.writeFileSync(path.join(rootDir, 'GITTREE.md'), content, 'utf-8');
console.log('GITTREE.md successfully generated!');
