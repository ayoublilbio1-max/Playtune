import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

import { useTheme } from "../hooks/use-theme";

type Props = {
  playing: boolean;
  color?: string;
  height?: number;
};

const BARS = [
  { delay: 0, low: 0.3, high: 1, ms: 420 },
  { delay: 140, low: 0.45, high: 0.75, ms: 360 },
  { delay: 70, low: 0.25, high: 0.9, ms: 480 },
];

type BarProps = (typeof BARS)[number] & {
  playing: boolean;
  color: string;
  height: number;
};

function Bar({ playing, color, height, delay, low, high, ms }: BarProps) {
  const level = useSharedValue(low);

  useEffect(() => {
    if (playing) {
      level.set(
        withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(high, {
                duration: ms,
                easing: Easing.inOut(Easing.quad),
              }),
              withTiming(low, {
                duration: ms,
                easing: Easing.inOut(Easing.quad),
              }),
            ),
            -1,
            false,
          ),
        ),
      );
    } else {
      cancelAnimation(level);
      level.set(withTiming(low, { duration: 200 }));
    }
    return () => cancelAnimation(level);
  }, [playing, level, delay, low, high, ms]);

  const style = useAnimatedStyle(() => ({ height: height * level.get() }));
  return (
    <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
  );
}

/** Three small bouncing bars ("now playing"). They rest low while paused. */
export function PlayingBars({ playing, color, height = 14 }: Props) {
  const colors = useTheme();
  return (
    <View style={[styles.row, { height }]}>
      {BARS.map((b, i) => (
        <Bar
          key={i}
          playing={playing}
          color={color ?? colors.accent}
          height={height}
          {...b}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
});
