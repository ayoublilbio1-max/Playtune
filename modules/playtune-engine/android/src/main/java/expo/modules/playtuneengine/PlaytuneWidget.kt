package expo.modules.playtuneengine

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Log
import android.widget.RemoteViews
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import java.util.concurrent.Executor
import java.util.concurrent.Executors

/**
 * Home-screen widgets, both drawn here:
 * - PlaytuneWidget (4×2): cover (or the Playtune disc logo), title, artist, previous / play-pause / next.
 * - PlaytuneWidgetSquare (2×2): cover (or the disc logo), title, artist, play-pause / next.
 *
 * - The player service calls refresh() on every song / play-state change.
 * - A song change sends the picture (full update); play / pause only changes the button (partial update).
 * - Buttons send a broadcast back here. If the service is running, its player is used directly;
 *   if the app was closed, a MediaController starts the service, restores the last queue and plays.
 */
object PlaytuneWidgets {
  private const val TAG = "PlaytuneEngine"
  const val ACTION_PLAY_PAUSE = "expo.modules.playtuneengine.widget.PLAY_PAUSE"
  const val ACTION_NEXT = "expo.modules.playtuneengine.widget.NEXT"
  const val ACTION_PREV = "expo.modules.playtuneengine.widget.PREV"

  private const val ART_SIZE = 256

  private val worker = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val mainExecutor = Executor { mainHandler.post(it) }

  // Cover of the current song (null = the song has no cover → Playtune disc logo).
  @Volatile private var artId: String? = null
  @Volatile private var coverBitmap: Bitmap? = null

  private fun prefs(context: Context) =
    context.getSharedPreferences(PlaybackService.PREFS, Context.MODE_PRIVATE)

