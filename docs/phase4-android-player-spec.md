# Phase 4 — Android Player Spec

The app that runs on each Android stick behind a TV. It registers itself, gets claimed in your CMS, pulls its assigned playlist, caches it locally, and plays it on a loop — continuing to play even when the network drops, and recovering automatically after a power cut. Built in Kotlin, in the `android-player` folder.

This is the second major build. Take it one slice at a time, and prove each on the Android emulator before a real stick.

---

## What it does (in priority order)

1. Launches straight into full-screen content and stays there — a user with a remote can't exit it (kiosk mode).
2. On first run, registers and shows a pairing code on the TV; once you claim it in the CMS, it starts playing.
3. Downloads its playlist and **caches it locally**, playing from cache so it survives network outages.
4. Plays images and video on a loop, advancing automatically.
5. Auto-starts on boot and restarts itself if it crashes.
6. Reports a heartbeat so the CMS shows it online.

---

## Before you start

- **Android Studio** installed, with the Android SDK on your D: drive (from Phase 0). Open the `android-player` folder as a project.
- A way to run it: either an **Android emulator** (create one in Android Studio's Device Manager, Android 11+), or a **real stick** with USB debugging enabled, connected via ADB.
- Target **minSdk 24** (covers Android 7+, which most cheap sticks run).

### The dev-networking gotchas (read this — they will bite otherwise)

The player runs *on the device*, so `localhost` means the device itself, not your PC. Two consequences:

1. **Backend URL:** point the player at your PC, not localhost. From the **emulator**, your PC is `http://10.0.2.2:3000`. From a **real stick on the same WiFi**, use your PC's LAN IP, e.g. `http://192.168.1.50:3000` (find it with `ipconfig`). Make the base URL a config value so you can switch easily.

2. **MinIO download URLs:** the manifest's `downloadUrl`s are presigned MinIO links. In dev they're generated pointing at `localhost:9000`, which the stick can't reach. Before testing downloads on a device, set the backend's MinIO endpoint to your PC's **LAN IP** (e.g. `192.168.1.50:9000`) so the presigned URLs are reachable from the stick. (In production this becomes your real S3/domain, so it's a dev-only adjustment.)

---

## Backend endpoints it uses (all from Phase 2, already built)

- `POST /api/device/register` → `{ deviceId, pairingCode, registrationSecret }`
- `GET /api/device/status?deviceId=…` with header `X-Registration-Secret` → `{ status, authToken? }`
- `GET /api/device/manifest` with header `Authorization: Bearer <authToken>` → `{ playlistId, updatedAt, items: [{ itemId, type, checksum, durationSeconds, order, downloadUrl }] }`
- `POST /api/device/heartbeat` with header `Authorization: Bearer <authToken>` → body `{ currentItemId?, freeBytes? }`

---

## Build slices (paste into Claude Code, one at a time)

> **Slice 1 — kiosk shell**
> In `android-player`, create a Kotlin Android app (minSdk 24) with a single full-screen Activity: immersive mode (hide status/nav bars), locked to landscape, screen kept on (`FLAG_KEEP_SCREEN_ON`). Add a config value for the backend base URL. For now just show a centered status text ("Starting…"). Make sure it builds and runs on the emulator.

> **Slice 2 — pairing**
> Add the pairing flow. On launch, if no auth token is stored: call `POST /api/device/register`, store the returned `deviceId` and `registrationSecret` in EncryptedSharedPreferences, and show the `pairingCode` large and centered on screen. Poll `GET /api/device/status` (with the `X-Registration-Secret` header and `deviceId`) every few seconds; when it returns CLAIMED, store the `authToken` and move to a placeholder "Claimed — ready to play" screen. If a token already exists on launch, skip straight to that screen.

> **Slice 3 — sync + local cache**
> Add a sync component that calls `GET /api/device/manifest` with the stored auth token. Maintain a local cache directory plus a small index of cached items keyed by `itemId` with their `checksum`. On each sync: download any item whose checksum isn't already cached (via its `downloadUrl`) to local storage, delete cached files no longer in the manifest, and update the index. Run sync on launch and then on a periodic timer (e.g. every 60s). Log what it downloads/removes.

> **Slice 4 — player loop**
> Build the playback loop using Media3/ExoPlayer. Play the cached manifest items in `order`, full-screen: images for their `durationSeconds` (falling back to a default), videos played to completion via ExoPlayer, then advance and loop back to the start. **Always play from the local cache**, never stream — so it works with no network. When the playlist is empty, show an idle screen. Track the current item.

> **Slice 5 — heartbeat + recovery**
> Add a foreground service that posts `POST /api/device/heartbeat` every ~60 seconds with the current item id. Add a `BOOT_COMPLETED` broadcast receiver that relaunches the app after the device powers on. Add a simple watchdog so the app restarts itself if it crashes. The goal: after a power cut, the screen returns to playing content with no human interaction.

> **Slice 6 — kiosk lock (Device Owner)**
> Add a `DeviceAdminReceiver` and enable lock-task (kiosk) mode so the app fully owns the screen and can't be exited with the remote. Write a short `PROVISIONING.md` explaining how to set the app as Device Owner on a reset stick via ADB (`adb shell dpm set-device-owner …`).

After each slice: run it on the emulator (and later a real stick), then commit and push.

---

## Definition of done for Phase 4

On a real Android stick (or emulator) pointed at your backend:

1. First boot shows a **pairing code** on screen.
2. You **claim it in the CMS** by that code and assign a location/playlist.
3. Within a sync cycle, the screen starts **playing the assigned content**.
4. You change the playlist in the CMS → the screen **updates on the next sync**.
5. You **kill the network** → it **keeps playing** from cache.
6. You **reboot the stick** → it **comes back to playing** with no interaction.
7. The device shows **"Online"** in your CMS devices table.

When all seven hold, you have a working signage system end to end — and Phase 5 is just proving this same loop reliably on the specific stick hardware you'll deploy, before the AWS deployment (Phase 6) and rollout (Phase 7).
