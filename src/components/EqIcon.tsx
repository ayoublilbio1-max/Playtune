import { Image } from "expo-image";
import type { ImageStyle, StyleProp } from "react-native";

const EQ_ICON = require("../../assets/icons/eq_icon.webp");

type Props = {
  size?: number;
  /** The icon file is one colour; it is painted with this colour (theme token). */
  color: string;
  style?: StyleProp<ImageStyle>;
};

/** Playtune's equalizer icon (assets/icons/eq_icon.webp), used everywhere the app shows the equalizer. */
export function EqIcon({ size = 24, color, style }: Props) {
  return (
    <Image
      source={EQ_ICON}
      tintColor={color}
      contentFit="contain"
      style={[{ width: size, height: size }, style]}
      accessibilityIgnoresInvertColors
    />
  );
}
