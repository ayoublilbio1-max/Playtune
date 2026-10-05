import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { fonts, type FontWeightName } from "../constants/fonts";
import { useTheme } from "../hooks/use-theme";

type Variant = "display" | "title" | "heading" | "body" | "caption" | "label";

const variants: Record<Variant, { size: number; weight: FontWeightName }> = {
  display: { size: 32, weight: "bold" },
  title: { size: 24, weight: "bold" },
  heading: { size: 18, weight: "semibold" },
  body: { size: 15, weight: "regular" },
  caption: { size: 13, weight: "regular" },
  label: { size: 12, weight: "medium" },
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  weight?: FontWeightName;
  size?: number;
  color?: string;
  muted?: boolean;
  align?: TextStyle["textAlign"];
};

/**
 * Use instead of <Text> everywhere. Sets DM Sans, the theme text colour and a
 * lineHeight of ~1.4 × fontSize so letters are never cut at the bottom.
 */
export function AppText({
  variant = "body",
  weight,
  size,
  color,
  muted,
  align,
  style,
  ...rest
}: AppTextProps) {
  const colors = useTheme();
  const v = variants[variant];
  const fontSize = size ?? v.size;

  return (
    <Text
      {...rest}
      style={[
        styles.base,
        {
          fontFamily: fonts[weight ?? v.weight],
          fontSize,
          lineHeight: Math.round(fontSize * 1.4),
          color: color ?? (muted ? colors.textMuted : colors.textPrimary),
          textAlign: align,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
