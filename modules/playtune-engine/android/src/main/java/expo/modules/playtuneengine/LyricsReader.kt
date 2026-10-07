package expo.modules.playtuneengine

import android.content.Context
import android.os.ParcelFileDescriptor
import android.util.Log
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.charset.Charset

/**
 * Reads lyrics saved inside the song file (no internet, nothing else is opened):
 * - MP3: ID3v2 "USLT" frame (also v2.2 "ULT"), or a TXXX frame named LYRICS / UNSYNCEDLYRICS.
 * - FLAC: Vorbis comment LYRICS / UNSYNCEDLYRICS.
 * - M4A / MP4: the "©lyr" tag.
 * When the text has [mm:ss.xx] time tags (LRC style), the app shows it as synced lyrics.
 *
 * Only the tag parts of the file are read (positional reads), never the audio or the pictures.
 * Note: .lrc files next to songs can't be read on Android 11+ without "all files access",
 * so only lyrics inside the file are supported.
 */
object LyricsReader {

  private const val TAG = "PlaytuneEngine"
  private const val MAX_TEXT = 512 * 1024

  fun read(context: Context, songId: Long): String? {
    val start = System.currentTimeMillis()
    return try {
      val pfd = context.contentResolver.openFileDescriptor(SongScanner.songUri(songId), "r") ?: return null
      ParcelFileDescriptor.AutoCloseInputStream(pfd).use { stream ->
        val ch = stream.channel
        val head = readAt(ch, 0, 12) ?: return null
        val text = when {
          ascii(head, 0, 3) == "ID3" -> id3(ch, head)
          ascii(head, 0, 4) == "fLaC" -> flac(ch)
          ascii(head, 4, 4) == "ftyp" -> mp4(ch)
          else -> null
        }
        val clean = text?.replace("\u0000", "")?.replace("\r\n", "\n")?.replace('\r', '\n')?.trim()
        Log.d(TAG, "[lyrics] song $songId: ${if (clean.isNullOrEmpty()) "none" else "${clean.length} chars"} in ${System.currentTimeMillis() - start}ms")
        if (clean.isNullOrEmpty()) null else clean
      }
    } catch (e: Exception) {
      Log.w(TAG, "[lyrics] read failed for $songId: ${e.message}")
      null
    }
  }

  // ---------- Small helpers ----------

  private fun readAt(ch: FileChannel, position: Long, length: Int): ByteArray? {
    if (length <= 0) return ByteArray(0)
    val buffer = ByteBuffer.allocate(length)
    var pos = position
    while (buffer.hasRemaining()) {
      val n = ch.read(buffer, pos)
      if (n <= 0) break
      pos += n
    }
    return if (buffer.position() == length) buffer.array() else null
  }

  private fun ascii(b: ByteArray, offset: Int, length: Int): String =
    if (offset + length > b.size) "" else String(b, offset, length, Charsets.ISO_8859_1)

  private fun u8(b: ByteArray, i: Int) = b[i].toInt() and 0xFF

  private fun beInt(b: ByteArray, i: Int) =
    (u8(b, i) shl 24) or (u8(b, i + 1) shl 16) or (u8(b, i + 2) shl 8) or u8(b, i + 3)

  private fun leInt(b: ByteArray, i: Int) =
    u8(b, i) or (u8(b, i + 1) shl 8) or (u8(b, i + 2) shl 16) or (u8(b, i + 3) shl 24)

  private fun syncsafe(b: ByteArray, i: Int) =
    ((u8(b, i) and 0x7F) shl 21) or ((u8(b, i + 1) and 0x7F) shl 14) or ((u8(b, i + 2) and 0x7F) shl 7) or (u8(b, i + 3) and 0x7F)

  /** ID3 "unsynchronisation": every FF 00 was written for FF. */
  private fun undoUnsync(b: ByteArray): ByteArray {
    val out = java.io.ByteArrayOutputStream(b.size)
    var i = 0
    while (i < b.size) {
      out.write(b[i].toInt())
      if (u8(b, i) == 0xFF && i + 1 < b.size && b[i + 1].toInt() == 0) i++
      i++
    }
    return out.toByteArray()
  }

