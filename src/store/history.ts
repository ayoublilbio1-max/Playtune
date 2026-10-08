import { getDb } from "../db/database";
import { createStore } from "./create-store";
import { getPlayer, subscribePlayer } from "./player";

/** A song counts as "played" after this much listening (not just skipping through it). */
const COUNT_AFTER_MS = 15_000;
const ROW_SIZE = 20;

type PlayRow = { song_id: string; play_count: number; last_played: number };

type HistoryState = {
  /** Song ids, most recently played first. */
  recent: string[];
  /** Song ids, most played first. */
  most: string[];
  counts: Map<string, number>;
};

const store = createStore<HistoryState>({
  recent: [],
  most: [],
  counts: new Map(),
});

export const useHistory = store.useStore;

function load() {
  try {
    const db = getDb();
    const recent = db.getAllSync<PlayRow>(
      "SELECT song_id, play_count, last_played FROM plays ORDER BY last_played DESC LIMIT ?",
      ROW_SIZE * 2,
    );
    const most = db.getAllSync<PlayRow>(
      "SELECT song_id, play_count, last_played FROM plays ORDER BY play_count DESC, last_played DESC LIMIT ?",
      ROW_SIZE * 2,
    );
    store.set({
      recent: recent.map((r) => r.song_id),
      most: most.map((r) => r.song_id),
      counts: new Map(most.map((r) => [r.song_id, r.play_count])),
    });
  } catch (e) {
    if (__DEV__) console.log(`[history] load failed — ${String(e)}`);
  }
}

function recordPlay(songId: string) {
  try {
    getDb().runSync(
      `INSERT INTO plays (song_id, play_count, last_played) VALUES (?, 1, ?)
       ON CONFLICT(song_id) DO UPDATE SET play_count = play_count + 1, last_played = excluded.last_played`,
      songId,
      Date.now(),
    );
    load();
    if (__DEV__)
      console.log(
        `[history] played ${songId} (${store.get().counts.get(songId) ?? 1}×)`,
      );
  } catch (e) {
    if (__DEV__) console.log(`[history] save failed — ${String(e)}`);
  }
}

let started = false;
let currentId: string | null = null;
let listenedMs = 0;
let counted = false;
let playingSince = 0;

/** Watches the player: a song is counted once per time it is played, after 15 s of listening. */
export function initHistory() {
  if (started) return;
  started = true;
  load();

  const tick = setInterval(() => {
    if (!playingSince || counted || !currentId) return;
    const now = Date.now();
    listenedMs += now - playingSince;
    playingSince = now;
    if (listenedMs >= COUNT_AFTER_MS) {
      counted = true;
      recordPlay(currentId);
    }
  }, 1000);

  subscribePlayer(() => {
    const { mediaId, isPlaying } = getPlayer();
    if (mediaId !== currentId) {
      currentId = mediaId;
      listenedMs = 0;
      counted = false;
      playingSince = 0;
    }
    if (isPlaying && !playingSince) playingSince = Date.now();
    if (!isPlaying && playingSince) {
      listenedMs += Date.now() - playingSince;
      playingSince = 0;
    }
  });

  if (__DEV__)
    console.log(`[history] ready — ${store.get().recent.length} recent songs`);
  return () => clearInterval(tick);
}

/** Clears Recently / Most played (the songs stay). */
export function clearHistory() {
  try {
    getDb().runSync("DELETE FROM plays");
    load();
    if (__DEV__) console.log("[history] cleared");
  } catch (e) {
    if (__DEV__) console.log(`[history] clear failed — ${String(e)}`);
  }
}
