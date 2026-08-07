#!/usr/bin/env bash
# Deploy Frego API to Cloud Run (GCP project id remains voltei-e9d6d).
# Requires: gcloud auth, services/api/.env with DATABASE_URL + Firebase/Meta keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT=voltei-e9d6d
REGION=southamerica-east1
SERVICE=voltei-api
SA=voltei-api@voltei-e9d6d.iam.gserviceaccount.com
ENV_FILE="$ROOT/services/api/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# Load env without exporting comments/empty
source <(grep -E '^[A-Z_]+=' "$ENV_FILE" | sed 's/\r$//')
set +a

: "${DATABASE_URL:?DATABASE_URL required}"
: "${FIREBASE_PROJECT_ID:=voltei-e9d6d}"

TAG="${1:-$(date +%Y%m%d-%H%M%S)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/voltei/api:${TAG}"

echo "==> Building $IMAGE"
gcloud builds submit \
  --project="$PROJECT" \
  --config="$ROOT/infra/cloudbuild/api.yaml" \
  --substitutions="_TAG=${TAG}" \
  --timeout=1800s \
  "$ROOT"

# Build env vars for Cloud Run (no AUTH_BYPASS in prod)
ENV_VARS=(
  "NODE_ENV=production"
  "HOST=0.0.0.0"
  "AUTH_BYPASS=false"
  "FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
  "DATABASE_URL=${DATABASE_URL}"
)

[[ -n "${META_APP_ID:-}" ]] && ENV_VARS+=("META_APP_ID=${META_APP_ID}")
[[ -n "${META_APP_SECRET:-}" ]] && ENV_VARS+=("META_APP_SECRET=${META_APP_SECRET}")
[[ -n "${META_EMBEDDED_CONFIG_ID:-}" ]] && ENV_VARS+=("META_EMBEDDED_CONFIG_ID=${META_EMBEDDED_CONFIG_ID}")
[[ -n "${WHATSAPP_TOKEN_ENCRYPTION_KEY:-}" ]] && ENV_VARS+=("WHATSAPP_TOKEN_ENCRYPTION_KEY=${WHATSAPP_TOKEN_ENCRYPTION_KEY}")
[[ -n "${WHATSAPP_WEBHOOK_VERIFY_TOKEN:-}" ]] && ENV_VARS+=("WHATSAPP_WEBHOOK_VERIFY_TOKEN=${WHATSAPP_WEBHOOK_VERIFY_TOKEN}")
[[ -n "${WHATSAPP_GRAPH_VERSION:-}" ]] && ENV_VARS+=("WHATSAPP_GRAPH_VERSION=${WHATSAPP_GRAPH_VERSION}")

JOINED=$(IFS=,; echo "${ENV_VARS[*]}")

echo "==> Deploying Cloud Run $SERVICE"
gcloud run deploy "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --platform=managed \
  --allow-unauthenticated \
  --no-invoker-iam-check \
  --service-account="$SA" \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="$JOINED"

URL=$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --format='value(status.url)')

echo ""
echo "API: $URL"
echo "Health: $URL/health"
