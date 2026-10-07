import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { formatTime } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { AppText } from "./AppText";
import { Slider } from "./Slider";

type Props = {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  onSeek: (positionMs: number) => void;
  /** Thumb colour (the theme's accent by default, so it shows on dark and light). */
  thumbColor?: string;
  thickness?: number;
};

/** Song progress: drag with the finger or tap a spot. The time follows the finger while dragging. */
export function SeekBar({
  positionMs,
  durationMs,
  isPlaying,
  onSeek,
  thumbColor,
  thickness = 4,
}: Props) {
  const colors = useTheme();
  const [dragMs, setDragMs] = useState<number | null>(null);
  const ratio = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  return (
    <View>
      <Slider
        value={ratio}
        smoothMs={isPlaying && dragMs === null ? 520 : 0}
        step={0.003}
        thickness={thickness}
        thumbSize={thickness + 9}
        activeColor={colors.accent}
        inactiveColor={colors.surfaceRaised}
        thumbColor={thumbColor ?? colors.accent}
        onValueChange={(r) => setDragMs(r * durationMs)}
        onSlidingComplete={(r) => {
          setDragMs(null);
          if (durationMs > 0) {
            const target = Math.round(r * durationMs);
            if (__DEV__) console.log(`[seek] → ${formatTime(target)}`);
            onSeek(target);
          }
        }}
      />
      <View style={styles.times}>
        <AppText
          variant="label"
          color={dragMs !== null ? colors.accent : colors.textMuted}
        >
          {formatTime(dragMs ?? positionMs)}
        </AppText>
        <AppText variant="label" muted>
          {formatTime(durationMs)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  times: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
});
