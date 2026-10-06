import { Ionicons } from "@expo/vector-icons";
import { useId } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "../hooks/use-theme";

type Props = {
  width: number;
  height?: number;
  radius?: number;
  /** Icon size relative to the shorter side. */
  iconScale?: number;
  /** Music note by default; "heart" for Liked songs. */
  icon?: "musical-note" | "heart";
  style?: StyleProp<ViewStyle>;
};

/** Shown when a song or playlist has no artwork: diagonal gradient (accent → purple → background) + white note. */
export function ArtworkPlaceholder({
  width,
  height = width,
  radius = 0,
  iconScale = 0.42,
  icon = "musical-note",
  style,
}: Props) {
  const colors = useTheme();
  const gradientId = `ph${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [c1, c2, c3] = colors.placeholderGradient;

  return (
    <View
      style={[
        { width, height, borderRadius: radius, overflow: "hidden" },
        style,
      ]}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c1} />
            <Stop offset="0.5" stopColor={c2} />
            <Stop offset="1" stopColor={c3} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill={`url(#${gradientId})`}
        />
      </Svg>
      <View style={styles.center}>
        <Ionicons
          name={icon}
          size={Math.round(Math.min(width, height) * iconScale)}
          color={colors.white}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
