/**
 * Playtune colours — the only place hex values live.
 * Screens use `const colors = useTheme()` and these token names.
 * The app is dark only; `lightColors` points to the same palette until a light theme exists.
 */

export const darkColors = {
  // Brand palette
  background: "#19012B", // Deep Purple — main background
  surface: "#261037", // Dark Plum — cards, bars, equalizer
  accent: "#E401E3", // Hot Magenta — main neon accent
  pink: "#F70AAE", // Vivid Pink
  purple: "#7C09F1", // Electric Purple
  violet: "#5C08F5", // Ultra Violet
  blue: "#3D08F8", // Electric Blue
  cyan: "#4AC4F4", // Bright Cyan
  neonBlue: "#1C9EEF", // Neon Blue
  white: "#FFFFFF",
  glowPink: "#F7CCE9", // Soft Glow Pink
  mutedPurple: "#4D154B", // Muted Purple

  // Text
  textPrimary: "#FFFFFF",
  textMuted: "rgba(255, 255, 255, 0.6)",
  textFaint: "rgba(255, 255, 255, 0.38)",

  // UI helpers
  surfaceRaised: "#33184A",
  border: "rgba(255, 255, 255, 0.08)",
  overlay: "rgba(8, 0, 16, 0.72)",
  danger: "#FF4D6D",
  success: "#3DDC97",

  // Gradients (outer ring and inner disc of the logo)
  outerGradient: ["#F70AAE", "#E401E3", "#7C09F1", "#4AC4F4"] as const,
  innerGradient: ["#7C09F1", "#5C08F5", "#3D08F8", "#1C9EEF"] as const,
  // Song / playlist without artwork (same colours as the notification placeholder)
  placeholderGradient: ["#E401E3", "#7C09F1", "#19012B"] as const,
};

export type AppColors = typeof darkColors;

export const lightColors: AppColors = darkColors;
