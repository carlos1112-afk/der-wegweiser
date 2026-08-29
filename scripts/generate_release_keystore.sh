#!/usr/bin/env bash
set -e

# ==============================================================================
# Der Wegweiser — Android Release Keystore Generator (PKCS12 / JKS Standard)
# ==============================================================================

CRED_DIR="$(pwd)/credentials"
KEYSTORE_FILE="${CRED_DIR}/wegweiser-release-key.jks"
ALIAS="wegweiser-release-key"
CERT_FILE="${CRED_DIR}/release-cert.pem"
KEY_FILE="${CRED_DIR}/release-private.key"
PROPERTIES_FILE="${CRED_DIR}/keystore.properties"

mkdir -p "${CRED_DIR}"

echo "🔐 ========================================================"
echo "🔐 ANDROID RELEASE KEYSTORE GENERATION"
echo "🔐 ========================================================"

# Generate secure random 32-character password if not provided
PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)

echo "🔑 [1] Generating 4096-bit RSA Private Key & X.509 Certificate..."
openssl req -new -x509 -days 10000 -newkey rsa:4096 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -nodes \
  -subj "/CN=Pascal Gregor/OU=Mobile/O=Der Wegweiser/L=Spreetal/ST=Sachsen/C=DE" 2>/dev/null

echo "📦 [2] Packaging into PKCS#12 Keystore (.jks / .keystore)..."
openssl pkcs12 -export \
  -in "${CERT_FILE}" \
  -inkey "${KEY_FILE}" \
  -out "${KEYSTORE_FILE}" \
  -name "${ALIAS}" \
  -passout "pass:${PASSWORD}"

# Secure permissions (Read/Write only for owner)
chmod 600 "${KEYSTORE_FILE}" "${KEY_FILE}" "${CERT_FILE}"

echo "📝 [3] Generating keystore.properties (Git-Ignored)..."
cat <<EOF > "${PROPERTIES_FILE}"
# Android Release Signing Configuration (STRICTLY CONFIDENTIAL)
# This file is in .gitignore and MUST NEVER be shared or committed!
storePassword=${PASSWORD}
keyPassword=${PASSWORD}
keyAlias=${ALIAS}
storeFile=${KEYSTORE_FILE}
EOF
chmod 600 "${PROPERTIES_FILE}"

echo "🛡️ [4] Calculating Certificate Fingerprints for Google Play & Firebase:"
echo "--------------------------------------------------------"
SHA256=$(openssl x509 -noout -fingerprint -sha256 -in "${CERT_FILE}" | cut -d'=' -f2)
SHA1=$(openssl x509 -noout -fingerprint -sha1 -in "${CERT_FILE}" | cut -d'=' -f2)

echo "  SHA-256: ${SHA256}"
echo "  SHA-1:   ${SHA1}"
echo "  Alias:   ${ALIAS}"
echo "  Format:  PKCS#12 (Standard Java Keystore)"
echo "--------------------------------------------------------"

# Save Fingerprints to metadata text file in credentials
cat <<EOF > "${CRED_DIR}/keystore-metadata.txt"
Der Wegweiser — Android Release Keystore Metadata
Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Owner: Pascal Gregor, Spreetal (DE)
Key Alias: ${ALIAS}
Key Type: RSA 4096-bit
Validity: 10,000 Days (~27 Years)

Fingerprints (for Google Play Console & Firebase Console):
SHA-1:   ${SHA1}
SHA-256: ${SHA256}

Files:
- wegweiser-release-key.jks (Release Keystore)
- keystore.properties (Gradle Signing Config)
- release-cert.pem (Public X.509 Certificate)

SECURITY NOTE:
Keep offline backup of this entire 'credentials/' directory on an encrypted USB stick or Password Vault.
EOF

echo ""
echo "✅ SUCCESS: Release-Keystore wurde erfolgreich erzeugt!"
echo "📁 Speicherort: ${KEYSTORE_FILE}"
echo "🔐 Konfiguration: ${PROPERTIES_FILE}"
