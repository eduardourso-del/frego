#!/bin/bash
# Upload dSYMs to Firebase Crashlytics. This project uses Swift Package
# Manager (no CocoaPods), so the run script lives under SourcePackages.
# Missing script is a warning, not a failed build.

set -u

RUN=""
if [ -n "${PODS_ROOT:-}" ] && [ -f "$PODS_ROOT/FirebaseCrashlytics/run" ]; then
  RUN="$PODS_ROOT/FirebaseCrashlytics/run"
elif [ -n "${BUILD_DIR:-}" ] && [ -f "$BUILD_DIR/SourcePackages/checkouts/firebase-ios-sdk/Crashlytics/run" ]; then
  RUN="$BUILD_DIR/SourcePackages/checkouts/firebase-ios-sdk/Crashlytics/run"
else
  DERIVED_ROOT="${BUILD_DIR%/Build/*}"
  if [ -n "$DERIVED_ROOT" ] && [ -f "$DERIVED_ROOT/SourcePackages/checkouts/firebase-ios-sdk/Crashlytics/run" ]; then
    RUN="$DERIVED_ROOT/SourcePackages/checkouts/firebase-ios-sdk/Crashlytics/run"
  else
    SEARCH_ROOTS=()
    [ -n "${BUILD_DIR:-}" ] && SEARCH_ROOTS+=("$BUILD_DIR")
    [ -n "$DERIVED_ROOT" ] && SEARCH_ROOTS+=("$DERIVED_ROOT")
    [ -d "${PROJECT_DIR}/Flutter/ephemeral" ] && SEARCH_ROOTS+=("${PROJECT_DIR}/Flutter/ephemeral")
    if [ ${#SEARCH_ROOTS[@]} -gt 0 ]; then
      RUN=$(find "${SEARCH_ROOTS[@]}" -type f -path '*firebase-ios-sdk/Crashlytics/run' -print -quit 2>/dev/null || true)
    fi
  fi
fi

if [ -z "$RUN" ] || [ ! -f "$RUN" ]; then
  echo "warning: Crashlytics run script not found; skipping dSYM upload"
  exit 0
fi

APP_ID_FILE="${PROJECT_DIR}/firebase_app_id_file.json"
if [ -f "$APP_ID_FILE" ]; then
  GOOGLE_APP_ID=$(python3 -c "import json; print(json.load(open('$APP_ID_FILE'))['GOOGLE_APP_ID'])" 2>/dev/null || true)
  if [ -n "${GOOGLE_APP_ID:-}" ]; then
    export GOOGLE_APP_ID
  fi
fi

# Flutter's Xcode wrapper treats any `error:` on stdout as a failed archive,
# even when this script exits 0. Keep Crashlytics noise out of the log.
LOG="${TEMP_DIR:-/tmp}/crashlytics-upload.log"
if [ -f "$APP_ID_FILE" ]; then
  "$RUN" --flutter-project "$APP_ID_FILE" >"$LOG" 2>&1 || true
else
  "$RUN" >"$LOG" 2>&1 || true
fi
exit 0
