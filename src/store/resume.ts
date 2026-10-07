import { PlaytuneEngine, toQueueItem, type EngineSong } from "../engine/engine";
import { getLibrary } from "./library";

let tried = false;

/**
 * Resume on launch: when the app opens with an empty player, load the last queue, song and position
 * (saved by the engine) — ready but paused. Runs once, after the library scan.
 * If music is already playing (the app was only in the background), nothing changes.
 */
export async function resumeLastSession() {
  if (tried) return;
  tried = true;
  const start = Date.now();
  try {
    const state = await PlaytuneEngine.getState();
    if (state.queueLength > 0) {
      if (__DEV__)
        console.log(
          `[resume] skipped — player already has ${state.queueLength} songs`,
        );
      return;
    }
    const last = await PlaytuneEngine.getLastSession();
    if (!last || last.mediaIds.length === 0) {
      if (__DEV__) console.log("[resume] nothing saved yet");
      return;
    }

    // Songs deleted from the phone since then are skipped; hidden songs are still resumed.
    const { allById } = getLibrary();
    const savedId =
      last.mediaIds[
        Math.min(Math.max(0, last.index), last.mediaIds.length - 1)
      ];
    const songs = last.mediaIds
      .map((id) => allById.get(id))
      .filter((s): s is EngineSong => !!s);
    if (songs.length === 0) {
      if (__DEV__)
        console.log("[resume] saved songs are not on the phone anymore");
      return;
    }
    const found = songs.findIndex((s) => s.id === savedId);
    const index = Math.max(0, found);
    const positionMs = found >= 0 ? Math.max(0, last.positionMs) : 0;

    await PlaytuneEngine.setQueue(
      songs.map(toQueueItem),
      index,
      positionMs,
      false,
    );
    if (__DEV__) {
      console.log(
        `[resume] ${songs.length} songs, "${songs[index].title}" at ${Math.round(positionMs / 1000)}s (paused) in ${Date.now() - start}ms`,
      );
    }
  } catch (e) {
    if (__DEV__) console.log(`[resume] failed — ${String(e)}`);
  }
}
