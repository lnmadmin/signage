package com.signage.player

import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.signage.player.databinding.ActivityMainBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        SecurePrefs.init(this)
        lifecycleScope.launch { startPairingFlow() }
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    // ── Pairing flow ──────────────────────────────────────────────────────────

    private suspend fun startPairingFlow() {
        // Already claimed — skip straight to ready screen
        if (SecurePrefs.authToken != null) {
            showClaimed()
            return
        }

        // Register if this is a first run (no deviceId stored yet)
        if (SecurePrefs.deviceId == null) {
            while (true) {
                showStatus("Registering…")
                try {
                    val reg = DeviceApi.register()
                    SecurePrefs.deviceId = reg.deviceId
                    SecurePrefs.registrationSecret = reg.registrationSecret
                    SecurePrefs.pairingCode = reg.pairingCode
                    Log.i("Signage", "Registered as ${reg.deviceId}, code ${reg.pairingCode}")
                    break
                } catch (e: Exception) {
                    Log.e("Signage", "register failed", e)
                    showStatus("Network error — retrying in 10s")
                    delay(10_000)
                }
            }
        }

        // Show the stored pairing code (survives restarts)
        showPairingCode(SecurePrefs.pairingCode ?: "------")

        // Poll /api/device/status until CLAIMED
        while (true) {
            delay(5_000)
            try {
                val s = DeviceApi.getStatus(
                    SecurePrefs.deviceId!!,
                    SecurePrefs.registrationSecret!!,
                )
                if (s.status == "CLAIMED" && s.authToken != null) {
                    SecurePrefs.authToken = s.authToken
                    Log.i("Signage", "Claimed — token stored")
                    showClaimed()
                    return
                }
            } catch (e: Exception) {
                Log.w("Signage", "status poll failed — will retry", e)
            }
        }
    }

    // ── UI helpers ────────────────────────────────────────────────────────────

    private fun showStatus(msg: String) {
        binding.pairingView.visibility = View.GONE
        binding.statusText.apply {
            visibility = View.VISIBLE
            text = msg
        }
    }

    private fun showPairingCode(code: String) {
        binding.pairingCode.text = code
        binding.statusText.visibility = View.GONE
        binding.pairingView.visibility = View.VISIBLE
    }

    private fun showClaimed() = showStatus("Claimed — ready to play")

    // ── Immersive mode ────────────────────────────────────────────────────────

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { ctrl ->
                ctrl.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                ctrl.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }
}
