#!/usr/bin/env bash
set -e

# ==============================================================================
# Der Wegweiser — Unified iOS Release & Compliance Verification Pipeline
# ==============================================================================

echo "🍎 ========================================================"
echo "🍎 DER WEGWEISER — IOS RELEASE PIPELINE & COMPLIANCE SUITE"
echo "🍎 ========================================================"

ROOT_DIR="$(pwd)"
IOS_DIR="${ROOT_DIR}/ios/App"
INFO_PLIST="${IOS_DIR}/App/Info.plist"
PRIVACY_MANIFEST="${IOS_DIR}/App/PrivacyInfo.xcprivacy"

# 1. Toolchain & Environment Check
echo ""
echo "🔧 [1/8] Verifying Build Toolchain & Dependencies..."
node -v
npm -v

# 2. Dependency Audit
echo ""
echo "🛡️ [2/8] Running Dependency & Security Policy Check..."
node scripts/check_dependencies.js

# 3. TypeScript & Web Production Build
echo ""
echo "⚡ [3/8] Building Web Production Assets..."
npm run build

# 4. Linter & Code Quality
echo ""
echo "🔍 [4/8] Running Code Quality & Linter..."
npm run lint

# 5. Live Provider Health Checks
echo ""
echo "🩺 [5/8] Running Provider Health & Schema Verification..."
node scripts/health_check_providers.js

# 6. Capacitor iOS Sync
echo ""
echo "📱 [6/8] Synchronizing Native iOS Assets..."
npx cap sync ios

# 7. iOS Info.plist & Privacy Manifest Compliance Validation
echo ""
echo "🔒 [7/8] Auditing iOS Info.plist & PrivacyInfo.xcprivacy..."

if [ ! -f "${INFO_PLIST}" ]; then
  echo "❌ FAIL: iOS Info.plist not found at ${INFO_PLIST}"
  exit 1
fi

# Check for ITSAppUsesNonExemptEncryption
if ! grep -q "ITSAppUsesNonExemptEncryption" "${INFO_PLIST}"; then
  echo "❌ FAIL: ITSAppUsesNonExemptEncryption is missing in Info.plist!"
  exit 1
fi

# Ensure NSUserTrackingUsageDescription is NOT present without ATT implementation
if grep -q "NSUserTrackingUsageDescription" "${INFO_PLIST}"; then
  echo "❌ FAIL: Unused NSUserTrackingUsageDescription found in Info.plist (Apple Guideline 5.1.2 risk)!"
  exit 1
fi

# Ensure PrivacyInfo.xcprivacy exists and has valid tracking flag
if [ ! -f "${PRIVACY_MANIFEST}" ]; then
  echo "❌ FAIL: PrivacyInfo.xcprivacy not found at ${PRIVACY_MANIFEST}"
  exit 1
fi

if ! grep -q "NSPrivacyTracking" "${PRIVACY_MANIFEST}"; then
  echo "❌ FAIL: NSPrivacyTracking declaration missing in PrivacyInfo.xcprivacy!"
  exit 1
fi

echo "  ✅ Info.plist & PrivacyInfo.xcprivacy source-side audit passed."

# 8. Xcode 26+ Build Environment & Minimum Version Check
echo ""
echo "📦 [8/8] Checking macOS & Xcode Build Environment (Target: Xcode >= 26)..."
if command -v xcodebuild >/dev/null 2>&1; then
  XCODE_VER_STR=$(xcodebuild -version | head -n 1)
  XCODE_MAJOR=$(echo "${XCODE_VER_STR}" | awk '{print $2}' | cut -d'.' -f1)
  echo "  ✅ Xcode detected: ${XCODE_VER_STR}"
  if [ "${XCODE_MAJOR}" -lt 26 ]; then
    echo "❌ FAIL: Xcode version (${XCODE_MAJOR}) is lower than required minimum (Xcode 26+ for iOS SDK 26+)!"
    exit 1
  fi
  echo "  ✅ Xcode 26+ verified. Ready for xcodebuild clean archive."
else
  echo "  ℹ️ Notice: Current host is Linux. Local xcodebuild unavailable."
  echo "  ℹ️ Status: EXTERNER MAC BUILD ERFORDERLICH (Bereit für Xcode 26+ Import & TestFlight Archivierung)."
fi

echo ""
echo "✅ ========================================================"
echo "✅ IOS RELEASE-CHECK ERFOLGREICH: QUELLSTAND RELEASE-FÄHIG"
echo "✅ ========================================================"
