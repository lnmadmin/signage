package com.signage.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Log.i(TAG, "Boot completed — starting signage")

        // Service is always allowed from a receiver; starts heartbeats immediately.
        ContextCompat.startForegroundService(
            context,
            Intent(context, HeartbeatService::class.java),
        )

        // Launch the player activity. Works unconditionally in device-owner / kiosk
        // mode (Slice 6). On stock Android 10+ the OS may suppress this; the
        // notification from HeartbeatService lets the user tap to resume.
        context.startActivity(
            Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
        )
    }

    companion object {
        private const val TAG = "BootReceiver"
    }
}
