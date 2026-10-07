import {
  applyPauseOnDetach,
  PlaytuneEngine,
  type PlayerState,
} from "../engine/engine";
import { createStore } from "./create-store";
import { getSettings } from "./settings";

/** Live player state, fed by the engine's events. Progress (position) is polled separately by the mini player. */
const store = createStore<PlayerState>({
  isPlaying: false,
  playWhenReady: false,
  state: "idle",
  repeatMode: "off",
  index: -1,
  mediaId: null,
  queueLength: 0,
  positionMs: 0,
  durationMs: 0,
});

export const usePlayer = store.useStore;
export const getPlayer = store.get;

let started = false;

/** Normalises what the engine sends (an old "all" value becomes "off"). */
function apply(state: PlayerState) {
  store.set({
    ...state,
    repeatMode: state.repeatMode === "one" ? "one" : "off",
  });
}

/** Subscribes to the engine once, for the whole app. */
export function initPlayer() {
  if (started) return;
  started = true;

  PlaytuneEngine.addListener("onPlayerState", apply);
  PlaytuneEngine.addListener("onTrackChange", (e) => {
    if (__DEV__) console.log(`[player] track → ${e.mediaId} (${e.reason})`);
  });
  PlaytuneEngine.addListener("onError", (e) => {
    if (__DEV__)
      console.log(`[player] error ${e.code} on ${e.mediaId}: ${e.message}`);
  });

  // Only needed when the user turned it off (the engine pauses on detach by default).
  if (!getSettings().pauseOnDetach) applyPauseOnDetach(false);

  PlaytuneEngine.getState()
    .then((s) => {
      apply(s);
      if (__DEV__) console.log("[player] live state", JSON.stringify(s));
    })
    .catch((e) => {
      if (__DEV__) console.log(`[player] getState failed — ${String(e)}`);
    });
}
