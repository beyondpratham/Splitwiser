#!/usr/bin/env bash
# Downloads a portable JDK 17 and the Android SDK into ./.toolchain (project-local, gitignored).
# Nothing is installed system-wide. Usage: npm run android:setup
set -eo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)/.toolchain"
mkdir -p "$ROOT/downloads"

# Windows antivirus can briefly lock freshly unzipped files, so retry, then fall back to copying.
move_dir() {
  for _ in 1 2 3 4 5; do mv "$1" "$2" 2>/dev/null && return 0; sleep 3; done
  cp -r "$1" "$2" && rm -rf "$1"
}

if [ ! -d "$ROOT/jdk" ]; then
  echo "→ Downloading JDK 17 (Temurin)…"
  [ -f "$ROOT/downloads/jdk.zip" ] || curl -fL -o "$ROOT/downloads/jdk.zip" \
    "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
  rm -rf "$ROOT/downloads/jdk-tmp"
  unzip -q "$ROOT/downloads/jdk.zip" -d "$ROOT/downloads/jdk-tmp"
  move_dir "$(ls -d "$ROOT/downloads/jdk-tmp/"*)" "$ROOT/jdk"
  rm -rf "$ROOT/downloads/jdk-tmp"
fi

SDK="$ROOT/android-sdk"
if [ ! -d "$SDK/cmdline-tools/latest" ]; then
  echo "→ Downloading Android command-line tools…"
  curl -fL -o "$ROOT/downloads/cmdline-tools.zip" \
    "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip"
  mkdir -p "$SDK/cmdline-tools"
  unzip -q "$ROOT/downloads/cmdline-tools.zip" -d "$SDK/cmdline-tools"
  move_dir "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
fi

export JAVA_HOME="$ROOT/jdk"
export ANDROID_HOME="$SDK"
export PATH="$JAVA_HOME/bin:$SDK/cmdline-tools/latest/bin:$PATH"

echo "→ Accepting licenses and installing SDK packages…"
yes | sdkmanager.bat --sdk_root="$SDK" --licenses > /dev/null || true
sdkmanager.bat --sdk_root="$SDK" "platform-tools" "platforms;android-36" "build-tools;36.0.0"

rm -rf "$ROOT/downloads"
echo "✓ Toolchain ready in .toolchain/"
