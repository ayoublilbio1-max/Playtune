import { darkColors, lightColors, type AppColors } from "../constants/colors";
import { useThemeMode } from "../store/theme";

/**
 * Returns the colour tokens for the theme chosen in the side menu (dark by default).
 * Every screen uses it, so switching the theme re-colours the whole app instantly.
 */
export function useTheme(): AppColors {
  return useThemeMode() === "light" ? lightColors : darkColors;
}
