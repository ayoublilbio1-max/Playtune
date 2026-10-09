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
 *
 * Effects only exist while they are really used:
 * - equalizer off → no effect at all is attached to the music;
 * - bass boost / virtualizer at 0% → that effect is not attached.
 * Android runs effects in the system's audio process; on some phones even a switched-off effect
 * makes the music more fragile (small cuts while another app opens). Without effects, the music
 * plays exactly like any other player.
 *
 * The screen still needs the bands and presets while the equalizer is off: they are read from a
 * short-lived, switched-off equalizer (created, read, released at once) and kept in memory.
 */
class EqualizerManager(context: Context) {

  private val tag = PlaybackService.TAG
  private val prefs = context.getSharedPreferences("playtune_engine_eq", Context.MODE_PRIVATE)

  private var equalizer: Equalizer? = null
  private var bassBoost: BassBoost? = null
  private var virtualizer: Virtualizer? = null
  private var sessionId = 0

  /** What this phone supports (read once). */
  private var probed = false
  private var eqSupported = false
  private var bassSupported = false
  private var virtSupported = false

  private val enabled: Boolean get() = prefs.getBoolean("enabled", false)
  private val bassStrength: Int get() = prefs.getInt("bass", 0)
  private val virtStrength: Int get() = prefs.getInt("virtualizer", 0)

  fun attach(audioSessionId: Int) {
    if (audioSessionId == sessionId) return
    release()
    if (audioSessionId <= 0) {
      Log.d(tag, "[eq] skipped: no audio session yet ($audioSessionId)")
      return
    }
    sessionId = audioSessionId
    probe()
    sync("session $audioSessionId")
  }

  /** Finds out once which effects this phone has (each one created and released right away). */
  private fun probe() {
    if (probed || sessionId <= 0) return
    probed = true
    eqSupported = try { Equalizer(0, sessionId).release(); true } catch (e: Throwable) {
      Log.w(tag, "[eq] equalizer not supported: ${e.message}"); false
    }
    bassSupported = try {
      val b = BassBoost(0, sessionId); val ok = b.strengthSupported; b.release(); ok
    } catch (e: Throwable) {
      Log.w(tag, "[eq] bass boost not supported: ${e.message}"); false
    }
    virtSupported = try {
      val v = Virtualizer(0, sessionId); val ok = v.strengthSupported; v.release(); ok
    } catch (e: Throwable) {
      Log.w(tag, "[eq] virtualizer not supported: ${e.message}"); false
    }
    Log.d(tag, "[eq] phone supports eq=$eqSupported bass=$bassSupported virt=$virtSupported")
  }

  /** Creates or releases each effect so only the ones in use are attached, then applies the settings. */
  private fun sync(reason: String) {
    if (sessionId <= 0) return
    val on = enabled
    val wantEq = on && eqSupported
    val wantBass = on && bassSupported && bassStrength > 0
    val wantVirt = on && virtSupported && virtStrength > 0

    // Equalizer
    if (wantEq && equalizer == null) {
      equalizer = try { Equalizer(0, sessionId) } catch (e: Throwable) {
        Log.w(tag, "[eq] equalizer create failed: ${e.message}"); null
      }
    } else if (!wantEq && equalizer != null) {
      try { equalizer?.release() } catch (_: Throwable) { }
      equalizer = null
    }
    equalizer?.let { eq ->
      try {
        applyLevels(eq)
        eq.setEnabled(true)
      } catch (e: Throwable) {
        Log.w(tag, "[eq] apply equalizer failed: ${e.message}")
      }
    }

    // Bass boost
    if (wantBass && bassBoost == null) {
      bassBoost = try { BassBoost(0, sessionId) } catch (e: Throwable) {
        Log.w(tag, "[eq] bass boost create failed: ${e.message}"); null
      }
    } else if (!wantBass && bassBoost != null) {
      try { bassBoost?.release() } catch (_: Throwable) { }
      bassBoost = null
    }
    bassBoost?.let { b ->
      try {
        b.setStrength(bassStrength.toShort())
        b.setEnabled(true)
      } catch (e: Throwable) {
        Log.w(tag, "[eq] apply bass boost failed: ${e.message}")
      }
    }

    // Virtualizer
    if (wantVirt && virtualizer == null) {
      virtualizer = try { Virtualizer(0, sessionId) } catch (e: Throwable) {
        Log.w(tag, "[eq] virtualizer create failed: ${e.message}"); null
      }
    } else if (!wantVirt && virtualizer != null) {
      try { virtualizer?.release() } catch (_: Throwable) { }
      virtualizer = null
    }
    virtualizer?.let { v ->
      try {
        v.setStrength(virtStrength.toShort())
        v.setEnabled(true)
      } catch (e: Throwable) {
        Log.w(tag, "[eq] apply virtualizer failed: ${e.message}")
      }
    }

    Log.d(tag, "[eq] $reason → attached: eq=${equalizer != null} bass=${bassBoost != null} virt=${virtualizer != null} (enabled=$on)")
  }

