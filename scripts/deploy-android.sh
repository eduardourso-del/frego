#!/usr/bin/env bash
# Build a Play-signed Android App Bundle for Frego (com.bearlabs.frego).
# Prerequisites: ~/.frego/play-upload.jks and apps/mobile/android/key.properties
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
API_URL="${API_URL:-https://voltei-api-5z2jvudlna-rj.a.run.app}"
KEY_PROPS="$MOBILE/android/key.properties"

if [[ ! -f "$KEY_PROPS" ]]; then
  echo "Missing $KEY_PROPS — create the Play upload keystore first." >&2
  exit 1
fi

cd "$MOBILE"
# Stale Gradle daemons can keep a dead local HTTP proxy (127.0.0.1:9090).
(cd "$MOBILE/android" && ./gradlew --stop >/dev/null 2>&1 || true)
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy || true
export GRADLE_OPTS="${GRADLE_OPTS:-} -Djava.net.useSystemProxies=false"

flutter pub get
set +e
flutter build appbundle --release --no-tree-shake-icons \
  --dart-define="API_URL=${API_URL}"
status=$?
set -e

AAB="$MOBILE/build/app/outputs/bundle/release/app-release.aab"
if [[ ! -f "$AAB" ]]; then
  echo "AAB was not produced (flutter exit ${status})." >&2
  exit 1
fi
if [[ "$status" -ne 0 ]]; then
  echo "Warning: flutter build exited ${status}, but the AAB exists (often a debug-symbol strip warning)."
fi

echo ""
echo "AAB: $AAB"
echo "Upload this to Play Console → Frego → Testing → Internal testing."
echo "Upload-key SHA-1/SHA-256 should already be on Firebase Android app com.bearlabs.frego."
echo "After Play App Signing, also add the *app signing* SHA-1 from Play Console → App integrity."
