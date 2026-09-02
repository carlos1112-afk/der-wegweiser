#!/usr/bin/env bash
set -e

export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export ANDROID_AVD_HOME=/home/carlos/.config/.android/avd
ADB="/opt/android-sdk/platform-tools/adb"
EMULATOR="/opt/android-sdk/emulator/emulator"

echo "🚀 [EMULATOR] Launching Android Emulator (Wegweiser_Test_AVD) as permanent desktop process..."
nohup $EMULATOR -avd Wegweiser_Test_AVD -gpu auto -netdelay none -netspeed full </dev/null >/tmp/emulator.log 2>&1 &
disown

echo "⏳ [ADB] Waiting for device connection..."
$ADB wait-for-device

echo "⏳ [BOOT] Waiting for Android system boot completion..."
while true; do
    BOOT=$($ADB shell getprop sys.boot_completed 2>/dev/null || true)
    if [ "$BOOT" = "1" ]; then
        echo "✅ [BOOT] Android system boot completed!"
        break
    fi
    sleep 2
done

# Dismiss keyguard / screen lock
$ADB shell wm dismiss-keyguard || true
$ADB shell input keyevent 82 || true

echo "📦 [INSTALL] Installing Der Wegweiser (app-debug.apk)..."
$ADB install -r android/app/build/outputs/apk/debug/app-debug.apk

echo "🛡️ [PERMISSIONS] Granting location & notification permissions..."
$ADB shell pm grant app.derwegweiser.navi android.permission.ACCESS_FINE_LOCATION || true
$ADB shell pm grant app.derwegweiser.navi android.permission.ACCESS_COARSE_LOCATION || true
$ADB shell pm grant app.derwegweiser.navi android.permission.POST_NOTIFICATIONS || true

echo "🚲 [LAUNCH] Launching app.derwegweiser.navi/.MainActivity..."
$ADB shell am start -n app.derwegweiser.navi/.MainActivity

# Give WebView and React time to mount
echo "⏳ [WAIT] Waiting 8 seconds for React and map tiles to render..."
sleep 8

# Verify PID
APP_PID=$($ADB shell pidof app.derwegweiser.navi || true)
if [ -n "$APP_PID" ]; then
    echo "🎉 [SUCCESS] Der Wegweiser is RUNNING on emulator (PID: $APP_PID)!"
fi

# Capture live screen
SCREENSHOT_PATH="/home/carlos/.gemini/antigravity/brain/a6e8cbd3-e5c6-4872-a756-ad3e5b62a914/emulator_screen_live.png"
$ADB exec-out screencap -p > "$SCREENSHOT_PATH" || true
echo "📸 [SCREENSHOT] Captured live emulator screen to $SCREENSHOT_PATH"

echo "🌟 Android Emulator is permanently active on your desktop!"
