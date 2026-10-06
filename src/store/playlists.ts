import { getDb } from "../db/database";
import { createStore } from "./create-store";

export type Playlist = {
  id: number;
  name: string;
  /** 'liked' = the built-in "Liked songs" (can't be renamed or deleted). */
  kind: "user" | "liked";
  /** Song ids (MediaStore ids) in playlist order. A song deleted from the phone is skipped when shown. */
  songIds: string[];
  createdAt: number;
  updatedAt: number;
};

type PlaylistsState = {
  loaded: boolean;
  playlists: Playlist[];
};

const store = createStore<PlaylistsState>({ loaded: false, playlists: [] });

export const usePlaylists = store.useStore;
export const getPlaylists = store.get;

type PlaylistRow = {
  id: number;
  name: string;
  kind: string;
  created_at: number;
  updated_at: number;
};
type SongRow = { playlist_id: number; song_id: string };

/** Reads every playlist and its songs ("Liked songs" first, then newest playlist first). */
export async function loadPlaylists() {
  const start = Date.now();
  try {
    const db = getDb();
    const rows = await db.getAllAsync<PlaylistRow>(
      "SELECT id, name, kind, created_at, updated_at FROM playlists ORDER BY (kind = 'liked') DESC, created_at DESC",
    );
    const songRows = await db.getAllAsync<SongRow>(
      "SELECT playlist_id, song_id FROM playlist_songs ORDER BY playlist_id, position",
    );
    const songsByPlaylist = new Map<number, string[]>();
    for (const r of songRows) {
      const list = songsByPlaylist.get(r.playlist_id);
      if (list) list.push(r.song_id);
      else songsByPlaylist.set(r.playlist_id, [r.song_id]);
    }
    const playlists = rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: (r.kind === "liked" ? "liked" : "user") as Playlist["kind"],
      songIds: songsByPlaylist.get(r.id) ?? [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    store.set({ loaded: true, playlists });
    if (__DEV__)
      console.log(
        `[playlist] loaded ${playlists.length} playlists in ${Date.now() - start}ms`,
      );
  } catch (e) {
    if (__DEV__) console.log(`[playlist] load failed — ${String(e)}`);
    store.set({ loaded: true });
  }
}

export async function createPlaylist(name: string): Promise<number> {
  const now = Date.now();
  const result = await getDb().runAsync(
    "INSERT INTO playlists (name, created_at, updated_at) VALUES (?, ?, ?)",
    name.trim(),
    now,
    now,
  );
  const id = Number(result.lastInsertRowId);
  if (__DEV__) console.log(`[playlist] created #${id} "${name.trim()}"`);
  await loadPlaylists();
  return id;
}

function isLikedPlaylist(id: number) {
  return store.get().playlists.some((p) => p.id === id && p.kind === "liked");
}

export async function renamePlaylist(id: number, name: string) {
  if (isLikedPlaylist(id)) return;
  await getDb().runAsync(
    "UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?",
    name.trim(),
    Date.now(),
    id,
  );
  if (__DEV__) console.log(`[playlist] renamed #${id} → "${name.trim()}"`);
  await loadPlaylists();
}

export async function deletePlaylist(id: number) {
  if (isLikedPlaylist(id)) return;
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM playlist_songs WHERE playlist_id = ?", id);
    await db.runAsync("DELETE FROM playlists WHERE id = ?", id);
  });
  if (__DEV__) console.log(`[playlist] deleted #${id}`);
  await loadPlaylists();
}

/** Adds songs at the end of the playlist. Songs already in it are skipped. Returns how many were added. */
export async function addSongsToPlaylist(
  id: number,
  songIds: string[],
): Promise<number> {
  if (songIds.length === 0) return 0;
  const db = getDb();
  let added = 0;
  await db.withTransactionAsync(async () => {
    const max = await db.getFirstAsync<{ maxPos: number | null }>(
      "SELECT MAX(position) AS maxPos FROM playlist_songs WHERE playlist_id = ?",
      id,
    );
    let position = (max?.maxPos ?? -1) + 1;
    const now = Date.now();
    for (const songId of songIds) {
      const result = await db.runAsync(
        "INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position, added_at) VALUES (?, ?, ?, ?)",
        id,
        songId,
        position,
        now,
      );
      if (result.changes > 0) {
        added++;
        position++;
      }
    }
    await db.runAsync(
      "UPDATE playlists SET updated_at = ? WHERE id = ?",
      now,
      id,
    );
  });
  if (__DEV__)
    console.log(`[playlist] #${id}: added ${added} of ${songIds.length} songs`);
  await loadPlaylists();
  return added;
}

export async function removeSongFromPlaylist(id: number, songId: string) {
  const db = getDb();
  await db.runAsync(
    "DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
    id,
    songId,
  );
  await db.runAsync(
    "UPDATE playlists SET updated_at = ? WHERE id = ?",
    Date.now(),
    id,
  );
  if (__DEV__) console.log(`[playlist] #${id}: removed song ${songId}`);
  await loadPlaylists();
}

/** The built-in "Liked songs" playlist (always exists once playlists are loaded). */
export function getLikedPlaylist(): Playlist | undefined {
  return store.get().playlists.find((p) => p.kind === "liked");
}

/** ♥ button: adds the song to "Liked songs", or removes it if it's already there. Returns true if now liked. */
export async function toggleLiked(songId: string): Promise<boolean> {
  if (!store.get().loaded) await loadPlaylists();
  const liked = getLikedPlaylist();
  if (!liked) {
    if (__DEV__) console.log("[liked] Liked songs playlist missing");
    return false;
  }
  if (liked.songIds.includes(songId)) {
    await removeSongFromPlaylist(liked.id, songId);
    if (__DEV__) console.log(`[liked] removed ${songId}`);
    return false;
  }
  await addSongsToPlaylist(liked.id, [songId]);
  if (__DEV__) console.log(`[liked] added ${songId}`);
  return true;
}
