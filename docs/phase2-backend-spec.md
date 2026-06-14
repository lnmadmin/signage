# Phase 2 — Backend Spec (Data Model + Device API)

This is the core of the system: the data model, the admin API, and — most importantly — the **device pairing flow** and **content sync** that make screens register themselves and pull their content.

Build it in the slices at the bottom, one at a time, testing each before the next. Hand each prompt to Claude Code as-is.

---

## 1. Data model (Prisma)

Target schema. Claude Code will finalize/validate it against Prisma and generate the migration.

```prisma
model Location {
  id         String    @id @default(cuid())
  name       String
  notes      String?
  playlistId String?                 // default playlist for screens at this location
  playlist   Playlist? @relation("LocationPlaylist", fields: [playlistId], references: [id])
  devices    Device[]
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

model Device {
  id                 String       @id @default(cuid())
  name               String?                      // set by admin when claiming
  pairingCode        String?      @unique          // shown on the TV until claimed
  registrationSecret String?                       // returned at register; required to poll status
  status             DeviceStatus @default(PENDING)
  authToken          String?      @unique          // issued on claim; used for all device API calls
  lastSeenAt         DateTime?
  currentItemId      String?                       // what the device reports it is showing
  locationId         String?
  location           Location?    @relation(fields: [locationId], references: [id])
  playlistId         String?                       // optional per-device override of location default
  playlist           Playlist?    @relation("DevicePlaylist", fields: [playlistId], references: [id])
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
}

enum DeviceStatus {
  PENDING    // registered, code generated, not yet bound by an admin
  CLAIMED    // bound to a location, has a token, active
  DISABLED
}

model MediaAsset {
  id              String         @id @default(cuid())
  type            MediaType
  storageKey      String                          // object key in MinIO/S3
  filename        String
  mimeType        String
  sizeBytes       Int
  checksum        String                          // sha256 — the player uses this to decide what to re-download
  durationSeconds Int?                            // video length, or default display time for an image
  createdAt       DateTime       @default(now())
  items           PlaylistItem[]
}

enum MediaType {
  IMAGE
  VIDEO
  WEB
}

model Playlist {
  id        String         @id @default(cuid())
  name      String
  items     PlaylistItem[]
  locations Location[]     @relation("LocationPlaylist")
  devices   Device[]       @relation("DevicePlaylist")
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}

model PlaylistItem {
  id               String     @id @default(cuid())
  playlistId       String
  playlist         Playlist   @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  mediaAssetId     String
  mediaAsset       MediaAsset @relation(fields: [mediaAssetId], references: [id])
  order            Int                            // 0-based position in the loop
  durationOverride Int?                           // seconds; overrides the asset's default
}

model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}
```

**Key relationships:** a `Playlist` is assigned to a `Location` (the default for all its screens) and can also be assigned directly to a `Device` (an override). A `Device` belongs to a `Location`. `PlaylistItem` is the ordered join between a playlist and its media.

---

## 2. Admin API (protected by JWT)

All under `/api`, requiring `Authorization: Bearer <token>` except login.

- `POST /api/auth/login` — `{ email, password }` → `{ token }`
- **Locations**
  - `GET /api/locations`
  - `POST /api/locations` — `{ name, notes?, playlistId? }`
  - `PATCH /api/locations/:id`
  - `DELETE /api/locations/:id`
- **Media**
  - `POST /api/media` — multipart upload; server streams the file to MinIO, computes the sha256 checksum, stores the row
  - `GET /api/media`
  - `DELETE /api/media/:id`
- **Playlists**
  - `GET /api/playlists`, `GET /api/playlists/:id`
  - `POST /api/playlists` — `{ name }`
  - `PATCH /api/playlists/:id`
  - `PUT /api/playlists/:id/items` — replace the full ordered item list: `[{ mediaAssetId, order, durationOverride? }]`
  - `DELETE /api/playlists/:id`
- **Devices**
  - `GET /api/devices` — list with status, lastSeenAt, location, current item
  - `POST /api/devices/claim` — `{ pairingCode, name, locationId, playlistId? }` → binds a PENDING device (see flow below)
  - `PATCH /api/devices/:id` — rename, reassign location/playlist, disable
  - `DELETE /api/devices/:id`

---

## 3. Device API (the important part)

These endpoints are what the Android player calls. They use the device's own `authToken`, **not** the admin JWT.

### Pairing flow (a small state machine)

