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
 * Home-screen widget (4×2): artwork, title, artist, and previous / play-pause / next.
 *
 * - While the player service runs, it calls refresh() on every song / play-state change.
 * - Buttons send a broadcast back to this provider. If the service is running, the player is
 *   used directly; if the app was closed, a MediaController starts the service, restores the
 *   last queue (saved by the service) and plays.
 * - Tapping the card opens the app on the Player screen.
 */
class PlaytuneWidget : AppWidgetProvider() {

  companion object {
    private const val TAG = "PlaytuneEngine"
    const val ACTION_PLAY_PAUSE = "expo.modules.playtuneengine.widget.PLAY_PAUSE"
    const val ACTION_NEXT = "expo.modules.playtuneengine.widget.NEXT"
    const val ACTION_PREV = "expo.modules.playtuneengine.widget.PREV"

    private const val ART_SIZE = 256
    private val worker = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val mainExecutor = Executor { mainHandler.post(it) }

    // Last artwork shown (so play / pause changes don't reload the picture).
    @Volatile private var artId: String? = null
    @Volatile private var artBitmap: Bitmap? = null

    private fun prefs(context: Context) =
      context.getSharedPreferences(PlaybackService.PREFS, Context.MODE_PRIVATE)

    private fun widgetIds(context: Context): IntArray =
      AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, PlaytuneWidget::class.java))

    /** Called by the service on main thread: saves what is playing and redraws every widget. */
    fun refresh(context: Context, player: Player?) {
      val item = player?.currentMediaItem
      val meta = player?.mediaMetadata
      prefs(context).edit()
        .putString("w_id", item?.mediaId)
        .putString("w_title", meta?.title?.toString() ?: item?.mediaMetadata?.title?.toString())
        .putString("w_artist", meta?.artist?.toString() ?: item?.mediaMetadata?.artist?.toString())
        .putBoolean("w_playing", player?.isPlaying == true)
        .apply()
      redraw(context.applicationContext)
    }

    /** The service is going away: show the last song as paused. */
    fun refreshStopped(context: Context) {
      prefs(context).edit().putBoolean("w_playing", false).apply()
      redraw(context.applicationContext)
    }

    private fun redraw(context: Context) {
      val ids = widgetIds(context)
      if (ids.isEmpty()) return
      val songId = prefs(context).getString("w_id", null)
      AppWidgetManager.getInstance(context).updateAppWidget(ids, build(context))

      if (songId != null && songId != artId) {
        // Load the new artwork off the main thread, then draw again.
        worker.execute {
          val bitmap = songId.toLongOrNull()?.let { ArtworkLoader.loadBitmap(context, it, ART_SIZE) }?.let { rounded(it) }
          artId = songId
          artBitmap = bitmap
          mainHandler.post {
            val current = widgetIds(context)
            if (current.isNotEmpty()) AppWidgetManager.getInstance(context).updateAppWidget(current, build(context))
          }
        }
      }
    }

    private fun build(context: Context): RemoteViews {
      val p = prefs(context)
      val hasSong = p.getString("w_id", null) != null
      val playing = p.getBoolean("w_playing", false)
      val views = RemoteViews(context.packageName, R.layout.pt_widget)

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

      val bitmap = if (hasSong && artId == p.getString("w_id", null)) artBitmap else null
      if (bitmap != null) {
        views.setImageViewBitmap(R.id.pt_widget_art, bitmap)
      } else {
        views.setImageViewResource(R.id.pt_widget_art, R.drawable.pt_widget_art_placeholder)
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
      views.setOnClickPendingIntent(R.id.pt_widget_prev, actionIntent(context, ACTION_PREV, 3))
      views.setOnClickPendingIntent(R.id.pt_widget_root, openAppIntent(context))
      return views
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

    /** Artwork with rounded corners (widgets can't clip images themselves on older Android). */
    private fun rounded(source: Bitmap): Bitmap {
      val size = minOf(source.width, source.height)
      val x = (source.width - size) / 2
      val y = (source.height - size) / 2
      val square = Bitmap.createBitmap(source, x, y, size, size)
      val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = BitmapShader(square, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
      }
      val radius = size * 0.16f
      Canvas(output).drawRoundRect(RectF(0f, 0f, size.toFloat(), size.toFloat()), radius, radius, paint)
      return output
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

  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    Log.d(TAG, "[widget] update ${appWidgetIds.size} widget(s)")
    manager.updateAppWidget(appWidgetIds, build(context))
    redraw(context.applicationContext)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
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
}
