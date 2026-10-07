import Storage from "expo-sqlite/kv-store";

import { createStore } from "./create-store";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "playtune.theme";

function loadMode(): ThemeMode {
  try {
    return Storage.getItemSync(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

const store = createStore<{ mode: ThemeMode }>({ mode: loadMode() });

export const useThemeMode = () => store.useStore((s) => s.mode);

/** Switches the whole app between the dark and light palettes (remembered). */
export function setThemeMode(mode: ThemeMode) {
  store.set({ mode });
  try {
    Storage.setItemSync(STORAGE_KEY, mode);
  } catch (e) {
    if (__DEV__) console.log(`[theme] could not save — ${String(e)}`);
  }
  if (__DEV__) console.log(`[theme] → ${mode}`);
}