```
[new stick boots]
      │
      ▼
POST /api/device/register            (no auth)
  → server creates Device(status=PENDING),
    generates pairingCode + registrationSecret
  → returns { deviceId, pairingCode, registrationSecret }
      │
      ▼
device shows pairingCode big on the TV,
stores deviceId + registrationSecret locally
      │
      ▼
device polls GET /api/device/status      (header: X-Registration-Secret)
  → while PENDING: { status: "PENDING" }
      │
      │   ← meanwhile, in the CMS:
      │     admin types the pairingCode, names the device,
      │     picks a location → POST /api/devices/claim
      │     → status=CLAIMED, authToken issued, pairingCode cleared
      ▼
device's next poll returns { status: "CLAIMED", authToken }
  → device stores authToken, switches to playback mode
```

Endpoints:

- `POST /api/device/register` — no auth → `{ deviceId, pairingCode, registrationSecret }`
- `GET /api/device/status` — header `X-Registration-Secret`, query `deviceId` → `{ status, authToken? }`
  - The registration secret stops a stranger from polling someone else's deviceId and stealing a token.

### Content sync (manifest)

- `GET /api/device/manifest` — header `Authorization: Bearer <authToken>`

  **Resolution:** use `device.playlistId` if set, otherwise `device.location.playlistId`, otherwise empty.

  **Response:**
  ```json
  {
    "playlistId": "…",
    "updatedAt": "2026-…",
    "items": [
      {
        "itemId": "…",
        "type": "IMAGE",
        "checksum": "sha256-…",
        "durationSeconds": 10,
        "order": 0,
        "downloadUrl": "https://…presigned…"
      }
    ]
  }
  ```
  - `downloadUrl` is a short-lived **presigned URL** to MinIO/S3.
  - The player compares each item's `checksum` against its local cache, downloads only what's new or changed, and deletes anything no longer in the list.

### Heartbeat

- `POST /api/device/heartbeat` — header `Authorization: Bearer <authToken>`, body `{ currentItemId?, freeBytes? }`
  - Updates `lastSeenAt`, `currentItemId`. This is how the CMS shows online/offline and proof-of-play-lite.

---

## 4. Build order (paste these into Claude Code, one at a time)

> **Slice 1 — schema**
> In `backend`, add this Prisma schema [paste section 1]. Create the migration, generate the client, and write a seed script that creates one AdminUser from EMAIL and PASSWORD env vars (hash the password with bcrypt).

> **Slice 2 — admin auth**
> Add `POST /api/auth/login` that verifies an AdminUser's bcrypt password and returns a JWT. Add a JWT guard and apply it to all admin routes (everything except login and the `/api/device/*` routes). Put the JWT secret in env.

> **Slice 3 — media upload + storage**
> Add a media module: `POST /api/media` accepts a multipart file, streams it to MinIO (S3-compatible, config from env), computes a sha256 checksum, infers type from mime, and saves a MediaAsset row. Add `GET /api/media` and `DELETE /api/media/:id` (also delete the object from MinIO). Add a helper that issues short-lived presigned download URLs.

> **Slice 4 — playlists**
> Add playlist CRUD and `PUT /api/playlists/:id/items` that replaces the ordered item list. Items reference MediaAssets with an order and optional durationOverride.

> **Slice 5 — locations**
> Add location CRUD with an optional default playlistId.

> **Slice 6 — device pairing**
> Implement the device pairing flow exactly as specified [paste section 3 "Pairing flow"]: `POST /api/device/register`, `GET /api/device/status` (guarded by X-Registration-Secret), and the admin `POST /api/devices/claim`. Generate a 6-character uppercase pairing code and a random registration secret and auth token.

> **Slice 7 — manifest + heartbeat**
> Implement `GET /api/device/manifest` (resolve device override → location default, return ordered items with presigned downloadUrls and checksums) and `POST /api/device/heartbeat` (update lastSeenAt and currentItemId). Both guarded by the device authToken.

After each slice: test the endpoint (curl or the VS Code REST client), then `git add . && git commit -m "…" && git push`.

---

## 5. Definition of done for Phase 2

You can, entirely via API calls:

1. Log in as admin and get a token.
2. Upload an image and a video.
3. Create a playlist and add those items in order.
4. Create a location and set that playlist as its default.
5. Simulate a device: `register` → see PENDING → `claim` it from the admin side → poll `status` → receive an authToken.
6. Call `manifest` with that token and get back the right ordered items with working download URLs.
7. Post a `heartbeat` and see the device's lastSeenAt update.

Once all seven work, the backend is ready for the Android player (Phase 4) to talk to it for real.
