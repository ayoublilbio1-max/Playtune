package expo.modules.playtuneengine

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * The background player. Media3 turns this service into:
 * - the player notification (artwork, title, artist, seek bar, prev / play-pause / next),
 * - the lock-screen controls, headset and Bluetooth buttons,
 * - a foreground service while music plays, so it keeps going with the app closed.
 *
 * Extra notification buttons: Loop (off ↔ loop this song) and Close (✕).
 * Both use SLOT_OVERFLOW: that is the slot Media3 turns into the system notification's
 * custom actions (secondary slots are ignored there). Both use our own icons
 * (ICON_UNDEFINED + custom icon), so the system can't swap them for a built-in one.
 *
 * Loop has 2 states only: off or loop the current song. Shuffle is not used in Playtune.
 *
 * Swiping the app away from recents: Media3's default keeps the service if music is playing
 * and stops it if paused, which is what we want, so onTaskRemoved is not overridden.
 */
@OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {

  companion object {
    const val TAG = "PlaytuneEngine"
    const val PREFS = "playtune_engine"
    const val CMD_REPEAT = "playtune.REPEAT"
    const val CMD_CLOSE = "playtune.CLOSE"

    /** Same-process access for the equalizer. Set while the service is alive. */
    @Volatile
    var instance: PlaybackService? = null
      private set
  }

  private var session: MediaSession? = null
  private var errorStreak = 0

  lateinit var equalizer: EqualizerManager
    private set

  private fun prefs() = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  override fun onCreate() {
    super.onCreate()
    val prefs = prefs()

    val player = ExoPlayer.Builder(this)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
          .build(),
        /* handleAudioFocus= */ true
      )
      .setHandleAudioBecomingNoisy(true) // pause when headphones are unplugged
      .setWakeMode(C.WAKE_MODE_LOCAL)
      .build()

    // Only "off" or "loop one" exist in Playtune (an old saved "loop all" becomes off).
    val savedRepeat = prefs.getInt("repeatMode", Player.REPEAT_MODE_OFF)
    player.repeatMode = if (savedRepeat == Player.REPEAT_MODE_ONE) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
    player.shuffleModeEnabled = false
    player.addListener(playerListener)

    equalizer = EqualizerManager(this)
    equalizer.attach(player.audioSessionId)

    // Status-bar icon: the white note that the expo-notifications plugin builds from
    // assets/images/notification-icon.png (drawable "notification_icon" in the app).
    // If it's missing, Media3 keeps its default icon.
    val notificationProvider = DefaultMediaNotificationProvider.Builder(this).build()
    val smallIcon = resources.getIdentifier("notification_icon", "drawable", packageName)
    if (smallIcon != 0) notificationProvider.setSmallIcon(smallIcon)
    Log.d(TAG, "[service] notification icon ${if (smallIcon != 0) "from app" else "Media3 default"}")
    setMediaNotificationProvider(notificationProvider)

    // After Close (✕) the player is stopped (idle): never keep a notification for it.
    setShowNotificationForIdlePlayer(MediaSessionService.SHOW_NOTIFICATION_FOR_IDLE_PLAYER_NEVER)

    session = MediaSession.Builder(this, player)
      .setCallback(SessionCallback())
      .setBitmapLoader(ArtworkBitmapLoader(this))
      .setSessionActivity(openPlayerIntent())
      // Session-wide buttons: this is the list the system notification reads.
      .setMediaButtonPreferences(buttons(player.repeatMode))
      .build()

    instance = this
    Log.d(TAG, "[service] created — audioSession=${player.audioSessionId} repeat=${player.repeatMode}")
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

  override fun onDestroy() {
    Log.d(TAG, "[service] destroyed")
    session?.let { s ->
      saveSession(s.player)
      s.player.removeListener(playerListener)
      s.player.release()
      s.release()
    }
    session = null
    equalizer.release()
    instance = null
    super.onDestroy()
  }

  /** Tapping the notification opens the app on the player screen (playtune://player). */
  private fun openPlayerIntent(): PendingIntent {
    val intent = (packageManager.getLaunchIntentForPackage(packageName) ?: Intent()).apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("playtune://player")
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
      this,
      0,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
  }

  /**
   * The two extra notification buttons, in this order: Loop first, Close second.
   * The loop icon shows the current state: plain loop = off, loop with "1" = on.
   */
  private fun buttons(repeatMode: Int): List<CommandButton> {
    val loopOn = repeatMode == Player.REPEAT_MODE_ONE
    val loop = CommandButton.Builder(CommandButton.ICON_UNDEFINED)
      .setCustomIconResId(if (loopOn) R.drawable.ic_pt_repeat_one else R.drawable.ic_pt_repeat)
      .setDisplayName(if (loopOn) "Loop on" else "Loop off")
      .setSessionCommand(SessionCommand(CMD_REPEAT, Bundle.EMPTY))
      .setSlots(CommandButton.SLOT_OVERFLOW)
      .build()
    val close = CommandButton.Builder(CommandButton.ICON_UNDEFINED)
      .setCustomIconResId(R.drawable.ic_pt_close)
      .setDisplayName("Close")
      .setSessionCommand(SessionCommand(CMD_CLOSE, Bundle.EMPTY))
      .setSlots(CommandButton.SLOT_OVERFLOW)
      .build()
    return listOf(loop, close)
  }

  /** Saves the queue, current song and position so the app can restore them after being killed. */
  private fun saveSession(player: Player) {
    val ids = (0 until player.mediaItemCount).joinToString(",") { player.getMediaItemAt(it).mediaId }
    prefs().edit()
      .putString("queue", ids)
      .putInt("index", player.currentMediaItemIndex)
      .putLong("position", player.currentPosition)
      .apply()
  }

  private val playerListener = object : Player.Listener {
    override fun onRepeatModeChanged(repeatMode: Int) {
      // Another controller (car, watch…) may ask for "loop all": Playtune has only "loop one".
      if (repeatMode == Player.REPEAT_MODE_ALL) {
        Log.d(TAG, "[service] repeat all requested — using loop one")
        session?.player?.repeatMode = Player.REPEAT_MODE_ONE
        return
      }
      prefs().edit().putInt("repeatMode", repeatMode).apply()
      session?.setMediaButtonPreferences(buttons(repeatMode))
      Log.d(TAG, "[service] loop → ${if (repeatMode == Player.REPEAT_MODE_ONE) "one" else "off"}")
    }

    override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) {
      if (shuffleModeEnabled) {
        Log.d(TAG, "[service] shuffle requested by a controller — kept off")
        session?.player?.shuffleModeEnabled = false
      }
    }

    override fun onAudioSessionIdChanged(audioSessionId: Int) {
      equalizer.attach(audioSessionId)
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      if (isPlaying) errorStreak = 0
      session?.player?.let { saveSession(it) }
    }

    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
      session?.player?.let { saveSession(it) }
      Log.d(TAG, "[service] now playing ${mediaItem?.mediaId} (reason $reason)")
    }

    /** A broken or deleted file: skip to the next song (max 5 in a row, to avoid looping forever). */
    override fun onPlayerError(error: PlaybackException) {
      val player = session?.player ?: return
      errorStreak++
      Log.w(TAG, "[service] error ${error.errorCodeName} on ${player.currentMediaItem?.mediaId} (streak $errorStreak)")
      if (errorStreak <= 5 && player.hasNextMediaItem()) {
        player.seekToNextMediaItem()
        player.prepare()
        player.play()
      }
    }
  }

  private inner class SessionCallback : MediaSession.Callback {

    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo
    ): MediaSession.ConnectionResult {
      val commands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
        .add(SessionCommand(CMD_REPEAT, Bundle.EMPTY))
        .add(SessionCommand(CMD_CLOSE, Bundle.EMPTY))
        .build()
      Log.d(TAG, "[service] controller connected: ${controller.packageName}")
      return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
        .setAvailableSessionCommands(commands)
        .setMediaButtonPreferences(buttons(session.player.repeatMode))
        .build()
    }

    override fun onCustomCommand(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
      customCommand: SessionCommand,
      args: Bundle
    ): ListenableFuture<SessionResult> {
      when (customCommand.customAction) {
        CMD_REPEAT -> {
          val player = session.player
          player.repeatMode =
            if (player.repeatMode == Player.REPEAT_MODE_ONE) Player.REPEAT_MODE_OFF
            else Player.REPEAT_MODE_ONE
        }
        CMD_CLOSE -> {
          Log.d(TAG, "[service] close tapped — stopping and removing the notification")
          val player = session.player
          saveSession(player)
          player.pause()
          // Idle player + SHOW_NOTIFICATION_FOR_IDLE_PLAYER_NEVER = notification removed.
          // The queue and position are kept, so Play in the app continues from here.
          player.stop()
          this@PlaybackService.pauseAllPlayersAndStopSelf()
        }
      }
      return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
    }

    /** Songs are MediaStore items: rebuild the file uri from the id if it was dropped on the way. */
    override fun onAddMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>
    ): ListenableFuture<MutableList<MediaItem>> {
      val resolved = mediaItems.map { item ->
        if (item.localConfiguration != null) item
        else item.buildUpon().setUri(SongScanner.songUri(item.mediaId.toLongOrNull() ?: -1L)).build()
      }.toMutableList()
      return Futures.immediateFuture(resolved)
    }
  }
}
