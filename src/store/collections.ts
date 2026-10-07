import { useMemo } from "react";

import type { EngineSong } from "../engine/engine";
import { useLibrary } from "./library";

export type CollectionKind = "album" | "artist" | "folder";

export type Collection = {
  kind: CollectionKind;
  /** albumId, lower-case artist name, or folder path ('' = unknown). */
  key: string;
  /** Raw name; null = unknown (the screen shows "Unknown album / artist"). */
  name: string | null;
  /** Album: its artist. Folder: the full path. Artist: null. */
  detail: string | null;
  songs: EngineSong[];
  /** Artists only: how many albums. */
  albumCount: number;
  totalMs: number;
};

const clean = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
const LAST = "￿";
const sortName = (c: Collection) => (c.name ? c.name.toLowerCase() : LAST);
const byName = (a: Collection, b: Collection) =>
  sortName(a) < sortName(b) ? -1 : sortName(a) > sortName(b) ? 1 : 0;
const byTrack = (a: EngineSong, b: EngineSong) =>
  (a.track || 9999) - (b.track || 9999) || a.title.localeCompare(b.title);

/** "Music/Rock/Live/" → "Live" */
export function folderName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function group(songs: EngineSong[], kind: CollectionKind): Collection[] {
  const map = new Map<string, EngineSong[]>();
  for (const song of songs) {
    const key =
      kind === "album"
        ? song.albumId || (clean(song.album) ?? "")
        : kind === "artist"
          ? (clean(song.artist)?.toLowerCase() ?? "")
          : (clean(song.path) ?? "");
    const list = map.get(key);
    if (list) list.push(song);
    else map.set(key, [song]);
  }

  const result: Collection[] = [];
  for (const [key, list] of map) {
    const first = list[0];
    let name: string | null = null;
    let detail: string | null = null;
    let albumCount = 0;
    if (kind === "album") {
      name = clean(first.album);
      detail = clean(first.artist);
      list.sort(byTrack);
    } else if (kind === "artist") {
      name = clean(first.artist);
      albumCount = new Set(list.map((s) => s.albumId)).size;
      list.sort(
        (a, b) =>
          (clean(a.album) ?? LAST).localeCompare(clean(b.album) ?? LAST) ||
          byTrack(a, b),
      );
    } else {
      name = key ? folderName(key) : null;
      detail = key || null;
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    result.push({
      kind,
      key,
      name,
      detail,
      songs: list,
      albumCount,
      totalMs: list.reduce((sum, s) => sum + s.durationMs, 0),
    });
  }
  return result.sort(byName);
}

/** Albums, artists or folders of the shown songs (hidden songs left out), A → Z. */
export function useCollections(kind: CollectionKind): Collection[] {
  const songs = useLibrary((s) => s.songs);
  return useMemo(() => {
    const start = Date.now();
    const list = group(songs, kind);
    if (__DEV__)
      console.log(
        `[browse] ${list.length} ${kind}s from ${songs.length} songs in ${Date.now() - start}ms`,
      );
    return list;
  }, [songs, kind]);
}

/** One album / artist / folder by key (undefined if it has no shown songs). */
export function useCollection(
  kind: CollectionKind,
  key: string,
): Collection | undefined {
  const songs = useLibrary((s) => s.songs);
  return useMemo(() => {
    const matches = songs.filter((song) =>
      kind === "album"
        ? (song.albumId || (clean(song.album) ?? "")) === key
        : kind === "artist"
          ? (clean(song.artist)?.toLowerCase() ?? "") === key
          : (clean(song.path) ?? "") === key,
    );
    return matches.length ? group(matches, kind)[0] : undefined;
  }, [songs, kind, key]);
}
