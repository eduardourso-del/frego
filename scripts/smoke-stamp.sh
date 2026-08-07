#!/usr/bin/env bash
# Teste rápido do fluxo de carimbo (API local com AUTH_BYPASS=true).
set -euo pipefail
API="${API_URL:-http://localhost:8080}"

echo "== health =="
curl -sS "$API/health" | tee /tmp/frego-health.json
echo

echo "== buscar Marina =="
LOOKUP=$(curl -sS -X POST "$API/customers/lookup" \
  -H 'content-type: application/json' \
  -d '{"phone":"11987654321"}')
echo "$LOOKUP" | tee /tmp/frego-lookup.json
MEMBERSHIP=$(node -e "const d=require('/tmp/frego-lookup.json'); if(!d.membership) process.exit(2); process.stdout.write(d.membership.id)")

echo
echo "== carimbar =="
curl -sS -X POST "$API/transactions" \
  -H 'content-type: application/json' \
  -d "{\"membershipId\":\"$MEMBERSHIP\",\"type\":\"stamp\"}" | tee /tmp/frego-stamp.json
echo
echo "OK"
