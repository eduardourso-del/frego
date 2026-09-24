#!/usr/bin/env bash
# Build + upload Frego iOS IPA to App Store Connect (Bearlabs team 87284RSCR5).
# Prerequisites: app record for com.bearlabs.frego exists in App Store Connect.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
API_URL="${API_URL:-https://voltei-api-5z2jvudlna-rj.a.run.app}"
BUILD="${BUILD:-$(date +%Y%m%d%H%M%S)}"

cd "$MOBILE"

NAME="${VERSION:-$(perl -ne 'if (/^version:\s*([^+]+)/) { print $1; exit }' pubspec.yaml)}"
perl -pi -e "s/^version: .*/version: ${NAME}+${BUILD}/" pubspec.yaml

flutter pub get
flutter build ipa --release --no-tree-shake-icons \
  --dart-define="API_URL=${API_URL}"

cat > /tmp/frego-ExportOptions-upload.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>destination</key>
	<string>upload</string>
	<key>method</key>
	<string>app-store-connect</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>teamID</key>
	<string>87284RSCR5</string>
	<key>uploadSymbols</key>
	<true/>
	<key>manageAppVersionAndBuildNumber</key>
	<true/>
</dict>
</plist>
EOF

xcodebuild -exportArchive \
  -archivePath build/ios/archive/Runner.xcarchive \
  -exportOptionsPlist /tmp/frego-ExportOptions-upload.plist \
  -exportPath /tmp/frego-ios-upload \
  -allowProvisioningUpdates

echo "Uploaded build ${BUILD}. Check TestFlight in App Store Connect."
