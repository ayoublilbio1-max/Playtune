import * as Haptics from "expo-haptics";
import { memo, useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useTheme } from "../hooks/use-theme";
import { AppText } from "./AppText";

export const WHEEL_ITEM = 52;

type Props = {
  /** Values 0 … count-1 */
  count: number;
  value: number;
  onChange: (value: number) => void;
  width?: number;
};

/** Scroll wheel (00–59…): snaps to a value, the middle value is bright, the others fade (UI thread). */
export function WheelPicker({ count, value, onChange, width = 76 }: Props) {
  const colors = useTheme();
  const ref = useAnimatedRef<Animated.ScrollView>();
  const y = useSharedValue(value * WHEEL_ITEM);
  const reported = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const report = useCallback(
    (offset: number) => {
      const index = Math.min(
        count - 1,
        Math.max(0, Math.round(offset / WHEEL_ITEM)),
      );
      if (index === reported.current) return;
      reported.current = index;
      Haptics.selectionAsync().catch(() => {});
      onChangeRef.current(index);
    },
    [count],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.set(e.contentOffset.y);
    },
    onEndDrag: (e) => {
      scheduleOnRN(report, e.contentOffset.y);
    },
    onMomentumEnd: (e) => {
      scheduleOnRN(report, e.contentOffset.y);
    },
  });

  // Value set from outside (15m / 30m… shortcuts): scroll there.
  useEffect(() => {
    if (value === reported.current) return;
    reported.current = value;
    ref.current?.scrollTo({ y: value * WHEEL_ITEM, animated: true });
  }, [value, ref]);

  return (
    <View style={{ width, height: WHEEL_ITEM * 3 }}>
      <View
        style={[styles.highlight, { backgroundColor: colors.surfaceRaised }]}
      />
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={WHEEL_ITEM}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentOffset={{ x: 0, y: value * WHEEL_ITEM }}
        contentContainerStyle={styles.content}
      >
        {Array.from({ length: count }, (_, i) => (
          <WheelItem key={i} index={i} y={y} />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const WheelItem = memo(function WheelItem({
  index,
  y,
}: {
  index: number;
  y: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(y.get() - index * WHEEL_ITEM);
    return {
      opacity: interpolate(
        distance,
        [0, WHEEL_ITEM, WHEEL_ITEM * 2],
        [1, 0.35, 0.12],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            distance,
            [0, WHEEL_ITEM],
            [1, 0.8],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });
  return (
    <Animated.View style={[styles.item, style]}>
      <AppText size={30} weight="bold">
        {index.toString().padStart(2, "0")}
      </AppText>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  highlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: WHEEL_ITEM,
    height: WHEEL_ITEM,
    borderRadius: 14,
  },
  content: {
    paddingVertical: WHEEL_ITEM,
  },
  item: {
    height: WHEEL_ITEM,
    alignItems: "center",
    justifyContent: "center",
  },
});
