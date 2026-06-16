# Provisioning a Signage Stick (Device Owner / Kiosk Mode)

Setting the app as **Device Owner** unlocks lock-task kiosk mode (the user cannot press Home, Back, or Recents to exit) and makes the app the persistent home launcher so it starts automatically on boot, even on Android 10+.

---

## Prerequisites

1. **Factory-reset the device** — Device Owner can only be set on a device with no user accounts. If the device has ever had a Google account signed in, either factory-reset it or remove all accounts first (`Settings → Accounts → Remove account`).
2. **Enable USB debugging** — `Settings → Developer options → USB debugging`.
3. **Install the APK** via ADB before setting the Device Owner:
   ```
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

---

## Set Device Owner

```bash
adb shell dpm set-device-owner com.signage.player/.SignageDeviceAdmin
```

Expected output:
```
Success: Device owner set to package com.signage.player
```

Common errors:
- `Not allowed to set the device owner because there are already some accounts on the device` — factory-reset or remove all accounts and try again.
- `java.lang.IllegalStateException: Not allowed to set the device owner because there are already several users on the device` — only one user account is allowed; switch to the primary user.

---

## Launch the app

```bash
adb shell am start -n com.signage.player/.MainActivity
```

On first run with Device Owner active, the app will:
1. Call `setLockTaskPackages` to whitelist itself.
2. Register itself as the persistent home launcher via `addPersistentPreferredActivity`.
3. Call `startLockTask()` to enter kiosk mode — Home, Back, and Recents are suppressed.

From this point on, the app relaunches automatically on every boot without needing `BootReceiver` to start an Activity (the OS routes `ACTION_HOME` directly to `MainActivity`).

---

## Exiting kiosk mode (development only)

Lock-task mode prevents in-app exit. Use ADB to break out:

```bash
# Stop lock task on the currently focused task
adb shell am task lock-mode none
```

To fully remove Device Owner (this clears all DPM policies):

```bash
# Must be run while the app itself is device owner — call from within the app,
# or if you have root, use:
adb shell dpm remove-active-admin com.signage.player/.SignageDeviceAdmin
```

If `remove-active-admin` is blocked, factory-reset is the only option.

---

## Emulator testing note

The emulator does not enforce the "no accounts" restriction as strictly as a real device. You can usually set Device Owner directly on a fresh emulator AVD without a factory reset. Lock-task mode functions correctly on API 29+ emulators — the navigation bar buttons become unresponsive as expected.
