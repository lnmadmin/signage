# Phase 3 — CMS Web Admin Spec

The browser app your admins use to drive the Phase 2 backend. Built in `cms-web` (React + TypeScript + Vite, already scaffolded). The Vite dev proxy already forwards `/api` to the backend on port 3000, so all calls are just `fetch('/api/...')` — no CORS setup needed in dev.

Build it in the slices at the bottom, one at a time, testing each in the browser before the next. Hand each prompt to Claude Code as-is.

---

## What it needs to do

By the end, an admin can do the entire content workflow by clicking, never touching curl:

1. **Log in** and stay logged in.
2. **Upload and manage media** (images, video, web URLs).
3. **Build playlists** — pick media, order them, set how long each shows.
4. **Manage locations** and set each one's default playlist.
5. **Claim and manage devices** — type the pairing code shown on a screen, name it, assign a location, see which screens are online.

---

## Screens

- **Login** — email + password → `POST /api/auth/login`, store the returned JWT, redirect to the dashboard.
- **App shell** — a persistent sidebar (Media, Playlists, Locations, Devices) + a logout button; all pages live inside it. Unauthenticated visitors are redirected to Login.
- **Media library** — grid/list of uploaded assets with thumbnails (images) or type badges (video/web); an Upload button; delete.
- **Playlists** — list of playlists; an editor where you add media items, reorder them, and set a per-item duration; save.
- **Locations** — list; create/edit with a name, notes, and a default-playlist dropdown.
- **Devices** — table of devices showing name, location, online/offline (derived from `lastSeenAt`), and current item; a "Claim device" action; reassign/disable/delete.

---

## API it talks to (all from Phase 2)

- Auth: `POST /api/auth/login`
- Media: `GET /api/media`, `POST /api/media` (multipart), `DELETE /api/media/:id`
- Playlists: `GET/POST /api/playlists`, `GET /api/playlists/:id`, `PATCH /api/playlists/:id`, `PUT /api/playlists/:id/items`, `DELETE /api/playlists/:id`
- Locations: `GET/POST /api/locations`, `GET /api/locations/:id`, `PATCH /api/locations/:id`, `DELETE /api/locations/:id`
- Devices: `GET /api/devices`, `POST /api/devices/claim`, `PATCH /api/devices/:id`, `DELETE /api/devices/:id`

Every call except login sends `Authorization: Bearer <token>`. A single shared API client should attach the token and, on a 401, clear it and bounce to Login.

---

## Build order (paste into Claude Code, one at a time)

> **Slice A — shell + auth**
> In `cms-web`, build a shared API client (a `fetch` wrapper that attaches the JWT from storage and redirects to Login on 401). Add a Login page hitting `POST /api/auth/login` that stores the token. Add an authenticated app shell: a sidebar with links to Media, Playlists, Locations, Devices, plus a Logout button; redirect unauthenticated users to Login. Use a clean, consistent layout — don't leave it as unstyled defaults. No feature pages yet, just routing + auth + shell with empty placeholder pages.

> **Slice B — media library**
> Build the Media page: list assets from `GET /api/media` as a grid showing image thumbnails (a presigned/served URL) and a type badge for video/web. Add an Upload control that posts a multipart file to `POST /api/media` with an upload progress indicator, and a delete action calling `DELETE /api/media/:id`. Refresh the list after upload/delete.

> **Slice C — playlists**
> Build the Playlists page: list playlists, create one, and an editor for a single playlist where you add media from the library, reorder items (drag-and-drop or up/down controls), set an optional per-item duration, and save the full ordered list via `PUT /api/playlists/:id/items`. Support rename (`PATCH`) and delete.

> **Slice D — locations**
> Build the Locations page: list, create, and edit locations with a name, notes, and a default-playlist dropdown populated from `GET /api/playlists`. Support delete (surface the 409 nicely if the location still has devices).

> **Slice E — devices**
> Build the Devices page: a table from `GET /api/devices` showing name, location, current item, and an online/offline indicator derived from `lastSeenAt` (e.g. online if seen in the last 2 minutes). Add a "Claim device" dialog that takes a pairing code, name, location, and optional playlist and calls `POST /api/devices/claim`. Support reassigning location/playlist (`PATCH`) and delete. Auto-refresh the list every 30 seconds so status stays current.

After each slice: test it in the browser (run the backend with `npm run start:dev` in `backend`, and the CMS with `npm run dev` in `cms-web`), then commit and push.

---

## Design guidance

This is an internal admin tool, so favor clarity over flash: a fixed sidebar, readable data tables, obvious primary buttons, and consistent spacing. Ask Claude Code to use a consistent component style throughout rather than ad-hoc markup per page. A lightweight component library is fine if you want one. The goal is something your staff can learn in five minutes.

A note on the token: for an internal admin SPA, storing the JWT in `localStorage` is the pragmatic choice and is fine here. (httpOnly cookies are more XSS-resistant but need backend cooperation — worth considering later, not now.)

---

## Definition of done for Phase 3

Entirely through the browser, with no curl:

1. Log in; refreshing the page keeps you logged in.
2. Upload an image and see its thumbnail; upload a video.
3. Create a playlist, add those items, reorder them, set durations, save.
4. Create a location and set that playlist as its default.
5. Register a device (you can still do this step with curl, simulating a stick), then **claim it from the Devices page** by its pairing code and assign the location.
6. See the device appear in the table, and watch it flip to "online" when you post a heartbeat for it.

When all six work by clicking, your CMS is real — and Phase 4 (the Android player) becomes much easier to test, because you'll manage everything from this UI.
