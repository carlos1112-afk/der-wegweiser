#!/usr/bin/env bash
set -e

# ==============================================================================
# Der Wegweiser — Android Upload Key Generator (PKCS#12 / Google Play App Signing)
# ==============================================================================

CRED_DIR="$(pwd)/credentials"
KEYSTORE_FILE="${CRED_DIR}/wegweiser-upload-key.p12"
ALIAS="wegweiser-upload-key"
CERT_FILE="${CRED_DIR}/upload-cert.pem"
KEY_FILE="${CRED_DIR}/upload-private.key"

USER_CONFIG_DIR="${HOME}/.config/der-wegweiser"
USER_CONFIG_FILE="${USER_CONFIG_DIR}/signing.properties"

# Clean old keys
rm -rf "${CRED_DIR}"/*
mkdir -p "${CRED_DIR}"
mkdir -p "${USER_CONFIG_DIR}"

echo "🔐 ========================================================"
echo "🔐 GOOGLE PLAY UPLOAD-KEY GENERATION (PKCS#12 Standard)"
echo "🔐 ========================================================"

# Generate cryptographically secure random 32-character password
PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 28)

echo "🔑 [1] Generating 4096-bit RSA Private Key & Neutral X.509 Certificate..."
# Neutral Subject: No private residential address, no street, no personal email
openssl req -new -x509 -days 10000 -newkey rsa:4096 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -nodes \
  -subj "/CN=Der Wegweiser Android Upload Key/O=Der Wegweiser/C=DE" 2>/dev/null

echo "📦 [2] Packaging into PKCS#12 Keystore (.p12)..."
openssl pkcs12 -export \
  -in "${CERT_FILE}" \
  -inkey "${KEY_FILE}" \
  -out "${KEYSTORE_FILE}" \
  -name "${ALIAS}" \
  -passout "pass:${PASSWORD}"

# Restrict permissions
chmod 600 "${KEYSTORE_FILE}" "${KEY_FILE}" "${CERT_FILE}"

echo "🛡️ [3] Storing Signing Config Exclusively in User Profile (~/.config/der-wegweiser/)..."
cat <<EOF > "${USER_CONFIG_FILE}"
# Android Upload Key Configuration (STRICTLY CONFIDENTIAL)
# Stored outside repository in user profile directory (~/.config/der-wegweiser)
storeFile=${KEYSTORE_FILE}
storePassword=${PASSWORD}
keyAlias=${ALIAS}
keyPassword=${PASSWORD}
storeType=PKCS12
EOF
chmod 600 "${USER_CONFIG_FILE}"

# Securely remove temporary unencrypted private key file from disk
rm -f "${KEY_FILE}"

echo "🛡️ [4] Calculating Upload Certificate Fingerprints:"
echo "--------------------------------------------------------"
SHA256=$(openssl x509 -noout -fingerprint -sha256 -in "${CERT_FILE}" | cut -d'=' -f2)
SHA1=$(openssl x509 -noout -fingerprint -sha1 -in "${CERT_FILE}" | cut -d'=' -f2)

echo "  Upload Key SHA-256: ${SHA256}"
echo "  Upload Key SHA-1:   ${SHA1}"
echo "  Key Alias:          ${ALIAS}"
echo "  Format:             PKCS#12 (.p12)"
echo "  Subject:            CN=Der Wegweiser Android Upload Key, O=Der Wegweiser, C=DE"
echo "--------------------------------------------------------"

# Metadata summary in credentials (strictly ZERO passwords included)
cat <<EOF > "${CRED_DIR}/upload-key-metadata.txt"
Der Wegweiser — Android Upload Key Metadata
Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Role: Google Play Upload Key (Used to sign .aab before upload)
Algorithm: RSA 4096-bit
Validity: 10,000 Days (~27 Years)
Subject: CN=Der Wegweiser Android Upload Key, O=Der Wegweiser, C=DE
StoreType: PKCS12

Fingerprints (Local Upload Key for Sideload/Dev & Play Upload Verification):
SHA-1:   ${SHA1}
SHA-256: ${SHA256}

Security Notice:
The signing password is NOT stored here. It resides exclusively in:
~/.config/der-wegweiser/signing.properties (chmod 600)
and should be transferred to your KeePassXC password vault.
EOF

echo ""
echo "✅ SUCCESS: Neuer Upload-Key wurde erzeugt!"
echo "📁 Keystore-Datei: ${KEYSTORE_FILE}"
echo "🔒 Externe Konfiguration: ${USER_CONFIG_FILE} (chmod 600)"
echo "ℹ️  Das Passwort liegt ausschließlich in ${USER_CONFIG_FILE} bereit für den Import in KeePassXC."
