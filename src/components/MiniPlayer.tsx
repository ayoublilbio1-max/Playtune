import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { displayArtist, PlaytuneEngine } from "../engine/engine";
import { usePlaybackProgress } from "../hooks/use-playback-progress";
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
 * Tap the title to open the Player screen.
 */
export function MiniPlayer() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const mediaId = usePlayer((s) => s.mediaId);
  const repeatMode = usePlayer((s) => s.repeatMode);
  const queueLength = usePlayer((s) => s.queueLength);
  const song = useLibrary((s) => (mediaId ? s.byId.get(mediaId) : undefined));
  const { positionMs, durationMs, isPlaying, focused, resetKey, seekTo, stop } =
    usePlaybackProgress();

  if (queueLength === 0) return null;

  const loopOn = repeatMode === "one";

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
        positionMs={positionMs}
        durationMs={durationMs}
        isPlaying={isPlaying}
        onSeek={seekTo}
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
          pressedColor={colors.accent}
          accessibilityLabel="Stop"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
            stop();
          }}
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
