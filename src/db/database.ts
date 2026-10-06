import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

/**
 * Playtune's own database (playlists for now; favourites and play counts later).
 * Opened once. The schema version lives in PRAGMA user_version so later versions can add tables safely.
 */
const DB_VERSION = 1;

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
  if (version !== DB_VERSION)
    opened.execSync(`PRAGMA user_version = ${DB_VERSION}`);

  if (__DEV__)
    console.log(
      `[db] opened in ${Date.now() - start}ms (schema v${version} → v${DB_VERSION})`,
    );
  db = opened;
  return opened;
}
