/**
 * Playtune colours — the only place hex values live.
 * Screens use `const colors = useTheme()` and these token names, so switching
 * between the dark and light palettes changes the whole app at once.
 */

export type AppColors = {
  // Brand palette (same in both themes)
  background: string;
  surface: string;
  accent: string;
  pink: string;
  purple: string;
  violet: string;
  blue: string;
  cyan: string;
  neonBlue: string;
  white: string;
  glowPink: string;
  mutedPurple: string;
  /** Liked ♥ (Player screen). */
  heart: string;

  // Text
  textPrimary: string;
  textMuted: string;
  textFaint: string;

  // UI helpers
  surfaceRaised: string;
  border: string;
  overlay: string;
  danger: string;
  success: string;

  // Gradients
  outerGradient: readonly [string, string, string, string];
  innerGradient: readonly [string, string, string, string];
  /** Song / playlist without artwork (same colours as the notification placeholder). */
  placeholderGradient: readonly [string, string, string];
  /** Equalizer band sliders (top → bottom: blue at the top, magenta at the bottom). */
  eqBandGradient: readonly [string, string, string, string];
  /** Equalizer curve and selected preset (left → right). */
  eqCurveGradient: readonly [string, string, string];
  /** Bass boost / virtualizer sliders (left → right). */
  eqStrengthGradient: readonly [string, string];
};

const brand = {
  accent: "#E401E3", // Hot Magenta — main neon accent
  pink: "#F70AAE", // Vivid Pink
  purple: "#7C09F1", // Electric Purple
  violet: "#5C08F5", // Ultra Violet
  blue: "#3D08F8", // Electric Blue
  cyan: "#4AC4F4", // Bright Cyan
  neonBlue: "#1C9EEF", // Neon Blue
  white: "#FFFFFF",
  glowPink: "#F7CCE9", // Soft Glow Pink
  heart: "#FF003C", // Liked heart red
  outerGradient: ["#F70AAE", "#E401E3", "#7C09F1", "#4AC4F4"] as const,
  innerGradient: ["#7C09F1", "#5C08F5", "#3D08F8", "#1C9EEF"] as const,
  placeholderGradient: ["#E401E3", "#7C09F1", "#19012B"] as const,
  eqBandGradient: ["#1C9EEF", "#3D08F8", "#7C09F1", "#E401E3"] as const,
  eqCurveGradient: ["#E401E3", "#7C09F1", "#3D08F8"] as const,
  eqStrengthGradient: ["#E401E3", "#7C09F1"] as const,
};

export const darkColors: AppColors = {
  ...brand,
  background: "#19012B", // Deep Purple — main background
  surface: "#261037", // Dark Plum — cards, bars, equalizer
  mutedPurple: "#4D154B", // Muted Purple

  textPrimary: "#FFFFFF",
  textMuted: "rgba(255, 255, 255, 0.6)",
  textFaint: "rgba(255, 255, 255, 0.38)",

  surfaceRaised: "#33184A",
  border: "rgba(255, 255, 255, 0.08)",
  overlay: "rgba(8, 0, 16, 0.72)",
  danger: "#FF4D6D",
  success: "#3DDC97",
};

/** Light theme (trial): soft lilac background, white cards, deep purple text, same brand accents. */
export const lightColors: AppColors = {
  ...brand,
  background: "#F6F0FB",
  surface: "#FFFFFF",
  mutedPurple: "#EAD9F2",

  textPrimary: "#1E0B2E",
  textMuted: "rgba(30, 11, 46, 0.62)",
  textFaint: "rgba(30, 11, 46, 0.38)",

  surfaceRaised: "#ECE1F6",
  border: "rgba(30, 11, 46, 0.09)",
  overlay: "rgba(25, 1, 43, 0.45)",
  danger: "#E0344E",
  success: "#17A86C",
};
