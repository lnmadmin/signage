package com.signage.player

import android.app.AlarmManager
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.os.Process
import android.util.Log

class SignageApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        setupCrashRestart()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Signage Player",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Background sync and heartbeat"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun setupCrashRestart() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e(TAG, "Uncaught exception on ${thread.name} — scheduling restart", throwable)
            try {
                val launch = packageManager.getLaunchIntentForPackage(packageName)!!.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                }
                val pending = PendingIntent.getActivity(
                    applicationContext, 0, launch,
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE,
                )
                (getSystemService(ALARM_SERVICE) as AlarmManager)
                    .set(AlarmManager.RTC, System.currentTimeMillis() + 3_000L, pending)
            } catch (e: Exception) {
                Log.e(TAG, "Restart scheduling failed", e)
                defaultHandler?.uncaughtException(thread, throwable)
            }
            Process.killProcess(Process.myPid())
        }
    }

    companion object {
        const val CHANNEL_ID = "signage_service"
        private const val TAG = "SignageApp"
    }
}
