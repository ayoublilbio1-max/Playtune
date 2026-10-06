import Storage from "expo-sqlite/kv-store";

import type { EngineSong } from "../engine/engine";

export type SortKey =
  | "title"
  | "artist"
  | "album"
  | "year"
  | "duration"
  | "size"
  | "newest"
  | "oldest";

export const SORT_OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  { key: "title", label: "Song name", hint: "A to Z" },
  { key: "artist", label: "Artist", hint: "A to Z" },
  { key: "album", label: "Album", hint: "A to Z" },
  { key: "year", label: "Year", hint: "Newest first" },
  { key: "duration", label: "Duration", hint: "Longest first" },
  { key: "size", label: "Size", hint: "Largest first" },
  { key: "newest", label: "Newest added", hint: "Last added first" },
  { key: "oldest", label: "Oldest added", hint: "First added first" },
];

const STORAGE_KEY = "playtune.sort";
const DEFAULT_SORT: SortKey = "newest";

export function loadSort(): SortKey {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    if (saved && SORT_OPTIONS.some((o) => o.key === saved))
      return saved as SortKey;
  } catch (e) {
    if (__DEV__) console.log(`[sort] could not read saved sort — ${String(e)}`);
  }
  return DEFAULT_SORT;
}

export function saveSort(key: SortKey) {
  try {
    Storage.setItemSync(STORAGE_KEY, key);
  } catch (e) {
    if (__DEV__) console.log(`[sort] could not save sort — ${String(e)}`);
  }
}

export function sortLabel(key: SortKey): string {
  return SORT_OPTIONS.find((o) => o.key === key)?.label ?? "";
}

// Unknown artist / album go to the end of A–Z lists.
const LAST = "￿";
const text = (value: string | null | undefined) =>
  value?.trim() ? value.toLowerCase() : LAST;
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Returns a new sorted array (the original list is not changed). */
export function sortSongs(songs: EngineSong[], key: SortKey): EngineSong[] {
  const start = Date.now();
  const list = [...songs];
  const byTitle = (a: EngineSong, b: EngineSong) =>
    compareText(text(a.title), text(b.title));

  switch (key) {
    case "title":
      list.sort(byTitle);
      break;
    case "artist":
      list.sort(
        (a, b) => compareText(text(a.artist), text(b.artist)) || byTitle(a, b),
      );
      break;
    case "album":
      list.sort(
        (a, b) =>
          compareText(text(a.album), text(b.album)) ||
          a.track - b.track ||
          byTitle(a, b),
      );
      break;
    case "year":
      // Songs without a year (0) go last.
      list.sort((a, b) => (b.year || -1) - (a.year || -1) || byTitle(a, b));
      break;
    case "duration":
      list.sort((a, b) => b.durationMs - a.durationMs);
      break;
    case "size":
      list.sort((a, b) => b.size - a.size);
      break;
    case "newest":
      list.sort((a, b) => b.dateAdded - a.dateAdded || byTitle(a, b));
      break;
    case "oldest":
      list.sort((a, b) => a.dateAdded - b.dateAdded || byTitle(a, b));
      break;
  }
  if (__DEV__)
    console.log(
      `[sort] ${songs.length} songs by ${key} in ${Date.now() - start}ms`,
    );
  return list;
}
