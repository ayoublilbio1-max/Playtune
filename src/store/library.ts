import Storage from "expo-sqlite/kv-store";

import {
  hasAudioPermission,
  requestAudioPermission,
  scanLibrary,
  type EngineSong,
} from "../engine/engine";
import { createStore } from "./create-store";
import { getSettings } from "./settings";

export type LibraryStatus =
  | "checking"
  | "need-permission"
  | "blocked"
  | "scanning"
  | "ready"
  | "error";

type LibraryState = {
  status: LibraryStatus;
  /** Every song found on the phone, hidden ones included (the Hide music screen uses it). */
  allSongs: EngineSong[];
  /** Songs shown in the app (hidden ones left out). */
  songs: EngineSong[];
  /** Every song by id, hidden ones included (Player and mini player: a hidden song can still be playing). */
  allById: Map<string, EngineSong>;
  /** Shown songs by id. Playlists, albums… only show songs that are in here. */
  byId: Map<string, EngineSong>;
  /** Ids the user hid (Settings › Hide music). */
  hidden: Set<string>;
  scanMs: number;
  error: string;
};

const HIDDEN_KEY = "playtune.hiddenSongs";

function loadHidden(): Set<string> {
  try {
    const raw = Storage.getItemSync(HIDDEN_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveHidden(hidden: Set<string>) {
  try {
    Storage.setItemSync(HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch (e) {
    if (__DEV__) console.log(`[hide] could not save — ${String(e)}`);
  }
}

const store = createStore<LibraryState>({
  status: "checking",
  allSongs: [],
  allById: new Map(),
  songs: [],
  byId: new Map(),
  hidden: loadHidden(),
  scanMs: 0,
  error: "",
});

export const useLibrary = store.useStore;
export const getLibrary = store.get;

/** Rebuilds the shown list from all songs minus the hidden ones. */
function visibleFrom(allSongs: EngineSong[], hidden: Set<string>) {
  const songs = hidden.size
    ? allSongs.filter((s) => !hidden.has(s.id))
    : allSongs;
  return { songs, byId: new Map(songs.map((s) => [s.id, s])) };
}

let started = false;

async function scan() {
  store.set({ status: "scanning" });
  const start = Date.now();
  try {
    const allSongs = await scanLibrary(getSettings().minSongSeconds * 1000);
    const { hidden } = store.get();
    const visible = visibleFrom(allSongs, hidden);
    const allById = new Map(allSongs.map((s) => [s.id, s]));
    store.set({
      status: "ready",
      allSongs,
      allById,
      ...visible,
      scanMs: Date.now() - start,
      error: "",
    });
    if (__DEV__ && hidden.size)
      console.log(
        `[hide] ${allSongs.length - visible.songs.length} hidden songs left out`,
      );
  } catch (e) {
    if (__DEV__) console.log(`[library] scan failed — ${String(e)}`);
    store.set({ status: "error", error: String(e) });
  }
}

/** First launch: check the permission, then scan. Runs once. */
export async function initLibrary() {
  if (started) return;
  started = true;
  const granted = await hasAudioPermission();
  if (!granted) {
    store.set({ status: "need-permission" });
    return;
  }
  await scan();
}

export async function allowAndScan() {
  const result = await requestAudioPermission();
  if (result === "granted") await scan();
  else
    store.set({ status: result === "blocked" ? "blocked" : "need-permission" });
}

/** Scans again (Settings). Returns the number of songs shown, or null if the scan could not run. */
export async function rescanLibrary(): Promise<number | null> {
  if (__DEV__) console.log("[library] rescan");
  if (!(await hasAudioPermission())) return null;
  await scan();
  const state = store.get();
  return state.status === "ready" ? state.songs.length : null;
}

/** Hides songs from the whole app (the files stay on the phone). */
export function hideSongs(ids: string[]) {
  const hidden = new Set(store.get().hidden);
  ids.forEach((id) => hidden.add(id));
  saveHidden(hidden);
  store.set({ hidden, ...visibleFrom(store.get().allSongs, hidden) });
  if (__DEV__)
    console.log(`[hide] hid ${ids.length} — ${hidden.size} hidden in total`);
}

/** Shows hidden songs again. */
export function unhideSongs(ids: string[]) {
  const hidden = new Set(store.get().hidden);
  ids.forEach((id) => hidden.delete(id));
  saveHidden(hidden);
  store.set({ hidden, ...visibleFrom(store.get().allSongs, hidden) });
  if (__DEV__)
    console.log(`[hide] unhid ${ids.length} — ${hidden.size} hidden in total`);
}
