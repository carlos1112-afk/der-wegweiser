#!/usr/bin/env node
/**
 * Provider Discovery Script
 * Scans all known IDE extension directories for provider configurations.
 * Outputs results to: C:\Users\CARLOS\PROJEKTE\DER WEGWEISER\discovered-providers.json
 *
 * Run once: node discover-providers.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { homedir, tmpdir } from "os";

const HOME = homedir();
const OUTPUT = resolve("C:\\Users\\CARLOS\\PROJEKTE\\DER WEGWEISER\\discovered-providers.json");

// ─── Candidate extension directories ───────────────────────────────────────────
const EXTENSION_DIRS = [
  // VS Code family
  join(HOME, ".vscode", "extensions"),
  join(HOME, ".vscode-insiders", "extensions"),
  join(HOME, ".vscode-test", "extensions"),
  // Cursor
  join(HOME, ".cursor", "extensions"),
  // Windsurf / Codeium
  join(HOME, ".codeium", "extensions"),
  // Continue
  join(HOME, ".continue", "extensions"),
  // Cline
  join(HOME, ".cline", "extensions"),
  // Roo / Roo Code
  join(HOME, ".roo", "extensions"),
  // Agy / Antigravity IDE (various possible locations)
  join(HOME, ".agy", "extensions"),
  join(HOME, ".agy-ide", "extensions"),
  join(HOME, ".antigravity", "extensions"),
  join(HOME, "AppData", "Roaming", "Agy", "User", "extensions"),
  join(HOME, "AppData", "Roaming", "Antigravity", "User", "extensions"),
  join(HOME, "AppData", "Roaming", "Agy-IDE", "User", "extensions"),
  join(HOME, "AppData", "Local", "Agy", "User", "extensions"),
  join(HOME, "AppData", "Local", "Antigravity", "User", "extensions"),
  // Pi extensions (npm)
  join(HOME, ".pi", "agent", "npm", "node_modules"),
  // VS Code system-wide
  "C:\\Program Files\\Microsoft VS Code\\resources\\app\\extensions",
  "C:\\Program Files\\Microsoft VS Code Insiders\\resources\\app\\extensions",
];

// ─── Scoop apps that might be IDEs ─────────────────────────────────────────────
const SCOOP_APPS = join(HOME, "scoop", "apps");

// Keywords to match relevant extensions
const PROVIDER_KEYWORDS = [
  "pilot", "studio", "pilotstudio", "pilot-studio", "pilot_studio",
  "gemini", "google", "geminicodeassist", "gemini-code-assist",
  "antigravity", "agy",
  "bedrock", "amazon", "aws",
  "openai", "anthropic", "claude", "vertex", "fireworks",
  "copilot", "github-copilot",
  "provider", "model", "llm", "ai",
  "context-mode", "pi-", "piolium", "bigpowers",
];

const SKIP_DIRS = [".git", "node_modules", ".DS_Store", "__pycache__"];
const MAX_DEPTH = 4;

const results = {
  scanTime: new Date().toISOString(),
  homeDir: HOME,
  extensionDirectories: [],
  foundExtensions: [],
  providers: [],
  piConfig: null,
  errors: [],
};

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function safeReadDir(p) {
  try { return readdirSync(p); } catch { return []; }
}

function safeReadFile(p) {
  try { return readFileSync(p, "utf-8"); } catch { return null; }
}

function matchesKeyword(name) {
  const lower = name.toLowerCase();
  return PROVIDER_KEYWORDS.some(kw => lower.includes(kw));
}

function parsePackageJson(pkgPath) {
  const raw = safeReadFile(pkgPath);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Extract provider info from package.json
function extractProviders(pkg) {
  const providers = [];
  if (!pkg) return providers;

  // Check activationEvents for provider-related patterns
  const activation = pkg.activationEvents || [];
  const contributes = pkg.contributes || {};
  const commands = contributes.commands || [];
  const config = contributes.configuration || {};
  const properties = config.properties || {};

  // Check if this extension has provider/model configuration
  const configKeys = Object.keys(properties);
  const hasProviderConfig = configKeys.some(k =>
    k.toLowerCase().includes("provider") ||
    k.toLowerCase().includes("model") ||
    k.toLowerCase().includes("api.key") ||
    k.toLowerCase().includes("api_key") ||
    k.toLowerCase().includes("llm") ||
    k.toLowerCase().includes("anthropic") ||
    k.toLowerCase().includes("openai") ||
    k.toLowerCase().includes("bedrock") ||
    k.toLowerCase().includes("gemini") ||
    k.toLowerCase().includes("vertex")
  );

  if (hasProviderConfig || matchesKeyword(pkg.name)) {
    const providerInfo = {
      extensionId: `${pkg.publisher ? pkg.publisher + "." : ""}${pkg.name}`,
      name: pkg.displayName || pkg.name,
      version: pkg.version,
      description: pkg.description,
      publisher: pkg.publisher,
      repository: pkg.repository,
      hasProviderConfig,
      configProperties: hasProviderConfig ? configKeys : [],
      commands: commands.map(c => ({
        id: c.command,
        title: c.title,
        category: c.category,
      })),
      activationEvents: activation,
      piConfig: pkg.pi || null,
      dependencies: pkg.dependencies || {},
      peerDependencies: pkg.peerDependencies || {},
      main: pkg.main,
    };
    providers.push(providerInfo);
  }

  return providers;
}

// Scan a directory tree for extension package.json files
function scanExtensionDir(dir, baseDepth = 0) {
  if (!isDir(dir)) return;

  results.extensionDirectories.push(dir);

  const scanRecursive = (currentDir, depth) => {
    if (depth > MAX_DEPTH) return;

    const entries = safeReadDir(currentDir);
    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry)) continue;

      const fullPath = join(currentDir, entry);

      // Check if this is an extension directory with package.json
      if (isDir(fullPath)) {
        const pkgPath = join(fullPath, "package.json");
        if (existsSync(pkgPath)) {
          const pkg = parsePackageJson(pkgPath);
          if (pkg) {
            const providers = extractProviders(pkg);
            // Always record extensions that match keywords OR have provider config
            if (providers.length > 0) {
              results.foundExtensions.push({
                path: fullPath,
                packageJson: pkg,
                providers,
              });
              results.providers.push(...providers);
            }
          }
        }
        // Also check nested subdirectories for monorepo-style extensions
        scanRecursive(fullPath, depth + 1);
      }
    }
  };

  scanRecursive(dir, baseDepth);
}

// Scan scoop apps for IDE-like packages
function scanScoopApps() {
  if (!isDir(SCOOP_APPS)) return;

  const apps = safeReadDir(SCOOP_APPS);
  for (const app of apps) {
    const appDir = join(SCOOP_APPS, app);
    if (!isDir(appDir)) continue;

    // Check for "current" symlink
    const currentDir = join(appDir, "current");
    if (!isDir(currentDir)) continue;

    // Check if this looks like a VS Code / IDE fork
    const productJsonPath = join(currentDir, "resources", "app", "product.json");
    if (existsSync(productJsonPath)) {
      const product = parsePackageJson(productJsonPath);
      if (product) {
        results.foundExtensions.push({
          path: currentDir,
          type: "ide-product",
          productJson: product,
          name: product.nameShort || product.nameLong || app,
          extensionsPath: join(HOME, `.${app}`, "extensions"),
        });
      }
    }
  }
}

// Read Pi configuration
function readPiConfig() {
  const settingsPath = join(HOME, ".pi", "agent", "settings.json");
  const authPath = join(HOME, ".pi", "agent", "auth.json");
  const pkgPath = join(HOME, ".pi", "agent", "npm", "package.json");

  const pi = {};

  const settingsRaw = safeReadFile(settingsPath);
  if (settingsRaw) {
    try { pi.settings = JSON.parse(settingsRaw); } catch {}
  }

  const authRaw = safeReadFile(authPath);
  if (authRaw) {
    try { pi.auth = JSON.parse(authRaw); } catch {}
  }

  const pkgRaw = safeReadFile(pkgPath);
  if (pkgRaw) {
    try { pi.packages = JSON.parse(pkgRaw); } catch {}
  }

  results.piConfig = pi;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
console.log("🔍 Starting provider discovery...\n");

// 1. Scan Pi config first
console.log("📋 Reading Pi configuration...");
readPiConfig();
if (results.piConfig) {
  const pkgs = results.piConfig.packages?.dependencies || {};
  console.log(`   Found ${Object.keys(pkgs).length} Pi packages`);
}

// 2. Scan all extension directories
console.log("\n📁 Scanning extension directories...");
for (const dir of EXTENSION_DIRS) {
  if (isDir(dir)) {
    console.log(`   Found: ${dir}`);
    scanExtensionDir(dir);
  }
}

// 3. Scan scoop apps for IDEs
console.log("\n🥄 Scanning scoop apps for IDEs...");
scanScoopApps();

// 4. Also scan project-local .pi and .gemini directories
const PROJECT_DIRS = [
  "C:\\Users\\CARLOS\\PROJEKTE\\DER WEGWEISER\\.pi",
  "C:\\Users\\CARLOS\\PROJEKTE\\DER WEGWEISER\\.gemini",
  "C:\\Users\\CARLOS\\PROJEKTE\\DER WEGWEISER\\.agents",
];
for (const dir of PROJECT_DIRS) {
  if (isDir(dir)) {
    console.log(`   Found project dir: ${dir}`);
    scanExtensionDir(dir);
  }
}

// 5. Summary
console.log("\n✅ Discovery complete!");
console.log(`   Extension directories scanned: ${results.extensionDirectories.length}`);
console.log(`   Matching extensions found: ${results.foundExtensions.length}`);
console.log(`   Provider entries extracted: ${results.providers.length}`);

// Write results
writeFileSync(OUTPUT, JSON.stringify(results, null, 2), "utf-8");
console.log(`\n📄 Results written to: ${OUTPUT}`);
console.log("   Open this file and share its contents with your agent.\n");
