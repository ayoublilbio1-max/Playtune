package expo.modules.playtuneengine

import android.content.ContentUris
import android.content.Context
import android.os.Build
import android.provider.MediaStore

/**
 * Reads every song Android already indexed in MediaStore.
 * Tags (title, artist, album, duration, track) come from Android, nothing is parsed here,
 * so a scan of thousands of songs takes well under a second.
 */
object SongScanner {

  private val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI

  fun songUri(id: Long) = ContentUris.withAppendedId(collection, id)

  fun scan(context: Context, minDurationMs: Long): List<Map<String, Any?>> {
    val pathColumn =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) MediaStore.Audio.Media.RELATIVE_PATH
      else MediaStore.Audio.Media.DATA // deprecated on Android 10+, only used below it

    val projection = arrayOf(
      MediaStore.Audio.Media._ID,
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.ALBUM_ID,
      MediaStore.Audio.Media.DURATION,
      MediaStore.Audio.Media.TRACK,
      MediaStore.Audio.Media.YEAR,
      MediaStore.Audio.Media.DATE_ADDED,
      MediaStore.Audio.Media.SIZE,
      MediaStore.Audio.Media.MIME_TYPE,
      MediaStore.Audio.Media.DISPLAY_NAME,
      pathColumn
    )

    // IS_MUSIC skips ringtones, alarms and notification sounds.
    // The duration filter skips voice notes and short clips.
    val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} >= ?"
    val args = arrayOf(minDurationMs.toString())
    val sort = "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC"

    val songs = ArrayList<Map<String, Any?>>()
    context.contentResolver.query(collection, projection, selection, args, sort)?.use { c ->
      val iId = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
      val iTitle = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
      val iArtist = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
      val iAlbum = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
      val iAlbumId = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
      val iDuration = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
      val iTrack = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
      val iYear = c.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR)
      val iDate = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
      val iSize = c.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
      val iMime = c.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)
      val iName = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
      val iPath = c.getColumnIndexOrThrow(pathColumn)

      while (c.moveToNext()) {
        val id = c.getLong(iId)
        val fileName = c.getString(iName)
        val title = clean(c.getString(iTitle))
          ?: fileName?.substringBeforeLast('.')
          ?: "Unknown title"

        songs.add(
          mapOf(
            "id" to id.toString(),
            "uri" to songUri(id).toString(),
            "title" to title,
            "artist" to clean(c.getString(iArtist)),
            "album" to clean(c.getString(iAlbum)),
            "albumId" to c.getLong(iAlbumId).toString(),
            "durationMs" to c.getLong(iDuration).toDouble(),
            "track" to c.getInt(iTrack),
            "year" to c.getInt(iYear),
            "dateAdded" to c.getLong(iDate).toDouble(),
            "size" to c.getLong(iSize).toDouble(),
            "mimeType" to c.getString(iMime),
            "fileName" to fileName,
            "path" to c.getString(iPath)
          )
        )
      }
    }
    return songs
  }

  /** Android stores "<unknown>" when a tag is missing; we send null so the app shows its own text. */
  private fun clean(value: String?): String? =
    value?.trim()?.takeIf { it.isNotEmpty() && it != MediaStore.UNKNOWN_STRING }
}
