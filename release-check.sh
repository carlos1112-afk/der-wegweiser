#!/usr/bin/env bash
set -e

# ==============================================================================
# Der Wegweiser — Unified End-to-End Release & Maintenance Pipeline
# ==============================================================================

echo "🚀 ========================================================"
echo "🚀 DER WEGWEISER — RELEASE PIPELINE & VERIFICATION SUITE"
echo "🚀 ========================================================"

ROOT_DIR="$(pwd)"
ANDROID_DIR="${ROOT_DIR}/android"
EXPORT_AAB="${ANDROID_DIR}/app/build/outputs/bundle/release/app-release.aab"
EXPORT_APK="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"

# 1. Toolchain & Environment Check (Including Target SDK 36 Enforcement)
echo ""
echo "🔧 [1/10] Verifying Build Toolchains & Target SDK..."
node -v
npm -v
java -version 2>&1 | head -n 1
export ANDROID_HOME="/opt/android-sdk"
if [ ! -d "${ANDROID_HOME}" ]; then
  echo "❌ FAIL: ANDROID_HOME (${ANDROID_HOME}) not found!"
  exit 1
fi

# Dynamically parse Target SDK from build configuration
TARGET_SDK=$(grep -E '^\s*targetSdkVersion\s*=' "${ANDROID_DIR}/variables.gradle" | awk -F'=' '{print $2}' | tr -d ' "')
COMPILE_SDK=$(grep -E '^\s*compileSdkVersion\s*=' "${ANDROID_DIR}/variables.gradle" | awk -F'=' '{print $2}' | tr -d ' "')

echo "  Target SDK:  API ${TARGET_SDK}"
echo "  Compile SDK: API ${COMPILE_SDK}"

if [ "${TARGET_SDK}" -lt 36 ]; then
  echo "❌ FAIL: targetSdkVersion (${TARGET_SDK}) is lower than Google Play minimum (API 36 / Android 16)!"
  exit 1
fi
echo "  ✅ Target SDK 36 (Android 16+) verification passed."

# 2. Dependency & Security Policy Audit
echo ""
echo "🛡️ [2/10] Running Dependency & Security Policy Check..."
node scripts/check_dependencies.js

# 3. TypeScript & Frontend Production Build
echo ""
echo "⚡ [3/10] Executing TypeScript & Vite Production Bundle..."
npm run build

# 4. Linter Check
echo ""
echo "🔍 [4/10] Running Code Quality & Linter..."
npm run lint

# 5. Automated Provider Health & Schema Check
echo ""
echo "🩺 [5/10] Running Provider Health & Schema Verification..."
node scripts/health_check_providers.js

# 6. Resilience, Physics & Offline Degradation Tests
echo ""
echo "🔋 [6/10] Running Resilience & Offline Degradation Tests..."
node scripts/test_resilience_and_offline.js

# 7. AI Gateway & Live Production Smoketest (Adversarial Deletion)
echo ""
echo "👤 [7/10] Running AI Gateway & Adversarial Deletion Smoketest..."
node scripts/test_p0_ai_gateway_live.js
node scripts/test_live_production_smoketest.js

# 8. Capacitor Native Sync
echo ""
echo "📱 [8/10] Synchronizing Native Assets (Capacitor Sync)..."
npx cap sync android
npx cap sync ios 2>/dev/null || true

# 9. Native Android Clean & Signed Release Bundle
echo ""
echo "📦 [9/10] Compiling Native Android Release Bundle (.aab) with Target SDK ${TARGET_SDK}..."
cd "${ANDROID_DIR}"
./gradlew clean
./gradlew bundleRelease
./gradlew assembleRelease
cd "${ROOT_DIR}"

# 10. Binary Artifact Signature & Checksum Verification
echo ""
echo "🔑 [10/10] Verifying AAB Binary Signature & Checksum..."
if [ ! -f "${EXPORT_AAB}" ]; then
  echo "❌ FAIL: AAB release artifact not found at ${EXPORT_AAB}"
  exit 1
fi

AAB_SHA256=$(sha256sum "${EXPORT_AAB}" | awk '{print $1}')
AAB_SIZE=$(ls -lh "${EXPORT_AAB}" | awk '{print $5}')
KEYTOOL_OUTPUT=$(keytool -printcert -jarfile "${EXPORT_AAB}")
SUBJECT=$(echo "${KEYTOOL_OUTPUT}" | grep "Eigentümer:" | sed 's/Eigentümer: //')
CERT_SHA256=$(echo "${KEYTOOL_OUTPUT}" | grep "SHA256:" | awk '{print $2}')
CERT_SHA1=$(echo "${KEYTOOL_OUTPUT}" | grep "SHA1:" | awk '{print $2}')

echo "--------------------------------------------------------"
echo "  Release Artefakt:  ${EXPORT_AAB}"
echo "  Dateigröße:        ${AAB_SIZE}"
echo "  AAB Checksumme:    ${AAB_SHA256}"
echo "  Target SDK:        API ${TARGET_SDK} (Android 16)"
echo "  Compile SDK:       API ${COMPILE_SDK}"
echo "  Zertifikat-Subject:${SUBJECT}"
echo "  Upload-Key SHA256: ${CERT_SHA256}"
echo "  Upload-Key SHA1:   ${CERT_SHA1}"
echo "--------------------------------------------------------"

# Update machine-readable checklist
mkdir -p release
cat <<EOF > release/checklist.json
{
  "release": "1.0.0",
  "versionCode": 1,
  "gitCommit": "$(git rev-parse HEAD)",
  "buildTimestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "sdk": {
    "compileSdk": ${COMPILE_SDK},
    "targetSdk": ${TARGET_SDK},
    "minSdk": 24
  },
  "aab": {
    "path": "${EXPORT_AAB}",
    "sha256": "${AAB_SHA256}",
    "size": "${AAB_SIZE}"
  },
  "signing": {
    "subject": "${SUBJECT}",
    "sha1": "${CERT_SHA1}",
    "sha256": "${CERT_SHA256}"
  },
  "tests": {
    "targetSdkEnforcement": "PASS",
    "dependencies": "PASS",
    "typescript": "PASS",
    "linter": "PASS",
    "providerHealth": "PASS",
    "resilienceOffline": "PASS",
    "liveSmoke": "PASS"
  },
  "status": "RC1_TARGET_SDK_36_VERIFIED"
}
EOF

echo ""
echo "✅ ========================================================"
echo "✅ RELEASE-CHECK ERFOLGREICH: TARGET SDK 36 RC1 VERIFIZIERT"
echo "✅ ========================================================"
