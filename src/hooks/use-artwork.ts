import { useEffect, useState } from "react";

import { PlaytuneEngine } from "../engine/engine";

/**
 * Artwork file uris, shared by every screen.
 * `null` = the song has no artwork (the app then shows the gradient placeholder).
 */
const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

export function loadArtwork(id: string, size: number): Promise<string | null> {
  const key = `${id}_${size}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const running = pending.get(key);
  if (running) return running;

  const promise = PlaytuneEngine.getArtwork(id, size)
    .then((uri) => {
      cache.set(key, uri);
      return uri;
    })
    .catch((e) => {
      if (__DEV__) console.log(`[artwork] failed for ${id}: ${String(e)}`);
      cache.set(key, null);
      return null;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, promise);
  return promise;
}

/**
 * Artwork for one song. Safe in recycled list rows: the result is tied to the song id,
 * so a row never shows the previous song's picture while the new one loads.
 */
export function useArtwork(
  id: string | null | undefined,
  size: number,
): string | null {
  const key = id ? `${id}_${size}` : "";
  const [loaded, setLoaded] = useState<{ key: string; uri: string | null }>({
    key: "",
    uri: null,
  });

  useEffect(() => {
    if (!id || cache.has(`${id}_${size}`)) return;
    let alive = true;
    loadArtwork(id, size).then((uri) => {
      if (alive) setLoaded({ key: `${id}_${size}`, uri });
    });
    return () => {
      alive = false;
    };
  }, [id, size]);

  if (!key) return null;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  return loaded.key === key ? loaded.uri : null;
}

/** Playlist cover: the artwork of the first song (in playlist order) that has one. Checks up to 30 songs. */
export function usePlaylistCover(
  songIds: string[],
  size: number,
): string | null {
  const idsKey = songIds.slice(0, 30).join(",");
  const [cover, setCover] = useState<{ key: string; uri: string | null }>({
    key: "",
    uri: null,
  });

  useEffect(() => {
    let alive = true;
    const ids = idsKey ? idsKey.split(",") : [];
    (async () => {
      for (const id of ids) {
        const found = await loadArtwork(id, size);
        if (!alive) return;
        if (found) {
          setCover({ key: `${idsKey}|${size}`, uri: found });
          return;
        }
      }
      if (alive) setCover({ key: `${idsKey}|${size}`, uri: null });
    })();
    return () => {
      alive = false;
    };
  }, [idsKey, size]);

  return cover.key === `${idsKey}|${size}` ? cover.uri : null;
}
