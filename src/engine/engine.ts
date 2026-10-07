import { PermissionsAndroid, Platform } from 'react-native';

import PlaytuneEngine from '../../modules/playtune-engine';
import type { EngineSong, EqualizerInfo, QueueItem } from '../../modules/playtune-engine';

export * from '../../modules/playtune-engine/src/PlaytuneEngine.types';
export { PlaytuneEngine };

/** Default for "skip short songs" (voice notes, short clips). The user can change it in Settings. */
export const MIN_SONG_DURATION_MS = 30_000;

const AUDIO_PERMISSION =
  Number(Platform.Version) >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

export type PermissionResult = 'granted' | 'denied' | 'blocked';

export async function hasAudioPermission(): Promise<boolean> {
  const granted = await PermissionsAndroid.check(AUDIO_PERMISSION);
  if (__DEV__) console.log(`[perm] audio permission check → ${granted}`);
  return granted;
}

export async function requestAudioPermission(): Promise<PermissionResult> {
  const result = await PermissionsAndroid.request(AUDIO_PERMISSION);
  const mapped: PermissionResult =
    result === PermissionsAndroid.RESULTS.GRANTED
      ? 'granted'
      : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? 'blocked'
        : 'denied';
  if (__DEV__) console.log(`[perm] audio permission request → ${mapped} (${AUDIO_PERMISSION})`);
  return mapped;
}

export async function scanLibrary(minDurationMs: number = MIN_SONG_DURATION_MS): Promise<EngineSong[]> {
  const start = Date.now();
  const songs = await PlaytuneEngine.scanSongs(minDurationMs);
  if (__DEV__) {
    console.log(`[scan] ${songs.length} songs (min ${minDurationMs / 1000}s) in ${Date.now() - start}ms (incl. bridge)`);
  }
  return songs;
}

export function displayArtist(artist: string | null | undefined): string {
  return artist?.trim() ? artist : 'Unknown artist';
}

export function displayAlbum(album: string | null | undefined): string {
  return album?.trim() ? album : 'Unknown album';
}

export function toQueueItem(song: EngineSong): QueueItem {
  return {
    id: song.id,
    uri: song.uri,
    title: song.title,
    artist: displayArtist(song.artist),
    album: song.album,
  };
}

/** Replaces the queue with these songs and starts playing at `index`. */
export async function playSongs(songs: EngineSong[], index: number, source: string): Promise<void> {
  if (songs.length === 0) return;
  const start = Date.now();
  try {
    await PlaytuneEngine.setQueue(songs.map(toQueueItem), index, 0, true);
    if (__DEV__) console.log(`[queue] ${source}: ${songs.length} songs, start ${index}, in ${Date.now() - start}ms`);
  } catch (e) {
    if (__DEV__) console.log(`[queue] ${source}: setQueue failed — ${String(e)}`);
  }
}

/** Stop button: pause and go back to 0:00 (the queue and notification stay). */
export async function stopToStart(): Promise<void> {
  try {
    await PlaytuneEngine.pause();
    await PlaytuneEngine.seekTo(0);
    if (__DEV__) console.log('[player] stopped and back to 0:00');
  } catch (e) {
    if (__DEV__) console.log(`[player] stop failed — ${String(e)}`);
  }
}

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** "1 h 12 min" / "38 min" — for playlist totals. */
export function formatTotalDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Some phones return broken equalizer preset names: each name keeps the leftover letters
 * of the previous, longer name ("Danceical" = "Dance" + "ical" from "Classical").
 * When a name has the same length as the previous raw name and ends with the same letters,
 * those shared letters are leftovers, so they are cut.
 * Example from a real phone: Danceical → Dance, Flateical → Flat, JazzHopetal → Jazz.
 */
export function cleanPresetNames(raw: string[]): string[] {
  const cleaned: string[] = [];
  let previousRaw = '';
  for (const name of raw) {
    let result = name;
    if (previousRaw && name.length === previousRaw.length && name !== previousRaw) {
      let end = name.length;
      while (end > 0 && name[end - 1] === previousRaw[end - 1]) end--;
      if (end > 0 && end < name.length) result = name.slice(0, end);
    }
    cleaned.push(result.trim());
    previousRaw = name;
  }
  return cleaned;
}

let presetFixLogged = false;

/** Equalizer info with readable preset names. */
function withCleanNames(info: EqualizerInfo): EqualizerInfo {
  if (!info.presets) return info;
  const clean = cleanPresetNames(info.presets);
  if (__DEV__ && !presetFixLogged && clean.join('|') !== info.presets.join('|')) {
    presetFixLogged = true;
    console.log(`[eq] preset names cleaned: ${info.presets.join(', ')} → ${clean.join(', ')}`);
  }
  return { ...info, presets: clean };
}

// Equalizer wrappers. (Kept here so screens never call engine methods whose names start with "use".)
export const equalizer = {
  get: async () => withCleanNames(await PlaytuneEngine.getEqualizer()),
  setEnabled: async (enabled: boolean) => withCleanNames(await PlaytuneEngine.setEqualizerEnabled(enabled)),
  setBand: async (band: number, levelMb: number) => withCleanNames(await PlaytuneEngine.setBandLevel(band, levelMb)),
  applyPreset: async (index: number) => withCleanNames(await PlaytuneEngine.usePreset(index)),
  setBass: async (strength: number) => withCleanNames(await PlaytuneEngine.setBassBoost(strength)),
  setVirtualizer: async (strength: number) => withCleanNames(await PlaytuneEngine.setVirtualizer(strength)),
};
