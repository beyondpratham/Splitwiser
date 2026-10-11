#!/usr/bin/env bash
# Builds an installable release APK using only the project-local toolchain (see setup-android.sh).
# Usage: npm run android:apk   →  dist/SplitWiser.apk
set -eo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
TOOLS="$ROOT/.toolchain"

if [ ! -d "$TOOLS/jdk" ] || [ ! -d "$TOOLS/android-sdk" ]; then
  bash scripts/setup-android.sh
fi

export JAVA_HOME="$TOOLS/jdk"
export ANDROID_HOME="$TOOLS/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
# Gradle's cache gets a deliberately tiny folder name: Windows limits paths to 260 characters and the
# native (C++) build reaches very deep into this cache.
export GRADLE_USER_HOME="$ROOT/.g"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export NODE_ENV=production

echo "→ Generating the native Android project…"
npx expo prebuild --platform android --no-install

# Point Gradle at the local SDK (forward slashes work on Windows too).
echo "sdk.dir=$(cygpath -m "$ANDROID_HOME" 2>/dev/null || echo "$ANDROID_HOME")" > android/local.properties

ARCHS="${ARCHS:-arm64-v8a}"
echo "→ Building release APK for $ARCHS…"
cd android
./gradlew assembleRelease -PreactNativeArchitectures="$ARCHS" --no-daemon --console=plain
cd ..

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/SplitWiser.apk
echo "✓ dist/SplitWiser.apk ($(du -h dist/SplitWiser.apk | cut -f1))"
