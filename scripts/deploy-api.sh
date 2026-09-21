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
# Load via a temp file: `source <(grep …)` drops quoted DATABASE_URL on bash 3.2/macOS.
ENV_EXPORT="$(mktemp)"
grep -E '^[A-Z_]+=' "$ENV_FILE" | sed 's/\r$//' > "$ENV_EXPORT"
source "$ENV_EXPORT"
rm -f "$ENV_EXPORT"
set +a

: "${DATABASE_URL:?DATABASE_URL required}"
: "${FIREBASE_PROJECT_ID:=voltei-e9d6d}"
: "${META_APP_ID:?META_APP_ID required}"
: "${META_APP_SECRET:?META_APP_SECRET required}"
: "${WHATSAPP_TOKEN_ENCRYPTION_KEY:?WHATSAPP_TOKEN_ENCRYPTION_KEY required}"

TAG="${1:-$(date +%Y%m%d-%H%M%S)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/voltei/api:${TAG}"

echo "==> Building $IMAGE"
gcloud builds submit \
  --project="$PROJECT" \
  --config="$ROOT/infra/cloudbuild/api.yaml" \
  --substitutions="_TAG=${TAG}" \
  --timeout=1800s \
  "$ROOT"

ENV_VARS_FILE="$(mktemp)"
trap 'rm -f "$ENV_VARS_FILE"' EXIT
# YAML file avoids comma-splitting secrets (base64 keys, URLs) that --set-env-vars breaks.
python3 - "$ENV_VARS_FILE" <<'PY'
import json, os, sys

out = sys.argv[1]
pairs = [
    ("NODE_ENV", "production"),
    ("HOST", "0.0.0.0"),
    ("AUTH_BYPASS", "false"),
    ("FIREBASE_PROJECT_ID", os.environ["FIREBASE_PROJECT_ID"]),
    ("DATABASE_URL", os.environ["DATABASE_URL"]),
    ("META_APP_ID", os.environ["META_APP_ID"]),
    ("META_APP_SECRET", os.environ["META_APP_SECRET"]),
    ("WHATSAPP_TOKEN_ENCRYPTION_KEY", os.environ["WHATSAPP_TOKEN_ENCRYPTION_KEY"]),
]
for key in (
    "META_EMBEDDED_CONFIG_ID",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    "WHATSAPP_GRAPH_VERSION",
):
    value = os.environ.get(key, "").strip()
    if value:
        pairs.append((key, value))

with open(out, "w", encoding="utf-8") as fh:
    for key, value in pairs:
        fh.write(f"{key}: {json.dumps(value)}\n")
PY

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
  --env-vars-file="$ENV_VARS_FILE"

URL=$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --format='value(status.url)')

echo ""
echo "API: $URL"
echo "Health: $URL/health"
