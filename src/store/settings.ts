import Storage from "expo-sqlite/kv-store";

import { createStore } from "./create-store";

/** "Skip short songs" choices, in seconds (0 = keep every file). */
export const MIN_SONG_OPTIONS = [0, 15, 30, 60] as const;
export type MinSongSeconds = (typeof MIN_SONG_OPTIONS)[number];

const MIN_SONG_KEY = "playtune.minSongSeconds";
const DEFAULT_MIN_SONG: MinSongSeconds = 30;

function loadMinSong(): MinSongSeconds {
  try {
    const raw = Storage.getItemSync(MIN_SONG_KEY);
    const saved = raw === null ? NaN : Number(raw);
    return (MIN_SONG_OPTIONS as readonly number[]).includes(saved)
      ? (saved as MinSongSeconds)
      : DEFAULT_MIN_SONG;
  } catch {
    return DEFAULT_MIN_SONG;
  }
}

type SettingsState = {
  /** Songs shorter than this are left out of the library (voice notes, ringtones, short clips). */
  minSongSeconds: MinSongSeconds;
};

const store = createStore<SettingsState>({ minSongSeconds: loadMinSong() });

export const useSettings = store.useStore;
export const getSettings = store.get;

export function setMinSongSeconds(value: MinSongSeconds) {
  store.set({ minSongSeconds: value });
  try {
    Storage.setItemSync(MIN_SONG_KEY, String(value));
  } catch (e) {
    if (__DEV__) console.log(`[settings] could not save — ${String(e)}`);
  }
  if (__DEV__) console.log(`[settings] skip songs shorter than ${value}s`);
}
