import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { PlaytuneEngine, stopToStart } from "../engine/engine";
import { usePlayer } from "../store/player";

/**
 * Position / duration of the current song for a screen, plus seek and stop helpers.
 * Polls the engine twice per second only while music plays, the screen is visible AND the app is open
 * (no polling while you use another app, so the phone has more time for the music).
 */
export function usePlaybackProgress() {
  const mediaId = usePlayer((s) => s.mediaId);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const statePosition = usePlayer((s) => s.positionMs);
  const stateDuration = usePlayer((s) => s.durationMs);

  const [progress, setProgress] = useState({ positionMs: 0, durationMs: 0 });
  const [resetKey, setResetKey] = useState(0);
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  const ignorePollsUntil = useRef(0);
  const latest = useRef(progress);

  useEffect(() => {
    latest.current = progress;
  }, [progress]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setAppActive(state === "active"),
    );
    return () => sub.remove();
  }, []);

  // Position from player events (track change, pause, seek…).
  useEffect(() => {
    setProgress({ positionMs: statePosition, durationMs: stateDuration });
  }, [statePosition, stateDuration, mediaId]);

  useEffect(() => {
    if (!isPlaying || !focused || !appActive) return;
    let alive = true;
    const tick = () => {
      PlaytuneEngine.getProgress()
        .then((p) => {
          if (!alive || Date.now() < ignorePollsUntil.current) return;
          setProgress({ positionMs: p.positionMs, durationMs: p.durationMs });
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isPlaying, focused, appActive, mediaId]);

  const seekTo = useCallback((ms: number) => {
    ignorePollsUntil.current = Date.now() + 700;
    setProgress((p) => ({ ...p, positionMs: ms }));
    PlaytuneEngine.seekTo(ms).catch(() => {});
  }, []);

  /** ±10 s buttons. Never jumps past the end of the song. */
  const seekBy = useCallback(
    (deltaMs: number) => {
      const { positionMs, durationMs } = latest.current;
      const max =
        durationMs > 0 ? Math.max(0, durationMs - 1000) : positionMs + deltaMs;
      const target = Math.min(max, Math.max(0, positionMs + deltaMs));
      if (__DEV__)
        console.log(
          `[seek] ${deltaMs > 0 ? "+" : ""}${deltaMs / 1000}s → ${Math.round(target / 1000)}s`,
        );
      seekTo(target);
    },
    [seekTo],
  );

  /** Stop button: pause, back to 0:00, disc/artwork back to their start angle. */
  const stop = useCallback(() => {
    ignorePollsUntil.current = Date.now() + 700;
    setProgress((p) => ({ ...p, positionMs: 0 }));
    setResetKey((k) => k + 1);
    stopToStart();
  }, []);

  return {
    positionMs: progress.positionMs,
    durationMs: progress.durationMs,
    isPlaying,
    focused,
    resetKey,
    seekTo,
    seekBy,
    stop,
  };
}
