package com.signage.player

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class HeartbeatService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private var heartbeatJob: Job? = null
    private lateinit var wakeLock: PowerManager.WakeLock

    override fun onCreate() {
        super.onCreate()
        SecurePrefs.init(this)
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "signage:heartbeat")
        wakeLock.acquire()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = NotificationCompat.Builder(this, SignageApp.CHANNEL_ID)
            .setContentTitle("Signage Player")
            .setContentText("Running")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIF_ID, notification)
        }

        if (heartbeatJob == null) {
            heartbeatJob = scope.launch {
                while (true) {
                    sendHeartbeat()
                    delay(60_000)
                }
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        if (wakeLock.isHeld) wakeLock.release()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private suspend fun sendHeartbeat() {
        val token = SecurePrefs.authToken ?: return
        try {
            DeviceApi.heartbeat(token, PlaybackState.currentItemId)
            Log.d(TAG, "Heartbeat sent — item=${PlaybackState.currentItemId}")
        } catch (e: Exception) {
            Log.w(TAG, "Heartbeat failed", e)
        }
    }

    companion object {
        private const val TAG = "HeartbeatService"
        private const val NOTIF_ID = 1
    }
}
