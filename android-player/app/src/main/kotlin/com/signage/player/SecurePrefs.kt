package com.signage.player

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object SecurePrefs {
    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        if (prefs != null) return
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context,
            "signage_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private fun read(key: String): String? = prefs!!.getString(key, null)
    private fun write(key: String, value: String?) =
        prefs!!.edit().apply { if (value != null) putString(key, value) else remove(key) }.apply()

    var deviceId: String?
        get() = read("deviceId")
        set(value) { write("deviceId", value) }

    var registrationSecret: String?
        get() = read("regSecret")
        set(value) { write("regSecret", value) }

    var pairingCode: String?
        get() = read("pairingCode")
        set(value) { write("pairingCode", value) }

    var authToken: String?
        get() = read("authToken")
        set(value) { write("authToken", value) }
}
