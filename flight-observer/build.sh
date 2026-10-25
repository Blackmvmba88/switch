#!/bin/zsh
set -euo pipefail
ROOT_DIR="${0:A:h}"
BUILD_DIR="$ROOT_DIR/.build"
APP_DIR="$BUILD_DIR/Flight Observer.app"
mkdir -p "$APP_DIR/Contents/MacOS"
swiftc "$ROOT_DIR/native/FlightObserver.swift" -o "$APP_DIR/Contents/MacOS/FlightObserver" -framework AppKit -framework GameController -framework ScreenCaptureKit -framework ImageIO -framework UniformTypeIdentifiers
cat > "$APP_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.blackmamba.flightobserver</string><key>CFBundleName</key><string>Flight Observer</string><key>CFBundleExecutable</key><string>FlightObserver</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>0.1.0</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/></dict></plist>
PLIST
codesign --force --sign - "$APP_DIR"
codesign --verify --strict "$APP_DIR"
print "Build verificado: $APP_DIR"
