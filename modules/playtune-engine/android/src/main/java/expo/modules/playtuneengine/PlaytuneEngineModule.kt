package expo.modules.playtuneengine

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.Executor

/** One song in the queue, sent from JS. */
class QueueItemRecord : Record {
  @Field val id: String = ""
  @Field val uri: String = ""
  @Field val title: String = ""
  @Field val artist: String? = null
  @Field val album: String? = null
}

/**
 * JS ↔ engine bridge.
 * Playback goes through a Media3 MediaController connected to PlaybackService,
 * which works the same whether the app was just opened or music was already playing.
 * Controller calls must run on the main thread, hence runOnQueue(Queues.MAIN).
 */
class PlaytuneEngineModule : Module() {

  private val tag = PlaybackService.TAG
  private val mainHandler = Handler(Looper.getMainLooper())
  private val mainExecutor = Executor { mainHandler.post(it) }

  private var controller: MediaController? = null
  private var controllerFuture: ListenableFuture<MediaController>? = null
  private val waiting = mutableListOf<(MediaController?) -> Unit>()

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }.applicationContext

  override fun definition() = ModuleDefinition {
    Name("PlaytuneEngine")

    Events("onPlayerState", "onTrackChange", "onError")

    OnDestroy {
      mainHandler.post { releaseController() }
    }

    // ---------- Info ----------

    Function("getEngineInfo") { ->
      mapOf<String, Any?>(
        "engineVersion" to "1.0.0",
        "media3Version" to "1.10.0",
        "androidSdk" to Build.VERSION.SDK_INT
      )
    }

    // ---------- Library ----------

    AsyncFunction("scanSongs") { minDurationMs: Double ->
      if (!hasAudioPermission()) {
        throw CodedException("ERR_PERMISSION", "Music access is not granted", null)
      }
      val start = SystemClock.elapsedRealtime()
      val songs = SongScanner.scan(context, minDurationMs.toLong())
      Log.d(tag, "[scan] ${songs.size} songs in ${SystemClock.elapsedRealtime() - start}ms (min ${minDurationMs.toLong()}ms)")
      songs
    }

    AsyncFunction("getArtwork") { id: String, size: Int ->
      id.toLongOrNull()?.let { ArtworkLoader.cachedFileUri(context, it, size) }
    }

    AsyncFunction("clearArtworkCache") { ->
      val count = ArtworkLoader.clearCache(context)
      Log.d(tag, "[artwork] cache cleared — $count files")
      count
    }

    AsyncFunction("getLastSession") { ->
      val prefs = context.getSharedPreferences(PlaybackService.PREFS, Context.MODE_PRIVATE)
      val queue = prefs.getString("queue", "") ?: ""
      if (queue.isEmpty()) {
        null
      } else {
        mapOf<String, Any?>(
          "mediaIds" to queue.split(","),
          "index" to prefs.getInt("index", 0),
          "positionMs" to prefs.getLong("position", 0L).toDouble()
        )
      }
    }

    // ---------- Queue ----------

    AsyncFunction("setQueue") { items: List<QueueItemRecord>, startIndex: Int, startPositionMs: Double, playNow: Boolean, promise: Promise ->
      withController(promise) { c ->
        val mediaItems = items.map { it.toMediaItem() }
        val index = startIndex.coerceIn(0, (mediaItems.size - 1).coerceAtLeast(0))
        c.setMediaItems(mediaItems, index, startPositionMs.toLong())
        c.prepare()
        if (playNow) c.play()
        Log.d(tag, "[queue] set ${mediaItems.size} songs, start=$index at ${startPositionMs.toLong()}ms, play=$playNow")
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("addToQueue") { items: List<QueueItemRecord>, playNext: Boolean, promise: Promise ->
      withController(promise) { c ->
        val mediaItems = items.map { it.toMediaItem() }
        if (playNext && c.mediaItemCount > 0) {
          c.addMediaItems(c.currentMediaItemIndex + 1, mediaItems)
        } else {
          c.addMediaItems(mediaItems)
        }
        if (c.playbackState == Player.STATE_IDLE) c.prepare()
        Log.d(tag, "[queue] added ${mediaItems.size} songs (playNext=$playNext), total ${c.mediaItemCount}")
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("removeFromQueue") { index: Int, promise: Promise ->
      withController(promise) { c ->
        if (index in 0 until c.mediaItemCount) c.removeMediaItem(index)
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("moveInQueue") { from: Int, to: Int, promise: Promise ->
      withController(promise) { c ->
        if (from in 0 until c.mediaItemCount && to in 0 until c.mediaItemCount) c.moveMediaItem(from, to)
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getQueueIds") { promise: Promise ->
      withController(promise) { c ->
        (0 until c.mediaItemCount).map { c.getMediaItemAt(it).mediaId }
      }
    }.runOnQueue(Queues.MAIN)

    // ---------- Playback ----------

    AsyncFunction("play") { promise: Promise ->
      withController(promise) { c -> startPlaying(c); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { promise: Promise ->
      withController(promise) { c -> c.pause(); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("togglePlay") { promise: Promise ->
      withController(promise) { c ->
        if (c.isPlaying) c.pause() else startPlaying(c)
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("next") { promise: Promise ->
      withController(promise) { c -> c.seekToNext(); null }
    }.runOnQueue(Queues.MAIN)

    // Restarts the song if it played more than ~3 s, otherwise goes to the previous one.
    AsyncFunction("previous") { promise: Promise ->
      withController(promise) { c -> c.seekToPrevious(); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("skipToIndex") { index: Int, promise: Promise ->
      withController(promise) { c ->
        if (index in 0 until c.mediaItemCount) {
          c.seekToDefaultPosition(index)
          startPlaying(c)
        }
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("seekTo") { positionMs: Double, promise: Promise ->
      withController(promise) { c -> c.seekTo(positionMs.toLong()); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") { promise: Promise ->
      withController(promise) { c -> c.stop(); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setRepeatMode") { mode: String, promise: Promise ->
      withController(promise) { c ->
        c.repeatMode = when (mode) {
          "all" -> Player.REPEAT_MODE_ALL
          "one" -> Player.REPEAT_MODE_ONE
          else -> Player.REPEAT_MODE_OFF
        }
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setShuffle") { enabled: Boolean, promise: Promise ->
      withController(promise) { c -> c.shuffleModeEnabled = enabled; null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getState") { promise: Promise ->
      withController(promise) { c -> snapshot(c) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getProgress") { promise: Promise ->
      withController(promise) { c ->
        mapOf<String, Any?>(
          "positionMs" to c.currentPosition.toDouble(),
          "durationMs" to durationOf(c),
          "bufferedMs" to c.bufferedPosition.toDouble()
        )
      }
    }.runOnQueue(Queues.MAIN)

    // ---------- Equalizer ----------

    AsyncFunction("getEqualizer") { promise: Promise ->
      withController(promise) { eqInfo() }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setEqualizerEnabled") { enabled: Boolean, promise: Promise ->
      withController(promise) {
        PlaybackService.instance?.equalizer?.setEnabled(enabled)
        eqInfo()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setBandLevel") { band: Int, levelMb: Int, promise: Promise ->
      withController(promise) {
        PlaybackService.instance?.equalizer?.setBandLevel(band, levelMb)
        eqInfo()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("usePreset") { index: Int, promise: Promise ->
      withController(promise) {
        PlaybackService.instance?.equalizer?.usePreset(index)
        eqInfo()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setBassBoost") { strength: Int, promise: Promise ->
      withController(promise) {
        PlaybackService.instance?.equalizer?.setBassBoost(strength)
        eqInfo()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setVirtualizer") { strength: Int, promise: Promise ->
      withController(promise) {
        PlaybackService.instance?.equalizer?.setVirtualizer(strength)
        eqInfo()
      }
    }.runOnQueue(Queues.MAIN)
  }

  // ---------- Helpers ----------

  private fun hasAudioPermission(): Boolean {
    val permission =
      if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO
      else Manifest.permission.READ_EXTERNAL_STORAGE
    return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
  }

  private fun QueueItemRecord.toMediaItem(): MediaItem =
    MediaItem.Builder()
      .setMediaId(id)
      .setUri(uri)
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle(title)
          .setArtist(artist ?: "Unknown artist")
          .setAlbumTitle(album)
          .setArtworkUri(ArtworkBitmapLoader.artworkUri(id))
          .setIsPlayable(true)
          .setIsBrowsable(false)
          .build()
      )
      .build()

  private fun startPlaying(c: MediaController) {
    if (c.playbackState == Player.STATE_IDLE) c.prepare()
    if (c.playbackState == Player.STATE_ENDED) c.seekToDefaultPosition()
    c.play()
  }

  private fun eqInfo(): Map<String, Any?> =
    PlaybackService.instance?.equalizer?.info() ?: mapOf("supported" to false)

  private fun durationOf(p: Player): Double =
    if (p.duration == C.TIME_UNSET) 0.0 else p.duration.toDouble()

  private fun stateName(state: Int) = when (state) {
    Player.STATE_BUFFERING -> "buffering"
    Player.STATE_READY -> "ready"
    Player.STATE_ENDED -> "ended"
    else -> "idle"
  }

  private fun repeatName(mode: Int) = when (mode) {
    Player.REPEAT_MODE_ALL -> "all"
    Player.REPEAT_MODE_ONE -> "one"
    else -> "off"
  }

  private fun transitionName(reason: Int) = when (reason) {
    Player.MEDIA_ITEM_TRANSITION_REASON_AUTO -> "auto"
    Player.MEDIA_ITEM_TRANSITION_REASON_SEEK -> "seek"
    Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT -> "repeat"
    else -> "playlist"
  }

  private fun snapshot(p: Player): Map<String, Any?> = mapOf(
    "isPlaying" to p.isPlaying,
    "playWhenReady" to p.playWhenReady,
    "state" to stateName(p.playbackState),
    "repeatMode" to repeatName(p.repeatMode),
    "shuffle" to p.shuffleModeEnabled,
    "index" to p.currentMediaItemIndex,
    "mediaId" to p.currentMediaItem?.mediaId,
    "queueLength" to p.mediaItemCount,
    "positionMs" to p.currentPosition.toDouble(),
    "durationMs" to durationOf(p)
  )

  private val playerListener = object : Player.Listener {
    override fun onEvents(player: Player, events: Player.Events) {
      if (events.containsAny(
          Player.EVENT_IS_PLAYING_CHANGED,
          Player.EVENT_PLAY_WHEN_READY_CHANGED,
          Player.EVENT_PLAYBACK_STATE_CHANGED,
          Player.EVENT_MEDIA_ITEM_TRANSITION,
          Player.EVENT_REPEAT_MODE_CHANGED,
          Player.EVENT_SHUFFLE_MODE_ENABLED_CHANGED,
          Player.EVENT_TIMELINE_CHANGED,
          Player.EVENT_POSITION_DISCONTINUITY
        )
      ) {
        sendEvent("onPlayerState", snapshot(player))
      }
    }

    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
      sendEvent("onTrackChange", mapOf("mediaId" to mediaItem?.mediaId, "reason" to transitionName(reason)))
    }

    override fun onPlayerError(error: PlaybackException) {
      sendEvent(
        "onError",
        mapOf(
          "code" to error.errorCodeName,
          "message" to (error.message ?: "Playback error"),
          "mediaId" to controller?.currentMediaItem?.mediaId
        )
      )
    }
  }

  /** Runs [block] with a connected controller (connecting first if needed), on the main thread. */
  private fun withController(promise: Promise, block: (MediaController) -> Any?) {
    val run: (MediaController?) -> Unit = { c ->
      if (c == null) {
        promise.reject("ERR_ENGINE_CONNECT", "Could not connect to the playback service", null)
      } else {
        try {
          promise.resolve(block(c))
        } catch (e: Throwable) {
          Log.w(tag, "[engine] call failed: ${e.message}", e)
          promise.reject("ERR_ENGINE", e.message ?: e.toString(), e)
        }
      }
    }

    val current = controller
    if (current != null && current.isConnected) {
      run(current)
      return
    }
    waiting.add(run)
    if (controllerFuture == null) connect()
  }

  private fun connect() {
    val ctx = context
    val token = SessionToken(ctx, ComponentName(ctx, PlaybackService::class.java))
    val start = SystemClock.elapsedRealtime()
    Log.d(tag, "[engine] connecting to playback service…")

    val future = MediaController.Builder(ctx, token)
      .setListener(object : MediaController.Listener {
        override fun onDisconnected(controller: MediaController) {
          mainHandler.post {
            Log.d(tag, "[engine] disconnected from playback service")
            this@PlaytuneEngineModule.controller = null
            controllerFuture = null
          }
        }
      })
      .buildAsync()
    controllerFuture = future

    future.addListener({
      val c = try {
        future.get()
      } catch (e: Exception) {
        Log.w(tag, "[engine] connect failed: ${e.message}", e)
        null
      }
      if (c == null) {
        controllerFuture = null
      } else {
        controller = c
        c.addListener(playerListener)
        Log.d(tag, "[engine] connected in ${SystemClock.elapsedRealtime() - start}ms — queue=${c.mediaItemCount} playing=${c.isPlaying}")
      }
      val pending = waiting.toList()
      waiting.clear()
      pending.forEach { it(c) }
    }, mainExecutor)
  }

  private fun releaseController() {
    controller?.removeListener(playerListener)
    controllerFuture?.let { MediaController.releaseFuture(it) }
    controller = null
    controllerFuture = null
    waiting.clear()
  }
}
