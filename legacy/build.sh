#!/bin/bash
set -euo pipefail
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${RANKBLICK_BUILD_DIR:-$SOURCE_DIR/../../work/rankblick-build}"
TARGET_APP_DIR="${RANKBLICK_APP_DIR:-$SOURCE_DIR/../Rankblick.app}"
STAGE_DIR="$(mktemp -d /private/tmp/rankblick-build.XXXXXX)"
trap 'rm -rf "$STAGE_DIR"' EXIT
APP_DIR="$STAGE_DIR/Rankblick.app"
if [ ! -d "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi
cd "$SOURCE_DIR"
swift build -c release --build-system native --scratch-path "$BUILD_DIR"
BIN_DIR="$(swift build -c release --build-system native --scratch-path "$BUILD_DIR" --show-bin-path)"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
cp "$BIN_DIR/Rankblick" "$APP_DIR/Contents/MacOS/Rankblick"
cp "$BIN_DIR/RankblickWorker" "$APP_DIR/Contents/MacOS/RankblickWorker"
cp "$SOURCE_DIR/Sources/RankblickCore/Resources/seed.json" "$APP_DIR/Contents/Resources/seed.json"
cp "$SOURCE_DIR/Info.plist" "$APP_DIR/Contents/Info.plist"
swift "$SOURCE_DIR/make-icon.swift" "$BUILD_DIR/Rankblick.iconset"
iconutil -c icns "$BUILD_DIR/Rankblick.iconset" -o "$APP_DIR/Contents/Resources/AppIcon.icns"
xattr -rd com.apple.FinderInfo "$APP_DIR" 2>/dev/null || true
xattr -rd com.apple.ResourceFork "$APP_DIR" 2>/dev/null || true
xattr -d com.apple.FinderInfo "$APP_DIR" 2>/dev/null || true
codesign --force --deep --sign - "$APP_DIR"
codesign --verify --deep --strict "$APP_DIR"
ditto --norsrc --noextattr "$APP_DIR" "$TARGET_APP_DIR"
xattr -d com.apple.FinderInfo "$TARGET_APP_DIR" 2>/dev/null || true
codesign --verify --deep --strict "$TARGET_APP_DIR"
echo "Built: $TARGET_APP_DIR"
