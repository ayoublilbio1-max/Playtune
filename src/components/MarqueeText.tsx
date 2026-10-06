import { useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
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

import { AppText, type AppTextProps } from "./AppText";

type Props = {
  text: string;
  /** Text style (variant, weight, size, color…). */
  textProps?: Omit<AppTextProps, "children" | "numberOfLines">;
  /** Pixels per second. */
  speed?: number;
  /** Pause before each loop starts (ms). */
  pauseMs?: number;
};

const GAP = 48; // space between the end of the text and its next copy

/**
 * One line of text. If it fits, it's centered and still.
 * If it's too long, it slides to the left in a loop (on the UI thread, smooth) so the whole title can be read.
 */
export function MarqueeText({
  text,
  textProps,
  speed = 40,
  pauseMs = 1400,
}: Props) {
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const offset = useSharedValue(0);

  const lineHeight = Math.round((textProps?.size ?? 24) * 1.4) + 2;
  const overflow = boxWidth > 0 && textWidth > boxWidth + 1;

  useEffect(() => {
    cancelAnimation(offset);
    offset.set(0);
    if (!overflow) return;
    const distance = textWidth + GAP;
    offset.set(
      withRepeat(
        withSequence(
          withDelay(
            pauseMs,
            withTiming(-distance, {
              duration: (distance / speed) * 1000,
              easing: Easing.linear,
            }),
          ),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(offset);
  }, [overflow, textWidth, text, speed, pauseMs, offset]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));

  return (
    <View
      style={[styles.box, { height: lineHeight }]}
      onLayout={(e: LayoutChangeEvent) =>
        setBoxWidth(e.nativeEvent.layout.width)
      }
    >
      {/* Measures the text's natural width (never shown). */}
      <View style={styles.measure} pointerEvents="none">
        <AppText
          {...textProps}
          onLayout={(e: LayoutChangeEvent) =>
            setTextWidth(e.nativeEvent.layout.width)
          }
        >
          {text}
        </AppText>
      </View>

      {overflow ? (
        <Animated.View style={[styles.track, slide]}>
          <AppText {...textProps}>{text}</AppText>
          <View style={{ width: GAP }} />
          <AppText {...textProps}>{text}</AppText>
        </Animated.View>
      ) : (
        <AppText
          {...textProps}
          numberOfLines={1}
          align="center"
          style={styles.centered}
        >
          {text}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    overflow: "hidden",
    justifyContent: "center",
  },
  measure: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 10000,
    flexDirection: "row",
    opacity: 0,
  },
  track: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 10000,
    flexDirection: "row",
  },
  centered: {
    width: "100%",
  },
});
