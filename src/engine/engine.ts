import { PermissionsAndroid, Platform } from "react-native";

import type { EngineSong, QueueItem } from "../../modules/playtune-engine";
import PlaytuneEngine from "../../modules/playtune-engine";

export * from "../../modules/playtune-engine/src/PlaytuneEngine.types";
export { PlaytuneEngine };

/** Songs shorter than this are skipped by the scan (voice notes, short clips). */
export const MIN_SONG_DURATION_MS = 30_000;

const AUDIO_PERMISSION =
  Number(Platform.Version) >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

export type PermissionResult = "granted" | "denied" | "blocked";

export async function hasAudioPermission(): Promise<boolean> {
  const granted = await PermissionsAndroid.check(AUDIO_PERMISSION);
  if (__DEV__) console.log(`[perm] audio permission check → ${granted}`);
  return granted;
}

export async function requestAudioPermission(): Promise<PermissionResult> {
  const result = await PermissionsAndroid.request(AUDIO_PERMISSION);
  const mapped: PermissionResult =
    result === PermissionsAndroid.RESULTS.GRANTED
      ? "granted"
      : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? "blocked"
        : "denied";
  if (__DEV__)
    console.log(
      `[perm] audio permission request → ${mapped} (${AUDIO_PERMISSION})`,
    );
  return mapped;
}

export async function scanLibrary(): Promise<EngineSong[]> {
  const start = Date.now();
  const songs = await PlaytuneEngine.scanSongs(MIN_SONG_DURATION_MS);
  if (__DEV__)
    console.log(
      `[scan] ${songs.length} songs in ${Date.now() - start}ms (incl. bridge)`,
    );
  return songs;
}

export function displayArtist(artist: string | null | undefined): string {
  return artist?.trim() ? artist : "Unknown artist";
}

export function displayAlbum(album: string | null | undefined): string {
  return album?.trim() ? album : "Unknown album";
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

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
