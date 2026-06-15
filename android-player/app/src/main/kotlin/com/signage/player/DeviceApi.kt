package com.signage.player

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object DeviceApi {
    private val base get() = BuildConfig.BACKEND_URL
    private const val TAG = "DeviceApi"

    data class RegisterResponse(
        val deviceId: String,
        val pairingCode: String,
        val registrationSecret: String,
    )

    data class StatusResponse(
        val status: String,
        val authToken: String?,
    )

    suspend fun register(): RegisterResponse = withContext(Dispatchers.IO) {
        val conn = (URL("$base/api/device/register").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            outputStream.use { it.write("{}".toByteArray()) }
        }
        val body = conn.inputStream.bufferedReader().readText()
        Log.d(TAG, "register → $body")
        val j = JSONObject(body)
        RegisterResponse(
            deviceId = j.getString("deviceId"),
            pairingCode = j.getString("pairingCode"),
            registrationSecret = j.getString("registrationSecret"),
        )
    }

    suspend fun getStatus(deviceId: String, secret: String): StatusResponse = withContext(Dispatchers.IO) {
        val conn = (URL("$base/api/device/status?deviceId=$deviceId").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("X-Registration-Secret", secret)
        }
        val body = conn.inputStream.bufferedReader().readText()
        Log.d(TAG, "status → $body")
        val j = JSONObject(body)
        StatusResponse(
            status = j.getString("status"),
            authToken = if (j.has("authToken")) j.getString("authToken") else null,
        )
    }
}
