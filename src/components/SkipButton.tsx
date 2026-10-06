import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { useTheme } from "../hooks/use-theme";
import { AppText } from "./AppText";

type Props = {
  direction: "back" | "forward";
  seconds?: number;
  onPress: () => void;
};

/** −10 s / +10 s: the round arrow spins one turn in its direction on each tap; the number stays still. */
export function SkipButton({ direction, seconds = 10, onPress }: Props) {
  const colors = useTheme();
  const rotation = useSharedValue(0);
  const sign = direction === "back" ? -1 : 1;

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <Pressable
      hitSlop={10}
      accessibilityLabel={
        direction === "back"
          ? `Back ${seconds} seconds`
          : `Forward ${seconds} seconds`
      }
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        // Continue from where the arrow is, one more turn each tap (fast taps keep spinning).
        const target = Math.round(rotation.get() / 360) * 360 + sign * 360;
        rotation.set(
          withTiming(target, {
            duration: 450,
            easing: Easing.out(Easing.cubic),
          }),
        );
        onPress();
      }}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.75 : 1 }]}
    >
      <Animated.View style={[styles.arrow, spin]}>
        <MaterialCommunityIcons
          name={direction === "back" ? "rotate-left" : "rotate-right"}
          size={38}
          color={colors.accent}
        />
      </Animated.View>
      <AppText
        size={11}
        weight="bold"
        color={colors.accent}
        style={styles.number}
      >
        {seconds}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    position: "absolute",
  },
  number: {
    marginTop: 1,
  },
});
