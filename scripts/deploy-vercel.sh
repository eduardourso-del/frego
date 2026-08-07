#!/usr/bin/env bash
# Deploy Frego web apps to Vercel production (from monorepo root).
# Vercel project slugs remain voltei-* until renamed in the Vercel dashboard.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCOPE="${VERCEL_SCOPE:-eduardourso-7445s-projects}"
VC=(npx --yes vercel@latest)

API_URL="${NEXT_PUBLIC_API_URL:-}"
if [[ -z "$API_URL" ]]; then
  API_URL=$(gcloud run services describe voltei-api \
    --project=voltei-e9d6d \
    --region=southamerica-east1 \
    --format='value(status.url)' 2>/dev/null || true)
fi
if [[ -z "$API_URL" ]]; then
  echo "Set NEXT_PUBLIC_API_URL or deploy the API first." >&2
  exit 1
fi

deploy_one() {
  local name="$1"
  echo "==> $name (API=$API_URL)"
  cd "$ROOT"
  rm -rf .vercel
  "${VC[@]}" link --yes --project "$name" --scope "$SCOPE"
  "${VC[@]}" deploy --prod --yes --scope "$SCOPE" --archive=tgz
}

deploy_one voltei-establishment
deploy_one voltei-admin

echo ""
echo "Establishment: https://voltei-establishment.vercel.app"
echo "Admin:         https://voltei-admin.vercel.app"
echo "API:           $API_URL"
