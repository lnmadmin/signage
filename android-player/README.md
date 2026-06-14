# Android Player

Native Android application for digital signage playback.

## Planned Stack

| Concern | Library |
|---|---|
| Language | Kotlin |
| Min SDK | API 26 (Android 8.0 Oreo) |
| Architecture | MVVM + Clean Architecture |
| Media playback | ExoPlayer (Media3) |
| MQTT (real-time commands) | Eclipse Paho MQTT Android |
| REST API | Retrofit + OkHttp |
| Local cache | Room |
| Image loading | Glide |
| DI | Hilt |

## Responsibilities

- Fetch scheduled playlists from the backend on startup and on interval
- Cache media assets locally for uninterrupted offline playback
- Subscribe to MQTT topics on the EMQX broker for real-time overrides (e.g. emergency alerts, immediate content push)
- Report playback heartbeat and status back to the backend

## Status

> Placeholder — implementation not started.
