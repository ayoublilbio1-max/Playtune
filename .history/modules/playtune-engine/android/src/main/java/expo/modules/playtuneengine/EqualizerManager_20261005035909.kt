package expo.modules.playtuneengine

import android.content.Context
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.Virtualizer
import android.util.Log

/**
 * The real equalizer: Android's audio effects attached to the player's sound.
 * Settings are saved, so they come back when the service restarts.
 * Some phones don't support every effect; each one is optional.
 */
class EqualizerManager(context: Context) {

  private val tag = PlaybackService.TAG
  private val prefs = context.getSharedPreferences("playtune_engine_eq", Context.MODE_PRIVATE)

  private var equalizer: Equalizer? = null
  private var bassBoost: BassBoost? = null
  private var virtualizer: Virtualizer? = null
  private var sessionId = 0

  private val enabled: Boolean get() = prefs.getBoolean("enabled", false)

  fun attach(audioSessionId: Int) {
    if (audioSessionId == sessionId && equalizer != null) return
    release()
    if (audioSessionId <= 0) {
      Log.d(tag, "[eq] skipped: no audio session yet ($audioSessionId)")
      return
    }
    sessionId = audioSessionId
    equalizer = try { Equalizer(0, audioSessionId) } catch (e: Throwable) {
      Log.w(tag, "[eq] equalizer not supported: ${e.message}"); null
    }
    bassBoost = try { BassBoost(0, audioSessionId) } catch (e: Throwable) {
      Log.w(tag, "[eq] bass boost not supported: ${e.message}"); null
    }
    virtualizer = try { Virtualizer(0, audioSessionId) } catch (e: Throwable) {
      Log.w(tag, "[eq] virtualizer not supported: ${e.message}"); null
    }
    applySaved()
    Log.d(tag, "[eq] attached to session $audioSessionId — eq=${equalizer != null} bass=${bassBoost != null} virt=${virtualizer != null} enabled=$enabled")
  }

  private fun applySaved() {
    val on = enabled

    equalizer?.let { eq ->
      try {
        val preset = prefs.getInt("preset", -1)
        if (preset in 0 until eq.numberOfPresets.toInt()) {
          eq.usePreset(preset.toShort())
        } else {
          val saved = prefs.getString("levels", null)?.split(",")?.mapNotNull { it.toShortOrNull() }
          if (saved != null && saved.size == eq.numberOfBands.toInt()) {
            saved.forEachIndexed { band, level -> eq.setBandLevel(band.toShort(), level) }
          }
        }
        eq.setEnabled(on)
      } catch (e: Throwable) {
        Log.w(tag, "[eq] apply equalizer failed: ${e.message}")
      }
    }

    bassBoost?.let { b ->
      try {
        val strength = prefs.getInt("bass", 0)
        if (b.strengthSupported) b.setStrength(strength.toShort())
        b.setEnabled(on && strength > 0)
      } catch (e: Throwable) {
        Log.w(tag, "[eq] apply bass boost failed: ${e.message}")
      }
    }

    virtualizer?.let { v ->
      try {
        val strength = prefs.getInt("virtualizer", 0)
        if (v.strengthSupported) v.setStrength(strength.toShort())
        v.setEnabled(on && strength > 0)
      } catch (e: Throwable) {
        Log.w(tag, "[eq] apply virtualizer failed: ${e.message}")
      }
    }
  }

  fun info(): Map<String, Any?> {
    val eq = equalizer
    var bands: List<Map<String, Any?>> = emptyList()
    var presets: List<String> = emptyList()
    var range: List<Int> = listOf(0, 0)

    if (eq != null) {
      try {
        val levelRange = eq.bandLevelRange
        range = listOf(levelRange[0].toInt(), levelRange[1].toInt())
        bands = (0 until eq.numberOfBands.toInt()).map { band ->
          mapOf(
            "index" to band,
            "centerHz" to eq.getCenterFreq(band.toShort()) / 1000,
            "level" to eq.getBandLevel(band.toShort()).toInt()
          )
        }
        presets = (0 until eq.numberOfPresets.toInt()).map { eq.getPresetName(it.toShort()) }
      } catch (e: Throwable) {
        Log.w(tag, "[eq] read info failed: ${e.message}")
      }
    }

    return mapOf(
      "supported" to (eq != null),
      "enabled" to enabled,
      "preset" to prefs.getInt("preset", -1),
      "presets" to presets,
      "bands" to bands,
      "levelRange" to range,
      "bassSupported" to (bassBoost?.strengthSupported == true),
      "bassStrength" to prefs.getInt("bass", 0),
      "virtualizerSupported" to (virtualizer?.strengthSupported == true),
      "virtualizerStrength" to prefs.getInt("virtualizer", 0)
    )
  }

  fun setEnabled(on: Boolean) {
    prefs.edit().putBoolean("enabled", on).apply()
    applySaved()
    Log.d(tag, "[eq] enabled=$on")
  }

  fun setBandLevel(band: Int, levelMb: Int) {
    val eq = equalizer ?: return
    try {
      eq.setBandLevel(band.toShort(), levelMb.toShort())
      val levels = (0 until eq.numberOfBands.toInt()).joinToString(",") { eq.getBandLevel(it.toShort()).toString() }
      prefs.edit().putInt("preset", -1).putString("levels", levels).apply()
    } catch (e: Throwable) {
      Log.w(tag, "[eq] set band $band failed: ${e.message}")
    }
  }

  fun usePreset(index: Int) {
    prefs.edit().putInt("preset", index).apply()
    applySaved()
    Log.d(tag, "[eq] preset=$index")
  }

  fun setBassBoost(strength: Int) {
    prefs.edit().putInt("bass", strength.coerceIn(0, 1000)).apply()
    applySaved()
  }

  fun setVirtualizer(strength: Int) {
    prefs.edit().putInt("virtualizer", strength.coerceIn(0, 1000)).apply()
    applySaved()
  }

  fun release() {
    try { equalizer?.release() } catch (_: Throwable) { }
    try { bassBoost?.release() } catch (_: Throwable) { }
    try { virtualizer?.release() } catch (_: Throwable) { }
    equalizer = null
    bassBoost = null
    virtualizer = null
    sessionId = 0
  }
}
