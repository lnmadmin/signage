package com.signage.player

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class CachedItem(
    val itemId: String,
    val type: String,
    val durationSeconds: Int?,
    val order: Int,
    val file: File,
    val mimeType: String,
)

data class SyncResult(
    val playlistId: String?,
    val items: List<CachedItem>,   // sorted by order, only fully-cached items
    val downloaded: Int,
    val removed: Int,
)

object SyncManager {
    private const val TAG = "SyncManager"
    private const val INDEX_FILE = "sync_index.json"
    private const val MEDIA_DIR = "media"

    private lateinit var mediaDir: File
    private lateinit var indexFile: File

    fun init(context: Context) {
        mediaDir = File(context.filesDir, MEDIA_DIR).also { it.mkdirs() }
        indexFile = File(context.filesDir, INDEX_FILE)
    }

    // ── Index I/O ─────────────────────────────────────────────────────────────

    private data class IndexEntry(val checksum: String, val filename: String, val mimeType: String)

    private fun readIndex(): MutableMap<String, IndexEntry> {
        if (!indexFile.exists()) return mutableMapOf()
        return try {
            val root = JSONObject(indexFile.readText())
            buildMap {
                root.keys().forEach { id ->
                    val e = root.getJSONObject(id)
                    put(id, IndexEntry(
                        checksum = e.getString("checksum"),
                        filename = e.getString("filename"),
                        mimeType = e.optString("mimeType", ""),
                    ))
                }
            }.toMutableMap()
        } catch (e: Exception) {
            Log.w(TAG, "Corrupt index — starting fresh", e)
            mutableMapOf()
        }
    }

    private fun writeIndex(index: Map<String, IndexEntry>) {
        val root = JSONObject()
        index.forEach { (id, e) ->
            root.put(id, JSONObject().apply {
                put("checksum", e.checksum)
                put("filename", e.filename)
                put("mimeType", e.mimeType)
            })
        }
        indexFile.writeText(root.toString(2))
    }

    // ── Sync ─────────────────────────────────────────────────────────────────

    suspend fun sync(authToken: String): SyncResult = withContext(Dispatchers.IO) {
        val manifest = DeviceApi.getManifest(authToken)
        val manifestIds = manifest.items.map { it.itemId }.toSet()
        val index = readIndex()

        var downloaded = 0
        var removed = 0

        // Download any item whose checksum isn't cached or whose file is missing
        for (item in manifest.items) {
            val cached = index[item.itemId]
            if (cached != null
                && cached.checksum == item.checksum
                && File(mediaDir, cached.filename).exists()
            ) continue

            try {
                val (filename, mimeType) = downloadToCache(item.downloadUrl, item.itemId)
                index[item.itemId] = IndexEntry(item.checksum, filename, mimeType)
                Log.i(TAG, "↓ ${item.itemId}  type=${item.type}  file=$filename")
                downloaded++
            } catch (e: Exception) {
                Log.e(TAG, "Failed to download ${item.itemId}", e)
            }
        }

        // Remove items that are no longer in the manifest
        val stale = index.keys.filter { it !in manifestIds }
        for (id in stale) {
            val entry = index.remove(id)!!
            if (File(mediaDir, entry.filename).delete()) {
                Log.i(TAG, "✕ $id  (${entry.filename}) removed from cache")
                removed++
            }
        }

        writeIndex(index)

        if (downloaded > 0 || removed > 0) {
            Log.i(TAG, "Sync done — ↓$downloaded  ✕$removed  total=${index.size}")
        } else {
            Log.d(TAG, "Sync — nothing changed (${index.size} cached)")
        }

        val items = manifest.items.mapNotNull { item ->
            val entry = index[item.itemId] ?: return@mapNotNull null
            val file = File(mediaDir, entry.filename)
            if (!file.exists()) return@mapNotNull null
            CachedItem(
                itemId          = item.itemId,
                type            = item.type,
                durationSeconds = item.durationSeconds,
                order           = item.order,
                file            = file,
                mimeType        = entry.mimeType,
            )
        }.sortedBy { it.order }

        SyncResult(manifest.playlistId, items, downloaded, removed)
    }

    // ── Download helpers ──────────────────────────────────────────────────────

    private fun downloadToCache(url: String, itemId: String): Pair<String, String> {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout    = 120_000
        }
        val mimeType = conn.contentType?.substringBefore(';')?.trim() ?: "application/octet-stream"
        val ext = extensionFor(mimeType)
        val filename = "$itemId$ext"
        val tmp = File(mediaDir, "$itemId.tmp")
        try {
            conn.inputStream.use { src -> tmp.outputStream().use { dst -> src.copyTo(dst) } }
            tmp.renameTo(File(mediaDir, filename))
        } catch (e: Exception) {
            tmp.delete()
            throw e
        }
        return filename to mimeType
    }

    private fun extensionFor(mime: String): String = when {
        mime.startsWith("image/jpeg")       -> ".jpg"
        mime.startsWith("image/png")        -> ".png"
        mime.startsWith("image/gif")        -> ".gif"
        mime.startsWith("image/webp")       -> ".webp"
        mime.startsWith("video/mp4")        -> ".mp4"
        mime.startsWith("video/webm")       -> ".webm"
        mime.startsWith("video/quicktime")  -> ".mov"
        mime.startsWith("video/x-matroska") -> ".mkv"
        mime.startsWith("text/")            -> ".txt"
        else                                -> ".bin"
    }

    // ── Accessors for the player (Slice 4) ───────────────────────────────────

    fun cachedFile(itemId: String): File? {
        val entry = readIndex()[itemId] ?: return null
        return File(mediaDir, entry.filename).takeIf { it.exists() }
    }
}
