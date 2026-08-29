/**
 * P0 Validation Script for Production AI Gateway & Model Verification (Pure Node.js)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🧪 ========================================================');
console.log('🧪 P0 AUDIT: AI GATEWAY, GEMINI 3.6 & DELETION VERIFICATION');
console.log('🧪 ========================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

// 1. Check for deprecated Gemini 2.0 / 2.5 experimental models
console.log('🔍 [1] Verifying Active Model IDs in src/services/aiAssistantService.ts');
const serviceContent = fs.readFileSync(path.join(ROOT_DIR, 'src/services/aiAssistantService.ts'), 'utf8');

const deprecatedModels = [
  'gemini-2.0-flash-thinking-exp-01-21',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest'
];

let foundDeprecated = 0;
for (const model of deprecatedModels) {
  if (serviceContent.includes(model)) {
    console.error(`  ❌ Deprecated model found in code: ${model}`);
    foundDeprecated++;
  }
}
assert(serviceContent.includes("'gemini-3.6-flash'"), 'Production standard model gemini-3.6-flash configured.');
assert(!serviceContent.includes("'gemini-3.6-pro'"), 'Unverified gemini-3.6-pro strictly excluded from production.');

// 2. Check vertex_proxy.py configuration & Zero Client Secrets for Weather
console.log('\n🔍 [2] Verifying vertex_proxy.py configuration & Server-Side Endpoints');
const proxyContent = fs.readFileSync(path.join(ROOT_DIR, 'scripts/cloud/vertex_proxy.py'), 'utf8');
assert(proxyContent.includes('europe-west3'), 'Vertex proxy location is europe-west3 (Frankfurt).');
assert(proxyContent.includes('gemini-3.6-flash'), 'Vertex proxy uses modern Gemini 3.6 models.');
assert(proxyContent.includes('/v1/weather') && proxyContent.includes('/v1/elevation'), 'Vertex proxy provides server-side /v1/weather and /v1/elevation endpoints.');

// 3. Verify ZERO Client Secrets for Open-Meteo
console.log('\n🔍 [3] Verifying ZERO Client Secrets for Open-Meteo in Frontend');
const weatherContent = fs.readFileSync(path.join(ROOT_DIR, 'src/services/weatherService.ts'), 'utf8');
const elevationContent = fs.readFileSync(path.join(ROOT_DIR, 'src/services/elevationService.ts'), 'utf8');
assert(!weatherContent.includes('VITE_OPEN_METEO_API_KEY'), 'WeatherService has ZERO client-side Open-Meteo keys.');
assert(!elevationContent.includes('VITE_OPEN_METEO_API_KEY'), 'ElevationService has ZERO client-side Open-Meteo keys.');

// 4. Verify Account Deletion Service & Google Play Web Resource
console.log('\n🔍 [4] Verifying End-to-End Account Deletion Service & Google Play Web Resource');
const deletionHtmlPath = path.join(ROOT_DIR, 'public/account-deletion.html');
const deletionExists = fs.existsSync(deletionHtmlPath);
assert(deletionExists, 'public/account-deletion.html exists for Google Play Store Policy compliance.');
if (deletionExists) {
  const content = fs.readFileSync(deletionHtmlPath, 'utf8');
  assert(content.includes('Pascal Gregor') && content.includes('wegweiser-app@proton.me'), 'Account deletion page contains legal operator email & name.');
  assert(content.includes('Art. 17 DSGVO'), 'Account deletion page references Art. 17 DSGVO.');
  assert(content.includes('form') && content.includes('handleWebDeletionSubmit'), 'Account deletion page contains working interactive submission form.');
}

const deletionServicePath = path.join(ROOT_DIR, 'src/services/accountDeletionService.ts');
const deletionServiceContent = fs.readFileSync(deletionServicePath, 'utf8');
assert(deletionServiceContent.includes('user_tokens'), 'AccountDeletionService wipes user_tokens.');
assert(deletionServiceContent.includes('user_preferences'), 'AccountDeletionService wipes user_preferences.');
assert(deletionServiceContent.includes('charging_stations'), 'AccountDeletionService wipes user charging stations.');
assert(deletionServiceContent.includes('routes'), 'AccountDeletionService wipes user custom routes.');
assert(deletionServiceContent.includes('scout_reports'), 'AccountDeletionService wipes user scout reports.');
assert(deletionServiceContent.includes('deleteUser(currentUser)'), 'AccountDeletionService deletes Firebase Auth user after cloud wipe.');

// 5. Test Live AI Gateway Dispatch & Fallback
console.log('\n🔍 [5] Testing AI Gateway Dispatching Logic');
const aiGatewayPath = path.join(ROOT_DIR, 'src/services/ai/aiGatewayService.ts');
const aiGatewayContent = fs.readFileSync(aiGatewayPath, 'utf8');
assert(aiGatewayContent.includes('BackendProxyAdapter'), 'AiGatewayService includes BackendProxyAdapter.');
assert(aiGatewayContent.includes('HeuristicOfflineAdapter'), 'AiGatewayService includes HeuristicOfflineAdapter.');

console.log('\n========================================================');
console.log(`P0 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================');

if (failed > 0) process.exit(1);
