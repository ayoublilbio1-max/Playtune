import { useCallback } from "react";

import { getLanguage, useLanguage, type Language } from "../store/language";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";

export type TKey = keyof typeof en;
export type Dictionary = Record<TKey, string>;
type Vars = Record<string, string | number>;

/** Keys that come as a pair: "songs_one" / "songs_other" → "songs". */
export type PluralKey = TKey extends infer K
  ? K extends `${infer B}_one`
    ? B
    : never
  : never;

const dictionaries: Record<Language, Dictionary> = { en, fr, es, de };

function fill(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function translate(language: Language, key: TKey, vars?: Vars): string {
  return fill(dictionaries[language][key] ?? en[key], vars);
}

/** Singular when count is 1 (French also uses the singular for 0). {count} is filled in. */
export function translateCount(
  language: Language,
  key: PluralKey,
  count: number,
  vars?: Vars,
): string {
  const one = count === 1 || (language === "fr" && count === 0);
  return translate(language, `${key}_${one ? "one" : "other"}` as TKey, {
    count,
    ...vars,
  });
}

/** Outside React (toasts, engine helpers): uses the current language. */
export function t(key: TKey, vars?: Vars): string {
  return translate(getLanguage(), key, vars);
}

export function tn(key: PluralKey, count: number, vars?: Vars): string {
  return translateCount(getLanguage(), key, count, vars);
}

/** In components: `const { t, tn } = useT();` — re-renders when the language changes. */
export function useT() {
  const language = useLanguage();
  const tt = useCallback(
    (key: TKey, vars?: Vars) => translate(language, key, vars),
    [language],
  );
  const ttn = useCallback(
    (key: PluralKey, count: number, vars?: Vars) =>
      translateCount(language, key, count, vars),
    [language],
  );
  return { t: tt, tn: ttn, language };
}
