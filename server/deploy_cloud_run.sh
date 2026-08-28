#!/bin/bash
set -e

PROJECT_ID="der-wegweiser"
REGION="europe-west3"
SERVICE_NAME="wegweiser-vertex-agent"

echo "=== Deploying Vertex AI Cloud Agent to Cloud Run ($REGION) ==="

gcloud config set project "$PROJECT_ID"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT="$PROJECT_ID",GCP_REGION="$REGION"

echo "=== Deployment finished successfully! ==="
