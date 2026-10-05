#!/usr/bin/env bash
# IEC 62443 / GCP Compliance Audit — der-wegweiser
# Ausführen: bash scripts/audit_gcp_iec62443.sh
# Voraussetzung: gcloud auth login && gcloud config set project der-wegweiser

set -euo pipefail

PROJECT="der-wegweiser"
REGION="europe-west3"
FUNCTION_NAME="issueGoogleMapsKey"
SECRET_NAME="GOOGLE_MAPS_API_KEY"

echo "═══════════════════════════════════════════════════════"
echo "  IEC 62443 / EU AI Act — GCP Compliance Audit"
echo "  Projekt: $PROJECT  |  Region: $REGION"
echo "  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "═══════════════════════════════════════════════════════"

# 1. Secret Manager: Rotation & Versionen
echo ""
echo "── [1] Secret Manager: $SECRET_NAME ──"
gcloud secrets describe "$SECRET_NAME" \
  --project="$PROJECT" \
  --format="yaml(name,replication,createTime,labels)" || echo "FEHLER: Secret nicht gefunden"

echo ""
echo "  Aktive Versionen:"
gcloud secrets versions list "$SECRET_NAME" \
  --project="$PROJECT" \
  --filter="state=ENABLED" \
  --format="table(name,createTime,state)" || echo "FEHLER: Versionen nicht abrufbar"

# 2. IAM-Bindings auf den Secret
echo ""
echo "── [2] IAM-Bindings auf Secret ──"
gcloud secrets get-iam-policy "$SECRET_NAME" \
  --project="$PROJECT" \
  --format="yaml" || echo "FEHLER: IAM Policy nicht abrufbar"

# 3. Cloud Function: Deployment-Parameter
echo ""
echo "── [3] Cloud Function: $FUNCTION_NAME ──"
gcloud functions describe "$FUNCTION_NAME" \
  --project="$PROJECT" \
  --region="$REGION" \
  --gen2 \
  --format="yaml(name,serviceConfig.serviceAccountEmail,serviceConfig.ingressSettings,serviceConfig.vpcConnector,serviceConfig.environmentVariables,serviceConfig.secretEnvironmentVariables)" \
  2>/dev/null || \
gcloud functions describe "$FUNCTION_NAME" \
  --project="$PROJECT" \
  --region="$REGION" \
  --format="yaml(name,serviceAccountEmail,ingressSettings,environmentVariables,secretEnvironmentVariables)" \
  || echo "FEHLER: Function nicht gefunden"

# 4. IAM: Wer darf die Function aufrufen?
echo ""
echo "── [4] IAM-Bindings auf Cloud Function ──"
gcloud functions get-iam-policy "$FUNCTION_NAME" \
  --project="$PROJECT" \
  --region="$REGION" \
  --format="yaml" \
  2>/dev/null || \
gcloud functions get-iam-policy "$FUNCTION_NAME" \
  --project="$PROJECT" \
  --region="$REGION" \
  --format="yaml" \
  || echo "FEHLER: Function IAM Policy nicht abrufbar"

# 5. Service Account: Rollen
echo ""
echo "── [5] Service Accounts im Projekt ──"
gcloud iam service-accounts list \
  --project="$PROJECT" \
  --format="table(email,displayName,disabled)" || echo "FEHLER: Service Accounts nicht abrufbar"

# 6. Audit-Logs: Letzte 10 Secret-Zugriffe
echo ""
echo "── [6] Audit-Log: Letzte Secret-Zugriffe (24h) ──"
gcloud logging read \
  'resource.type="audited_resource" AND protoPayload.serviceName="secretmanager.googleapis.com" AND protoPayload.methodName=~"AccessSecretVersion"' \
  --project="$PROJECT" \
  --freshness=1d \
  --limit=10 \
  --format="table(timestamp,protoPayload.authenticationInfo.principalEmail,protoPayload.methodName,protoPayload.status.code)" \
  || echo "FEHLER: Audit-Logs nicht abrufbar (ggf. fehlende Berechtigung)"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Audit abgeschlossen."
echo "  Compliance-Ziele prüfen:"
echo "  ✓ Secret hat genau 1 ENABLED-Version"
echo "  ✓ secretAccessor-Rolle nur für Function-SA, nicht für 'allUsers'"
echo "  ✓ ingressSettings = ALLOW_INTERNAL_ONLY oder ALLOW_ALL mit App Check"
echo "  ✓ Kein GOOGLE_MAPS_API_KEY als Env-Variable (nur als Secret)"
echo "═══════════════════════════════════════════════════════"
