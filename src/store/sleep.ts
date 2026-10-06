import { PlaytuneEngine, type SleepTimerInfo } from "../engine/engine";
import { createStore } from "./create-store";

/** Sleep timer as seen by the app. The real timer runs in the engine's background service. */
type SleepState = {
  active: boolean;
  /** Date.now() when the music stops (0 when no timer). */
  endsAt: number;
};

const store = createStore<SleepState>({ active: false, endsAt: 0 });

export const useSleep = store.useStore;

function apply(info: SleepTimerInfo) {
  store.set(
    info.active
      ? { active: true, endsAt: Date.now() + info.remainingMs }
      : { active: false, endsAt: 0 },
  );
}

export async function refreshSleepTimer() {
  try {
    apply(await PlaytuneEngine.getSleepTimer());
  } catch (e) {
    if (__DEV__) console.log(`[sleep] read failed — ${String(e)}`);
  }
}

export async function startSleepTimer(durationMs: number) {
  if (__DEV__) console.log(`[sleep] start ${Math.round(durationMs / 1000)}s`);
  apply(await PlaytuneEngine.startSleepTimer(durationMs));
}

export async function cancelSleepTimer() {
  if (__DEV__) console.log("[sleep] cancel");
  apply(await PlaytuneEngine.cancelSleepTimer());
}

/** Called by the countdown when it reaches 0 (the engine has paused the music by then). */
export function markSleepTimerDone() {
  store.set({ active: false, endsAt: 0 });
}

/** "1:05:09" / "12:34" */
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? m.toString().padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${s.toString().padStart(2, "0")}`;
}
