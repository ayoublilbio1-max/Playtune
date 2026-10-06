import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

import { useTheme } from "../hooks/use-theme";
import { ROW_HEIGHT } from "./SongRow";

/** Pulsing placeholder rows while songs load. */
export function SongListSkeleton({ rows = 8 }: { rows?: number }) {
  const colors = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View style={pulse}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.art, { backgroundColor: colors.surface }]} />
          <View style={styles.texts}>
            <View
              style={[
                styles.line,
                { width: "70%", backgroundColor: colors.surface },
              ]}
            />
            <View
              style={[
                styles.line,
                styles.small,
                { width: "45%", backgroundColor: colors.surface },
              ]}
            />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  art: {
    width: 46,
    height: 46,
    borderRadius: 10,
  },
  texts: {
    flex: 1,
    gap: 8,
  },
  line: {
    height: 12,
    borderRadius: 6,
  },
  small: {
    height: 10,
  },
});