  /** Puts the saved preset or the saved custom levels on an equalizer. */
  private fun applyLevels(eq: Equalizer) {
    val preset = prefs.getInt("preset", -1)
    if (preset in 0 until eq.numberOfPresets.toInt()) {
      eq.usePreset(preset.toShort())
    } else {
      val saved = prefs.getString("levels", null)?.split(",")?.mapNotNull { it.toShortOrNull() }
      if (saved != null && saved.size == eq.numberOfBands.toInt()) {
        saved.forEachIndexed { band, level -> eq.setBandLevel(band.toShort(), level) }
      }
    }
  }

  /**
   * Runs `block` on the attached equalizer, or on a short-lived switched-off one (equalizer off):
   * created with the saved levels, used, then released. A switched-off effect doesn't change the sound.
   */
  private fun <T> withEqualizer(block: (Equalizer) -> T): T? {
    equalizer?.let { return block(it) }
    if (!eqSupported || sessionId <= 0) return null
    val temp = try { Equalizer(0, sessionId) } catch (e: Throwable) { return null }
    return try {
      applyLevels(temp)
      block(temp)
    } catch (e: Throwable) {
      Log.w(tag, "[eq] read failed: ${e.message}")
      null
    } finally {
      try { temp.release() } catch (_: Throwable) { }
    }
  }

  fun info(): Map<String, Any?> {
    probe()
    var bands: List<Map<String, Any?>> = emptyList()
    var presets: List<String> = emptyList()
    var range: List<Int> = listOf(0, 0)

    withEqualizer { eq ->
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
    }

    return mapOf(
      "supported" to eqSupported,
      "enabled" to enabled,
      "preset" to prefs.getInt("preset", -1),
      "presets" to presets,
      "bands" to bands,
      "levelRange" to range,
      "bassSupported" to bassSupported,
      "bassStrength" to bassStrength,
      "virtualizerSupported" to virtSupported,
      "virtualizerStrength" to virtStrength
    )
  }

  fun setEnabled(on: Boolean) {
    prefs.edit().putBoolean("enabled", on).apply()
    sync("enabled=$on")
  }

  fun setBandLevel(band: Int, levelMb: Int) {
    withEqualizer { eq ->
      eq.setBandLevel(band.toShort(), levelMb.toShort())
      val levels = (0 until eq.numberOfBands.toInt()).joinToString(",") { eq.getBandLevel(it.toShort()).toString() }
      prefs.edit().putInt("preset", -1).putString("levels", levels).apply()
    }
  }

  fun usePreset(index: Int) {
    prefs.edit().putInt("preset", index).apply()
    sync("preset=$index")
  }

  fun setBassBoost(strength: Int) {
    prefs.edit().putInt("bass", strength.coerceIn(0, 1000)).apply()
    sync("bass=$strength")
  }

  fun setVirtualizer(strength: Int) {
    prefs.edit().putInt("virtualizer", strength.coerceIn(0, 1000)).apply()
    sync("virtualizer=$strength")
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
