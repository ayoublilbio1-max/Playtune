import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

/**
 * Playtune's own database: playlists (including the built-in "Liked songs").
 * The schema version lives in PRAGMA user_version, so each version only adds what is missing.
 *   v1: playlists + playlist_songs
 *   v2: playlists.kind ('user' | 'liked') + the "Liked songs" playlist
 */
const DB_VERSION = 2;

export const LIKED_PLAYLIST_NAME = "Liked songs";

let db: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
  if (db) return db;
  const start = Date.now();
  const opened = openDatabaseSync("playtune.db");
  opened.execSync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const row = opened.getFirstSync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const version = row?.user_version ?? 0;

  if (version < 1) {
    opened.execSync(`
      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS playlist_songs (
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        song_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, song_id)
      );
      CREATE INDEX IF NOT EXISTS idx_playlist_songs_order ON playlist_songs (playlist_id, position);
    `);
  }
  if (version < 2) {
    opened.execSync(
      `ALTER TABLE playlists ADD COLUMN kind TEXT NOT NULL DEFAULT 'user';`,
    );
  }
  if (version !== DB_VERSION)
    opened.execSync(`PRAGMA user_version = ${DB_VERSION}`);

  // "Liked songs" always exists (created once, never deleted).
  const now = Date.now();
  opened.runSync(
    `INSERT INTO playlists (name, kind, created_at, updated_at)
     SELECT ?, 'liked', ?, ? WHERE NOT EXISTS (SELECT 1 FROM playlists WHERE kind = 'liked')`,
    LIKED_PLAYLIST_NAME,
    now,
    now,
  );

  if (__DEV__)
    console.log(
      `[db] opened in ${Date.now() - start}ms (schema v${version} → v${DB_VERSION})`,
    );
  db = opened;
  return opened;
}
