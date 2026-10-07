import Storage from "expo-sqlite/kv-store";

import { createStore } from "./create-store";

export type Language = "en" | "fr" | "es" | "de";

export const LANGUAGES: { code: Language; name: string; english: string }[] = [
  { code: "en", name: "English", english: "English" },
  { code: "fr", name: "Français", english: "French" },
  { code: "es", name: "Español", english: "Spanish" },
  { code: "de", name: "Deutsch", english: "German" },
];

const STORAGE_KEY = "playtune.language";

function loadLanguage(): Language {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved))
      return saved as Language;
  } catch {
    // first launch or storage error → English
  }
  return "en";
}

const store = createStore<{ language: Language }>({ language: loadLanguage() });

export const useLanguage = () => store.useStore((s) => s.language);
export const getLanguage = () => store.get().language;

/** Switches every text in the app (remembered). */
export function setLanguage(language: Language) {
  store.set({ language });
  try {
    Storage.setItemSync(STORAGE_KEY, language);
  } catch (e) {
    if (__DEV__) console.log(`[lang] could not save — ${String(e)}`);
  }
  if (__DEV__) console.log(`[lang] → ${language}`);
}