  private fun ids(context: Context, provider: Class<*>): IntArray =
    AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, provider))

  private fun hasWidgets(context: Context) =
    ids(context, PlaytuneWidget::class.java).isNotEmpty() || ids(context, PlaytuneWidgetSquare::class.java).isNotEmpty()

  /** Called by the service (main thread): saves what is playing and redraws every widget. */
  fun refresh(context: Context, player: Player?) {
    val p = prefs(context)
    val item = player?.currentMediaItem
    val meta = player?.mediaMetadata
    val newId = item?.mediaId
    val songChanged = newId != p.getString("w_id", null)
    p.edit()
      .putString("w_id", newId)
      .putString("w_title", meta?.title?.toString() ?: item?.mediaMetadata?.title?.toString())
      .putString("w_artist", meta?.artist?.toString() ?: item?.mediaMetadata?.artist?.toString())
      .putBoolean("w_playing", player?.isPlaying == true)
      .apply()
    redraw(context.applicationContext, full = songChanged || newId != artId)
  }

  /** The service is going away: show the last song as paused. */
  fun refreshStopped(context: Context) {
    prefs(context).edit().putBoolean("w_playing", false).apply()
    redraw(context.applicationContext, full = false)
  }

  /** Draws every widget. `full` re-sends the picture (song changed); otherwise only the play button changes. */
  fun redraw(context: Context, full: Boolean) {
    if (!hasWidgets(context)) return
    val songId = prefs(context).getString("w_id", null)
    if (songId != null && songId != artId) {
      // New song: load its cover off the main thread, then draw everything.
      push(context, full = true, artReady = false)
      worker.execute {
        val start = System.currentTimeMillis()
        val cover = songId.toLongOrNull()?.let { ArtworkLoader.loadBitmap(context, it, ART_SIZE) }?.let { rounded(it) }
        artId = songId
        coverBitmap = cover
        Log.d(TAG, "[widget] ${if (cover != null) "cover" else "disc logo"} for $songId in ${System.currentTimeMillis() - start}ms")
        mainHandler.post { push(context, full = true, artReady = true) }
      }
    } else {
      push(context, full, artReady = true)
    }
  }

  private fun push(context: Context, full: Boolean, artReady: Boolean) {
    val manager = AppWidgetManager.getInstance(context)
    val wide = ids(context, PlaytuneWidget::class.java)
    val square = ids(context, PlaytuneWidgetSquare::class.java)
    try {
      if (wide.isNotEmpty()) {
        val views = build(context, R.layout.pt_widget, full && artReady)
        if (full) manager.updateAppWidget(wide, views) else manager.partiallyUpdateAppWidget(wide, views)
      }
      if (square.isNotEmpty()) {
        val views = build(context, R.layout.pt_widget_square, full && artReady)
        if (full) manager.updateAppWidget(square, views) else manager.partiallyUpdateAppWidget(square, views)
      }
    } catch (e: Exception) {
      Log.w(TAG, "[widget] update failed: ${e.message}")
    }
  }

  /** Builds one widget. With `withArt`, the picture (cover or disc logo) is included. */
  fun build(context: Context, layout: Int, withArt: Boolean): RemoteViews {
    val p = prefs(context)
    val songId = p.getString("w_id", null)
    val hasSong = songId != null
    val playing = hasSong && p.getBoolean("w_playing", false)
    val views = RemoteViews(context.packageName, layout)

    views.setTextViewText(
      R.id.pt_widget_title,
      if (hasSong) p.getString("w_title", null) ?: context.getString(R.string.pt_widget_unknown_song)
      else context.getString(R.string.pt_widget_label)
    )
    views.setTextViewText(
      R.id.pt_widget_artist,
      if (hasSong) p.getString("w_artist", null) ?: context.getString(R.string.pt_widget_unknown_artist)
      else context.getString(R.string.pt_widget_empty)
    )

    if (withArt) {
      val cover = if (hasSong && artId == songId) coverBitmap else null
      if (cover != null) views.setImageViewBitmap(R.id.pt_widget_art, cover)
      else views.setImageViewResource(R.id.pt_widget_art, R.drawable.pt_disc_logo)
    }

    views.setImageViewResource(
      R.id.pt_widget_play,
      if (playing) R.drawable.ic_pt_widget_pause else R.drawable.ic_pt_widget_play
    )
    views.setContentDescription(
      R.id.pt_widget_play,
      context.getString(if (playing) R.string.pt_widget_pause else R.string.pt_widget_play)
    )

    views.setOnClickPendingIntent(R.id.pt_widget_play, actionIntent(context, ACTION_PLAY_PAUSE, 1))
    views.setOnClickPendingIntent(R.id.pt_widget_next, actionIntent(context, ACTION_NEXT, 2))
    if (layout == R.layout.pt_widget) {
      views.setOnClickPendingIntent(R.id.pt_widget_prev, actionIntent(context, ACTION_PREV, 3))
    }
    views.setOnClickPendingIntent(R.id.pt_widget_root, openAppIntent(context))
    return views
  }

  /** Cover with rounded corners (widgets can't clip pictures themselves on older Android). */
  private fun rounded(source: Bitmap): Bitmap {
    val side = minOf(source.width, source.height)
    val square = Bitmap.createBitmap(source, (source.width - side) / 2, (source.height - side) / 2, side, side)
    val output = Bitmap.createBitmap(side, side, Bitmap.Config.ARGB_8888)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      shader = BitmapShader(square, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
    }
    val radius = side * 0.16f
    Canvas(output).drawRoundRect(RectF(0f, 0f, side.toFloat(), side.toFloat()), radius, radius, paint)
    return output
  }

  private fun actionIntent(context: Context, action: String, code: Int): PendingIntent {
    val intent = Intent(context, PlaytuneWidget::class.java).setAction(action)
    return PendingIntent.getBroadcast(
      context,
      code,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
  }

  private fun openAppIntent(context: Context): PendingIntent {
    val intent = (context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()).apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("playtune://player")
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
      context,
      10,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
  }

  private fun perform(player: Player, action: String) {
    when (action) {
      ACTION_PLAY_PAUSE -> {
        if (player.isPlaying) {
          player.pause()
        } else {
          if (player.playbackState == Player.STATE_IDLE) player.prepare()
          if (player.playbackState == Player.STATE_ENDED) player.seekToDefaultPosition()
          player.play()
        }
      }
      ACTION_NEXT -> {
        if (player.playbackState == Player.STATE_IDLE) player.prepare()
        player.seekToNext()
      }
      ACTION_PREV -> {
        if (player.playbackState == Player.STATE_IDLE) player.prepare()
        player.seekToPrevious()
      }
    }
  }

  /** Button taps from either widget. */
  fun handleAction(context: Context, intent: Intent, goAsync: () -> android.content.BroadcastReceiver.PendingResult) {
    val action = intent.action ?: return
    if (action != ACTION_PLAY_PAUSE && action != ACTION_NEXT && action != ACTION_PREV) return
    Log.d(TAG, "[widget] ${action.substringAfterLast('.')} tapped")

    // App open or music playing: the service is alive, use its player directly.
    val running = PlaybackService.instance?.currentPlayer()
    if (running != null && running.mediaItemCount > 0) {
      perform(running, action)
      return
    }

    // App closed: start the service through a controller, restore the last queue, then act.
    val pending = goAsync()
    val app = context.applicationContext
    val token = SessionToken(app, ComponentName(app, PlaybackService::class.java))
    val future = MediaController.Builder(app, token).buildAsync()
    future.addListener({
      try {
        val controller = future.get()
        val ready = controller.mediaItemCount > 0 || restoreLastQueue(app, controller)
        if (ready) {
          perform(controller, action)
        } else {
          Log.d(TAG, "[widget] nothing to play yet — opening the app")
          openAppIntent(app).send()
        }
        // Give the service a moment to take over playback before letting go of the controller.
        mainHandler.postDelayed({
          controller.release()
          pending.finish()
        }, 1500)
      } catch (e: Exception) {
        Log.w(TAG, "[widget] could not reach the player: ${e.message}")
        pending.finish()
      }
    }, mainExecutor)
  }

  /** Rebuilds the last queue the service saved (song ids, current index, position). */
  private fun restoreLastQueue(context: Context, player: Player): Boolean {
    val p = prefs(context)
    val ids = (p.getString("queue", "") ?: "").split(",").filter { it.isNotBlank() }
    if (ids.isEmpty()) return false
    val savedIndex = p.getInt("index", 0).coerceIn(0, ids.size - 1)
    val savedId = ids[savedIndex]
    val items = mediaItemsFor(context, ids)
    if (items.isEmpty()) return false
    val index = items.indexOfFirst { it.mediaId == savedId }.coerceAtLeast(0)
    val position = if (items.getOrNull(index)?.mediaId == savedId) p.getLong("position", 0L) else 0L
    player.setMediaItems(items, index, position)
    player.prepare()
    Log.d(TAG, "[widget] restored ${items.size} songs, start $index at ${position}ms")
    return true
  }

  /** Media items (with title / artist from MediaStore) for these ids, in the same order. */
  private fun mediaItemsFor(context: Context, ids: List<String>): List<MediaItem> {
    val info = HashMap<String, Triple<String?, String?, String?>>()
    ids.chunked(400).forEach { chunk ->
      val numeric = chunk.mapNotNull { it.toLongOrNull() }
      if (numeric.isEmpty()) return@forEach
      val selection = "${MediaStore.Audio.Media._ID} IN (${numeric.joinToString(",")})"
      context.contentResolver.query(
        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
        arrayOf(
          MediaStore.Audio.Media._ID,
          MediaStore.Audio.Media.TITLE,
          MediaStore.Audio.Media.ARTIST,
          MediaStore.Audio.Media.ALBUM
        ),
        selection,
        null,
        null
      )?.use { c ->
        while (c.moveToNext()) {
          val artist = c.getString(2)?.takeIf { it.isNotBlank() && it != "<unknown>" }
          info[c.getLong(0).toString()] = Triple(c.getString(1), artist, c.getString(3))
        }
      }
    }
    return ids.mapNotNull { id ->
      val (title, artist, album) = info[id] ?: return@mapNotNull null
      MediaItem.Builder()
        .setMediaId(id)
        .setUri(SongScanner.songUri(id.toLong()))
        .setMediaMetadata(
          MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist ?: context.getString(R.string.pt_widget_unknown_artist))
            .setAlbumTitle(album)
            .setArtworkUri(ArtworkBitmapLoader.artworkUri(id))
            .setIsPlayable(true)
            .setIsBrowsable(false)
            .build()
        )
        .build()
    }
  }
}

/** 4×2 widget: cover / disc logo, title, artist, previous / play-pause / next. */
class PlaytuneWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    Log.d("PlaytuneEngine", "[widget] update ${appWidgetIds.size} wide widget(s)")
    PlaytuneWidgets.redraw(context.applicationContext, full = true)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    PlaytuneWidgets.handleAction(context, intent) { goAsync() }
  }

  companion object {
    /** Kept so the player service can keep calling PlaytuneWidget.refresh(...). */
    fun refresh(context: Context, player: Player?) = PlaytuneWidgets.refresh(context, player)
    fun refreshStopped(context: Context) = PlaytuneWidgets.refreshStopped(context)
  }
}

/** 2×2 widget: cover / disc logo, title, artist, play-pause / next. */
class PlaytuneWidgetSquare : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    Log.d("PlaytuneEngine", "[widget] update ${appWidgetIds.size} square widget(s)")
    PlaytuneWidgets.redraw(context.applicationContext, full = true)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    PlaytuneWidgets.handleAction(context, intent) { goAsync() }
  }
}
