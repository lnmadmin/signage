package com.signage.player

/** Mutable state shared between PlayerLoop (writer) and HeartbeatService (reader). */
object PlaybackState {
    @Volatile var currentItemId: String? = null
}
