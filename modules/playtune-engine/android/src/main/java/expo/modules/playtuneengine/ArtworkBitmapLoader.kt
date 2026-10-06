package expo.modules.playtuneengine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.net.Uri
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.util.BitmapLoader
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.ListeningExecutorService
import com.google.common.util.concurrent.MoreExecutors
import java.util.concurrent.Executors

/**
 * Loads the artwork shown in the notification and on the lock screen.
 * Songs use "playtune-art://song/<id>" so the picture is read from the file only when needed.
 * A song without artwork gets the Playtune placeholder (gradient + music note), never an empty spot.
 */
@OptIn(UnstableApi::class)
class ArtworkBitmapLoader(context: Context) : BitmapLoader {

  companion object {
    const val SCHEME = "playtune-art"
    private const val SIZE = 512

    // Same colours as the app: accent → purple → background
    private val COLOR_ACCENT = 0xFFE401E3.toInt()
    private val COLOR_PURPLE = 0xFF7C09F1.toInt()
    private val COLOR_BACKGROUND = 0xFF19012B.toInt()

    fun artworkUri(songId: String): Uri = Uri.parse("$SCHEME://song/$songId")
  }

  private val appContext = context.applicationContext
  private val executor: ListeningExecutorService =
    MoreExecutors.listeningDecorator(Executors.newSingleThreadExecutor())

  @Volatile
  private var placeholderBitmap: Bitmap? = null

  override fun supportsMimeType(mimeType: String): Boolean = mimeType.startsWith("image/")

  override fun decodeBitmap(data: ByteArray): ListenableFuture<Bitmap> =
    executor.submit<Bitmap> {
      ArtworkLoader.decodeScaled(data, SIZE) ?: placeholder()
    }

  override fun loadBitmap(uri: Uri): ListenableFuture<Bitmap> =
    executor.submit<Bitmap> {
      if (uri.scheme == SCHEME) {
        val id = uri.lastPathSegment?.toLongOrNull()
        val art = if (id != null) ArtworkLoader.loadBitmap(appContext, id, SIZE) else null
        art ?: placeholder()
      } else {
        appContext.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
          ?: placeholder()
      }
    }

  /** Diagonal gradient (accent → purple → background) with a white music note in the middle. Built once. */
  private fun placeholder(): Bitmap {
    placeholderBitmap?.let { return it }

    val bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val size = SIZE.toFloat()

    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.shader = LinearGradient(
      0f, 0f, size, size,
      intArrayOf(COLOR_ACCENT, COLOR_PURPLE, COLOR_BACKGROUND),
      floatArrayOf(0f, 0.5f, 1f),
      Shader.TileMode.CLAMP
    )
    canvas.drawRect(0f, 0f, size, size, paint)

    val note = appContext.getDrawable(R.drawable.ic_pt_note)
    if (note != null) {
      val iconSize = (SIZE * 0.42f).toInt()
      val start = (SIZE - iconSize) / 2
      note.setBounds(start, start, start + iconSize, start + iconSize)
      note.draw(canvas)
    } else {
      Log.w(PlaybackService.TAG, "[artwork] note icon missing — placeholder without icon")
    }

    placeholderBitmap = bitmap
    Log.d(PlaybackService.TAG, "[artwork] placeholder created (${SIZE}px)")
    return bitmap
  }
}
