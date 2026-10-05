package expo.modules.playtuneengine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
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
 */
@OptIn(UnstableApi::class)
class ArtworkBitmapLoader(context: Context) : BitmapLoader {

  companion object {
    const val SCHEME = "playtune-art"
    private const val SIZE = 512

    fun artworkUri(songId: String): Uri = Uri.parse("$SCHEME://song/$songId")
  }

  private val appContext = context.applicationContext
  private val executor: ListeningExecutorService =
    MoreExecutors.listeningDecorator(Executors.newSingleThreadExecutor())

  override fun supportsMimeType(mimeType: String): Boolean = mimeType.startsWith("image/")

  override fun decodeBitmap(data: ByteArray): ListenableFuture<Bitmap> =
    executor.submit<Bitmap> {
      ArtworkLoader.decodeScaled(data, SIZE) ?: throw IllegalArgumentException("Could not decode artwork")
    }

  override fun loadBitmap(uri: Uri): ListenableFuture<Bitmap> =
    executor.submit<Bitmap> {
      if (uri.scheme == SCHEME) {
        val id = uri.lastPathSegment?.toLongOrNull()
          ?: throw IllegalArgumentException("Bad artwork uri: $uri")
        ArtworkLoader.loadBitmap(appContext, id, SIZE)
          ?: throw IllegalStateException("No artwork for song $id")
      } else {
        appContext.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
          ?: throw IllegalStateException("Could not open $uri")
      }
    }
}
