package expo.modules.playtuneengine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.util.Size
import java.io.File
import java.io.FileOutputStream

/**
 * Song artwork: first the album art Android already has (loadThumbnail, Android 10+),
 * then the picture embedded in the file itself.
 */
object ArtworkLoader {

  fun loadBitmap(context: Context, songId: Long, size: Int): Bitmap? {
    val uri = SongScanner.songUri(songId)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      try {
        return context.contentResolver.loadThumbnail(uri, Size(size, size), null)
      } catch (_: Exception) {
        // No thumbnail: try the embedded picture below.
      }
    }

    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(context, uri)
      val bytes = retriever.embeddedPicture ?: return null
      decodeScaled(bytes, size)
    } catch (_: Exception) {
      null
    } finally {
      try { retriever.release() } catch (_: Exception) { }
    }
  }

  fun decodeScaled(bytes: ByteArray, size: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= size && bounds.outHeight / (sample * 2) >= size) {
      sample *= 2
    }
    val options = BitmapFactory.Options().apply { inSampleSize = sample }
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
  }

  /**
   * Returns a file:// uri of a cached JPEG, or null when the song has no artwork.
   * Songs without artwork get a small ".none" marker so we don't try again on every scroll.
   */
  fun cachedFileUri(context: Context, songId: Long, size: Int): String? {
    val dir = File(context.cacheDir, "artwork").apply { mkdirs() }
    val file = File(dir, "${songId}_$size.jpg")
    val none = File(dir, "${songId}_$size.none")

    if (file.exists()) return Uri.fromFile(file).toString()
    if (none.exists()) return null

    val bitmap = loadBitmap(context, songId, size)
    if (bitmap == null) {
      try { none.createNewFile() } catch (_: Exception) { }
      return null
    }
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 85, it) }
    return Uri.fromFile(file).toString()
  }

  fun clearCache(context: Context): Int {
    val dir = File(context.cacheDir, "artwork")
    val files = dir.listFiles() ?: return 0
    files.forEach { it.delete() }
    return files.size
  }
}
