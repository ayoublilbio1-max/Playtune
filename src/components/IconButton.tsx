import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../hooks/use-theme";
import { AppText } from "./AppText";
import { EqIcon } from "./EqIcon";

type IconSpec =
  | { family?: "ion"; name: keyof typeof Ionicons.glyphMap }
  | { family: "mci"; name: keyof typeof MaterialCommunityIcons.glyphMap }
  /** Playtune's own equalizer icon (assets/icons/eq_icon.webp). */
  | { family: "eq"; name?: undefined };

type Props = IconSpec & {
  onPress: () => void;
  size?: number;
  color?: string;
  /** Icon colour while the finger is on the button (e.g. muted icon that lights up on tap). */
  pressedColor?: string;
  /** Square/circle box behind the icon. */
  box?: "none" | "soft" | "accent";
  boxSize?: number;
  round?: boolean;
  badge?: string;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton(props: Props) {
  const colors = useTheme();
  const {
    onPress,
    size = 24,
    color,
    pressedColor,
    box = "none",
    boxSize = 44,
    round = false,
    badge,
    disabled,
    haptic = true,
    accessibilityLabel,
    style,
  } = props;

  const iconColor =
    color ?? (box === "accent" ? colors.white : colors.textPrimary);
  const boxStyle: ViewStyle | null =
    box === "none"
      ? null
      : {
          width: boxSize,
          height: boxSize,
          borderRadius: round ? boxSize / 2 : 14,
          backgroundColor: box === "accent" ? colors.accent : colors.surface,
        };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        boxStyle ?? { minWidth: size + 16, minHeight: size + 16 },
        { opacity: disabled ? 0.35 : pressed && !pressedColor ? 0.6 : 1 },
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {props.family === "eq" ? (
            <EqIcon
              size={size}
              color={pressed && pressedColor ? pressedColor : iconColor}
            />
          ) : props.family === "mci" ? (
            <MaterialCommunityIcons
              name={props.name}
              size={size}
              color={pressed && pressedColor ? pressedColor : iconColor}
            />
          ) : (
            <Ionicons
              name={props.name}
              size={size}
              color={pressed && pressedColor ? pressedColor : iconColor}
            />
          )}
          {badge ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.accent, borderColor: colors.surface },
              ]}
            >
              <AppText
                size={9}
                weight="bold"
                color={colors.white}
                style={styles.badgeText}
              >
                {badge}
              </AppText>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    lineHeight: 12,
  },
});
