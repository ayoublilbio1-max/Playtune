import { useColorScheme } from "react-native";

import { darkColors, lightColors, type AppColors } from "../constants/colors";

/**
 * Returns the colour tokens for the current theme.
 * The app is dark only ("userInterfaceStyle": "dark" in app.json), so this always
 * resolves to darkColors today; the hook stays so a light theme can be added later
 * without touching any screen.
 */
export function useTheme(): AppColors {
  const scheme = useColorScheme();
  return scheme === "light" ? lightColors : darkColors;
}