  // ---------- MP3 (ID3v2) ----------

  private fun id3(ch: FileChannel, head: ByteArray): String? {
    val major = u8(head, 3)
    val flags = u8(head, 5)
    val tagSize = syncsafe(head, 6)
    val tagEnd = 10L + tagSize
    val globalUnsync = flags and 0x80 != 0
    var pos = 10L

    if (flags and 0x40 != 0 && major >= 3) {
      val ext = readAt(ch, pos, 4) ?: return null
      pos += if (major == 4) syncsafe(ext, 0).toLong() else 4L + beInt(ext, 0)
    }

    val headerSize = if (major == 2) 6 else 10
    var fallback: String? = null
    while (pos + headerSize <= tagEnd) {
      val fh = readAt(ch, pos, headerSize) ?: break
      if (fh[0].toInt() == 0) break // padding
      val id: String
      val size: Int
      var frameFlags = 0
      if (major == 2) {
        id = ascii(fh, 0, 3)
        size = (u8(fh, 3) shl 16) or (u8(fh, 4) shl 8) or u8(fh, 5)
      } else {
        id = ascii(fh, 0, 4)
        size = if (major == 4) syncsafe(fh, 4) else beInt(fh, 4)
        frameFlags = u8(fh, 9)
      }
      if (size <= 0 || pos + headerSize + size > tagEnd) break

      val wanted = id == "USLT" || id == "ULT" || id == "TXXX" || id == "TXX"
      if (wanted && size <= MAX_TEXT) {
        var data = readAt(ch, pos + headerSize, size) ?: break
        if (major == 4) {
          if (frameFlags and 0x01 != 0 && data.size > 4) data = data.copyOfRange(4, data.size) // data length indicator
          if (frameFlags and 0x02 != 0) data = undoUnsync(data)
        } else if (globalUnsync) {
          data = undoUnsync(data)
        }
        if (id == "USLT" || id == "ULT") {
          val text = parseUslt(data)
          if (!text.isNullOrBlank()) return text
        } else {
          val text = parseTxxx(data)
          if (!text.isNullOrBlank() && fallback == null) fallback = text
        }
      }
      pos += headerSize + size
    }
    return fallback
  }

  private fun charsetOf(encoding: Int): Charset = when (encoding) {
    1 -> Charsets.UTF_16
    2 -> Charsets.UTF_16BE
    3 -> Charsets.UTF_8
    else -> Charsets.ISO_8859_1
  }

  /** Index just after the null terminator that starts at `from` (1 byte, or 2 aligned bytes for UTF-16). */
  private fun afterTerminator(data: ByteArray, from: Int, encoding: Int): Int {
    if (encoding == 1 || encoding == 2) {
      var i = from
      while (i + 1 < data.size) {
        if (data[i].toInt() == 0 && data[i + 1].toInt() == 0) return i + 2
        i += 2
      }
      return data.size
    }
    var i = from
    while (i < data.size) {
      if (data[i].toInt() == 0) return i + 1
      i++
    }
    return data.size
  }

  /** USLT: encoding(1) language(3) description(…\0) text. */
  private fun parseUslt(data: ByteArray): String? {
    if (data.size < 5) return null
    val encoding = u8(data, 0)
    val textStart = afterTerminator(data, 4, encoding)
    if (textStart >= data.size) return null
    return String(data, textStart, data.size - textStart, charsetOf(encoding))
  }

  /** TXXX: encoding(1) description(…\0) value — only when the description says "lyrics". */
  private fun parseTxxx(data: ByteArray): String? {
    if (data.size < 3) return null
    val encoding = u8(data, 0)
    val descEnd = afterTerminator(data, 1, encoding)
    val terminatorSize = if (encoding == 1 || encoding == 2) 2 else 1
    val description = String(data, 1, (descEnd - 1 - terminatorSize).coerceAtLeast(0), charsetOf(encoding))
      .trim().uppercase()
    // "USLT" is what ffmpeg writes when it saves lyrics as a TXXX frame.
    if (description !in setOf("LYRICS", "UNSYNCEDLYRICS", "UNSYNCED LYRICS", "USLT")) return null
    if (descEnd >= data.size) return null
    return String(data, descEnd, data.size - descEnd, charsetOf(encoding))
  }

