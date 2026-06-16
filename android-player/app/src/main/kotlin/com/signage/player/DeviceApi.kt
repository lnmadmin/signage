package com.signage.player

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
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

    data class ManifestItem(
        val itemId: String,
        val type: String,
        val checksum: String,
        val durationSeconds: Int?,
        val order: Int,
        val downloadUrl: String,
    )

    data class ManifestResponse(
        val playlistId: String?,
        val updatedAt: String?,
        val items: List<ManifestItem>,
    )

    private fun HttpURLConnection.readBody(): String {
        val code = responseCode
        return if (code in 200..299) {
            inputStream.bufferedReader().readText()
        } else {
            val err = errorStream?.bufferedReader()?.readText() ?: "(no error body)"
            throw IOException("HTTP $code: $err")
        }
    }

    suspend fun register(): RegisterResponse = withContext(Dispatchers.IO) {
        val conn = (URL("$base/api/device/register").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            outputStream.use { it.write("{}".toByteArray()) }
        }
        val body = conn.readBody()
        Log.d(TAG, "register → $body")
        val j = JSONObject(body)
        RegisterResponse(
            deviceId           = j.getString("deviceId"),
            pairingCode        = j.getString("pairingCode"),
            registrationSecret = j.getString("registrationSecret"),
        )
    }

    suspend fun getStatus(deviceId: String, secret: String): StatusResponse = withContext(Dispatchers.IO) {
        val conn = (URL("$base/api/device/status?deviceId=$deviceId").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("X-Registration-Secret", secret)
            connectTimeout = 15_000
            readTimeout = 15_000
        }
        val body = conn.readBody()
        Log.d(TAG, "status → $body")
        val j = JSONObject(body)
        StatusResponse(
            status    = j.getString("status"),
            authToken = j.optString("authToken").takeIf { it.isNotEmpty() && it != "null" },
        )
    }

    suspend fun heartbeat(authToken: String, currentItemId: String?) = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            currentItemId?.let { put("currentItemId", it) }
        }
        val conn = (URL("$base/api/device/heartbeat").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Authorization", "Bearer $authToken")
            setRequestProperty("Content-Type", "application/json")
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            outputStream.use { it.write(body.toString().toByteArray()) }
        }
        conn.readBody()
    }

    suspend fun getManifest(authToken: String): ManifestResponse = withContext(Dispatchers.IO) {
        Log.d(TAG, "manifest request — token prefix: ${authToken.take(8)}…")
        val conn = (URL("$base/api/device/manifest").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("Authorization", "Bearer $authToken")
            connectTimeout = 15_000
            readTimeout = 15_000
        }
        val body = conn.readBody()
        Log.d(TAG, "manifest → ${body.take(300)}")
        val j = JSONObject(body)
        val arr: JSONArray = j.getJSONArray("items")
        ManifestResponse(
            playlistId = j.optString("playlistId").takeIf { it.isNotEmpty() && it != "null" },
            updatedAt  = j.optString("updatedAt").takeIf  { it.isNotEmpty() && it != "null" },
            items = (0 until arr.length()).map { i ->
                val item = arr.getJSONObject(i)
                ManifestItem(
                    itemId          = item.getString("itemId"),
                    type            = item.getString("type"),
                    checksum        = item.getString("checksum"),
                    durationSeconds = if (item.isNull("durationSeconds")) null else item.getInt("durationSeconds"),
                    order           = item.getInt("order"),
                    downloadUrl     = item.getString("downloadUrl"),
                )
            },
        )
    }
}
