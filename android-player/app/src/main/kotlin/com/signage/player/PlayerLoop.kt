package com.signage.player

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.ImageView
import androidx.lifecycle.LifecycleCoroutineScope
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Plays a list of [CachedItem]s on a loop.
 *
 * Images are displayed for [durationSeconds] (default [DEFAULT_DURATION_S]) then advanced.
 * Videos play to completion via ExoPlayer, then advance.
 * Always reads from local cache files — never streams.
 *
 * Call [setItems] after each sync; unchanged playlists are not interrupted.
 * Call [release] in onDestroy.
 */
class PlayerLoop(
    private val scope: LifecycleCoroutineScope,
    private val imageView: ImageView,
    private val playerView: PlayerView,
    private val onItemChanged: (itemId: String?) -> Unit,
) {
    private val player: ExoPlayer = ExoPlayer.Builder(imageView.context).build()
    private val handler = Handler(Looper.getMainLooper())

    private var items: List<CachedItem> = emptyList()
    private var index = 0
    private var imageRunnable: Runnable? = null
    // Guards against stale STATE_ENDED callbacks after player.stop() or item change
    private var videoActive = false

    var currentItemId: String? = null
        private set

    init {
        playerView.player = player
        playerView.useController = false

        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (videoActive && state == Player.STATE_ENDED) {
                    videoActive = false
                    advance()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                Log.e(TAG, "Video error — ${items.getOrNull(index)?.itemId}", error)
                videoActive = false
                advance()
            }
        })
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Updates the item list. If the playlist changed the loop restarts from the beginning.
     * If it is the same list (same order of itemIds), the currently-playing item is not
     * interrupted. If [newItems] is empty the idle state is shown.
     */
    fun setItems(newItems: List<CachedItem>) {
        val newIds = newItems.map { it.itemId }
        val oldIds = items.map { it.itemId }
        items = newItems

        when {
            newItems.isEmpty() -> showIdle()
            newIds != oldIds   -> { index = 0; playCurrentItem() }
            currentItemId == null -> { index = 0; playCurrentItem() }
            // Same playlist and already playing — leave it alone
        }
    }

    fun release() {
        cancelImageTimer()
        player.release()
    }

    fun resume() {
        if (videoActive && !player.isPlaying) player.play()
    }

    // ── Playback logic ────────────────────────────────────────────────────────

    private fun playCurrentItem() {
        cancelImageTimer()
        val item = items.getOrNull(index) ?: run { showIdle(); return }

        Log.i(TAG, "▶ [${index + 1}/${items.size}] ${item.itemId}  type=${item.type}")
        currentItemId = item.itemId
        onItemChanged(item.itemId)

        when (item.type.uppercase()) {
            "IMAGE" -> showImage(item)
            "VIDEO" -> showVideo(item)
            else -> {
                Log.w(TAG, "Unknown type '${item.type}' — skipping")
                advance()
            }
        }
    }

    private fun showImage(item: CachedItem) {
        videoActive = false
        player.stop()
        playerView.visibility = View.GONE

        // Decode off the main thread; guard against item changing while we were away.
        // Use decodeStream via FileInputStream — decodeFile can silently fail on Android 10+
        // with private-storage paths accessed through native Skia.
        scope.launch {
            val bitmap: Bitmap? = withContext(Dispatchers.IO) {
                try {
                    item.file.inputStream().buffered().use { BitmapFactory.decodeStream(it) }
                } catch (e: Exception) {
                    Log.e(TAG, "Cannot open ${item.file.absolutePath}: ${e.message}")
                    null
                }
            }
            if (items.getOrNull(index)?.itemId != item.itemId) return@launch

            if (bitmap == null) {
                Log.e(TAG, "Bitmap decode failed — ${item.file.absolutePath} — skipping")
                advance()
                return@launch
            }

            imageView.setImageBitmap(bitmap)
            imageView.visibility = View.VISIBLE

            val durationMs = (item.durationSeconds ?: DEFAULT_DURATION_S).toLong() * 1000L
            imageRunnable = Runnable { advance() }.also { handler.postDelayed(it, durationMs) }
        }
    }

    private fun showVideo(item: CachedItem) {
        cancelImageTimer()
        imageView.visibility = View.GONE

        videoActive = true
        player.setMediaItem(MediaItem.fromUri(Uri.fromFile(item.file)))
        player.prepare()
        player.play()
        playerView.visibility = View.VISIBLE
    }

    private fun advance() {
        if (items.isEmpty()) { showIdle(); return }
        cancelImageTimer()
        index = (index + 1) % items.size
        playCurrentItem()
    }

    private fun showIdle() {
        cancelImageTimer()
        videoActive = false
        player.stop()
        imageView.visibility = View.GONE
        playerView.visibility = View.GONE
        currentItemId = null
        onItemChanged(null)
    }

    private fun cancelImageTimer() {
        imageRunnable?.let { handler.removeCallbacks(it) }
        imageRunnable = null
    }

    companion object {
        private const val TAG = "PlayerLoop"
        const val DEFAULT_DURATION_S = 10
    }
}
