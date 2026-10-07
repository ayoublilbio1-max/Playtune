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
  songs: EngineSong[];
  byId: Map<string, EngineSong>;
  scanMs: number;
  error: string;
};

const store = createStore<LibraryState>({
  status: "checking",
  songs: [],
  byId: new Map(),
  scanMs: 0,
  error: "",
});

export const useLibrary = store.useStore;
export const getLibrary = store.get;

let started = false;

async function scan() {
  store.set({ status: "scanning" });
  const start = Date.now();
  try {
    const songs = await scanLibrary(getSettings().minSongSeconds * 1000);
    store.set({
      status: "ready",
      songs,
      byId: new Map(songs.map((s) => [s.id, s])),
      scanMs: Date.now() - start,
      error: "",
    });
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

/** Scans again (Settings). Returns the number of songs found, or null if the scan could not run. */
export async function rescanLibrary(): Promise<number | null> {
  if (__DEV__) console.log("[library] rescan");
  if (!(await hasAudioPermission())) return null;
  await scan();
  const state = store.get();
  return state.status === "ready" ? state.songs.length : null;
}