  // ---------- FLAC ----------

  private fun flac(ch: FileChannel): String? {
    var pos = 4L
    for (guard in 0 until 64) {
      val header = readAt(ch, pos, 4) ?: return null
      val last = u8(header, 0) and 0x80 != 0
      val type = u8(header, 0) and 0x7F
      val length = (u8(header, 1) shl 16) or (u8(header, 2) shl 8) or u8(header, 3)
      if (type == 4 && length <= MAX_TEXT * 2) {
        val block = readAt(ch, pos + 4, length) ?: return null
        return vorbisLyrics(block)
      }
      if (last) return null
      pos += 4L + length
    }
    return null
  }

  private fun vorbisLyrics(block: ByteArray): String? {
    var i = 0
    if (block.size < 8) return null
    val vendorLength = leInt(block, i)
    i += 4 + vendorLength
    if (i + 4 > block.size) return null
    val count = leInt(block, i)
    i += 4
    for (n in 0 until count) {
      if (i + 4 > block.size) break
      val len = leInt(block, i)
      i += 4
      if (len < 0 || i + len > block.size) break
      val comment = String(block, i, len, Charsets.UTF_8)
      i += len
      val eq = comment.indexOf('=')
      if (eq <= 0) continue
      val key = comment.substring(0, eq).trim().uppercase()
      if (key == "LYRICS" || key == "UNSYNCEDLYRICS" || key == "UNSYNCED LYRICS") {
        return comment.substring(eq + 1)
      }
    }
    return null
  }

  // ---------- M4A / MP4 ----------

  private val LYR = byteArrayOf(0xA9.toByte(), 'l'.code.toByte(), 'y'.code.toByte(), 'r'.code.toByte())

  /** Finds a child box of [start, end) by type; returns (contentStart, boxEnd). */
  private fun findBox(ch: FileChannel, start: Long, end: Long, type: ByteArray): Pair<Long, Long>? {
    var pos = start
    for (guard in 0 until 4096) {
      if (pos + 8 > end) return null
      val h = readAt(ch, pos, 8) ?: return null
      var size = beInt(h, 0).toLong() and 0xFFFFFFFFL
      var headerSize = 8L
      if (size == 1L) {
        val big = readAt(ch, pos + 8, 8) ?: return null
        size = ByteBuffer.wrap(big).long
        headerSize = 16L
      } else if (size == 0L) {
        size = end - pos
      }
      if (size < headerSize) return null
      if (h[4] == type[0] && h[5] == type[1] && h[6] == type[2] && h[7] == type[3]) {
        return Pair(pos + headerSize, pos + size)
      }
      pos += size
    }
    return null
  }

  private fun mp4(ch: FileChannel): String? {
    val fileEnd = ch.size()
    val moov = findBox(ch, 0, fileEnd, "moov".toByteArray()) ?: return null
    val udta = findBox(ch, moov.first, moov.second, "udta".toByteArray()) ?: return null
    val meta = findBox(ch, udta.first, udta.second, "meta".toByteArray()) ?: return null
    // "meta" is a full box: 4 bytes of version / flags before its children.
    val ilst = findBox(ch, meta.first + 4, meta.second, "ilst".toByteArray()) ?: return null
    val lyr = findBox(ch, ilst.first, ilst.second, LYR) ?: return null
    val data = findBox(ch, lyr.first, lyr.second, "data".toByteArray()) ?: return null
    // data box: type (4) + locale (4), then the text.
    val textStart = data.first + 8
    val length = (data.second - textStart).toInt()
    if (length <= 0 || length > MAX_TEXT) return null
    val bytes = readAt(ch, textStart, length) ?: return null
    return String(bytes, Charsets.UTF_8)
  }
}
