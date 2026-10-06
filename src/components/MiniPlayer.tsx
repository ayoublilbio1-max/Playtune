import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { displayArtist, PlaytuneEngine, stopToStart } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import { AppText } from "./AppText";
import { IconButton } from "./IconButton";
import { SeekBar } from "./SeekBar";
import { SpinningDisc } from "./SpinningDisc";

/** Space lists should leave at the bottom so the mini player never hides the last rows. */
export const MINI_PLAYER_SPACE = 200;

const DISC_SIZE = 42; // = title line (21) + artist line (18) + small gap

/**
 * The playback box at the bottom of the library screens:
 * disc + title/artist, seek bar, and Loop · Back · Play/Pause · Next · Stop.
 */
export function MiniPlayer() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const mediaId = usePlayer((s) => s.mediaId);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const repeatMode = usePlayer((s) => s.repeatMode);
  const queueLength = usePlayer((s) => s.queueLength);
  const statePosition = usePlayer((s) => s.positionMs);
  const stateDuration = usePlayer((s) => s.durationMs);
  const song = useLibrary((s) => (mediaId ? s.byId.get(mediaId) : undefined));

  const [progress, setProgress] = useState({ positionMs: 0, durationMs: 0 });
  const [resetKey, setResetKey] = useState(0);
  const [focused, setFocused] = useState(true);
  const ignorePollsUntil = useRef(0);

  // Home stays mounted under other screens: only the visible mini player polls and spins.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Position from player events (track change, pause, seek…).
  useEffect(() => {
    setProgress({ positionMs: statePosition, durationMs: stateDuration });
  }, [statePosition, stateDuration, mediaId]);

  // While playing, ask the engine for the position twice per second.
  useEffect(() => {
    if (!isPlaying || !focused) return;
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
  }, [isPlaying, focused, mediaId]);

  if (queueLength === 0) return null;

  const loopOn = repeatMode === "one";

  const onSeek = (ms: number) => {
    ignorePollsUntil.current = Date.now() + 700;
    setProgress((p) => ({ ...p, positionMs: ms }));
    PlaytuneEngine.seekTo(ms).catch(() => {});
  };

  const onStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    ignorePollsUntil.current = Date.now() + 700;
    setProgress((p) => ({ ...p, positionMs: 0 }));
    setResetKey((k) => k + 1);
    stopToStart();
  };

  const onLoop = () => {
    const next = loopOn ? "off" : "one";
    if (__DEV__) console.log(`[mini] loop → ${next}`);
    PlaytuneEngine.setRepeatMode(next).catch(() => {});
  };

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          bottom: insets.bottom + 10,
        },
      ]}
    >
      <Pressable style={styles.info} onPress={() => router.push("/player")}>
        <SpinningDisc
          size={DISC_SIZE}
          playing={isPlaying && focused}
          resetKey={resetKey}
        />
        <View style={styles.texts}>
          <AppText weight="semibold" numberOfLines={1}>
            {song?.title ?? "Unknown song"}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {displayArtist(song?.artist)}
          </AppText>
        </View>
      </Pressable>

      <SeekBar
        positionMs={progress.positionMs}
        durationMs={progress.durationMs}
        isPlaying={isPlaying}
        onSeek={onSeek}
      />

      <View style={styles.controls}>
        <IconButton
          name="repeat"
          size={24}
          color={loopOn ? colors.accent : colors.textMuted}
          badge={loopOn ? "1" : undefined}
          accessibilityLabel={loopOn ? "Loop on" : "Loop off"}
          onPress={onLoop}
        />
        <IconButton
          name="play-skip-back"
          size={26}
          accessibilityLabel="Previous"
          onPress={() => PlaytuneEngine.previous().catch(() => {})}
        />
        <IconButton
          name={isPlaying ? "pause" : "play"}
          size={28}
          box="accent"
          round
          boxSize={56}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          style={isPlaying ? undefined : styles.playOffset}
          onPress={() => PlaytuneEngine.togglePlay().catch(() => {})}
        />
        <IconButton
          name="play-skip-forward"
          size={26}
          accessibilityLabel="Next"
          onPress={() => PlaytuneEngine.next().catch(() => {})}
        />
        <IconButton
          name="stop"
          size={22}
          color={colors.textMuted}
          accessibilityLabel="Stop"
          onPress={onStop}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    left: 10,
    right: 10,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    elevation: 12,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  texts: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  playOffset: {
    paddingLeft: 3,
  },
});
