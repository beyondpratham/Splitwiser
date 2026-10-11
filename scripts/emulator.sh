#!/usr/bin/env bash
# Runs the APK in an Android emulator that lives entirely in ./.toolchain (SDK packages, virtual
# device and adb keys). Start the backend first: npm run local:backend
# Usage: npm run local:android        (builds dist/SplitWiser.apk first if it's missing)
set -eo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)/.toolchain"
[ -d "$ROOT/android-sdk" ] || bash scripts/setup-android.sh

export JAVA_HOME="$ROOT/jdk"
export ANDROID_HOME="$ROOT/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_USER_HOME="$ROOT/android-user"   # adb keys + emulator settings stay in the project
export ANDROID_AVD_HOME="$ROOT/avd"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
mkdir -p "$ANDROID_USER_HOME" "$ANDROID_AVD_HOME"

IMAGE="system-images;android-35;google_apis;x86_64"
if [ ! -d "$ANDROID_HOME/emulator" ] || [ ! -d "$ANDROID_HOME/system-images/android-35" ]; then
  echo "→ Installing the emulator and an Android 15 image (one time, ~1.5 GB)…"
  yes | sdkmanager.bat --sdk_root="$ANDROID_HOME" --licenses > /dev/null || true
  sdkmanager.bat --sdk_root="$ANDROID_HOME" "emulator" "platform-tools" "$IMAGE"
fi

if ! emulator -accel-check > /dev/null 2>&1; then
  echo "✗ Hardware acceleration isn't available, so the emulator would be unusably slow."
  echo "  Turn on 'Windows Hypervisor Platform' (Windows Features), enable virtualization in BIOS/UEFI, reboot,"
  echo "  then run this again. Meanwhile, npm run local runs the full app in your browser."
  emulator -accel-check || true
  exit 1
fi

if [ ! -f "$ANDROID_AVD_HOME/SplitWiser.ini" ]; then
  echo "→ Creating the virtual phone…"
  echo no | avdmanager.bat create avd -n SplitWiser -k "$IMAGE" -d pixel_7
  cat >> "$ANDROID_AVD_HOME/SplitWiser.avd/config.ini" <<'EOF'
hw.ramSize=2048
hw.keyboard=yes
hw.gpu.enabled=yes
hw.gpu.mode=auto
EOF
fi

[ -f dist/SplitWiser.apk ] || bash scripts/build-apk.sh

if ! adb devices | grep -q "emulator-"; then
  echo "→ Starting the emulator…"
  emulator -avd SplitWiser -no-snapshot-save -no-boot-anim -netdelay none -netspeed full > "$ROOT/emulator.log" 2>&1 &
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
fi

echo "→ Installing SplitWiser…"
adb reverse tcp:54321 tcp:54321   # the app's "Use local server" (localhost:54321) reaches this computer
adb install -r dist/SplitWiser.apk
adb shell monkey -p com.splitwiser.app -c android.intent.category.LAUNCHER 1 > /dev/null
echo "✓ SplitWiser is running in the emulator. Tap \"Use local server\" and sign in with alex@demo.app / demo1234."
