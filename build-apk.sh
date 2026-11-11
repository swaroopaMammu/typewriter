#!/usr/bin/env bash
# Builds TypeWriter.apk (debug-signed, installable by sideloading). Needs Node and Android Studio installed.
set -e
cd "$(dirname "$0")"

# Java: use Android Studio's bundled JDK if JAVA_HOME is not set
if [ -z "$JAVA_HOME" ]; then
  for J in "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
           "/Applications/Android Studio Preview.app/Contents/jbr/Contents/Home"; do
    if [ -d "$J" ]; then export JAVA_HOME="$J"; break; fi
  done
fi
# Android SDK: default Android Studio location
if [ -z "$ANDROID_HOME" ]; then
  for S in "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
    if [ -n "$S" ] && [ -d "$S" ]; then export ANDROID_HOME="$S"; break; fi
  done
fi
[ -n "$JAVA_HOME" ] || { echo "Java not found. Install Android Studio, or set JAVA_HOME to a JDK 21."; exit 1; }
[ -n "$ANDROID_HOME" ] || { echo "Android SDK not found. Open Android Studio once and install the SDK, or set ANDROID_HOME."; exit 1; }
export PATH="$JAVA_HOME/bin:$PATH"
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"

echo "sdk.dir=$ANDROID_HOME" > android/local.properties
# accept SDK licences so Gradle can download any missing platform (ignore if the tool is absent)
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null 2>&1 || true

npm install
npm run build
npx cap sync android
( cd android && ./gradlew assembleDebug )

cp android/app/build/outputs/apk/debug/app-debug.apk TypeWriter.apk
echo
echo "Done. APK: $(pwd)/TypeWriter.apk"
