/**
 * DM Sans is embedded in the app by the expo-font plugin (app.json).
 * On Android the font name is the file name, so we pick a file per weight
 * instead of using fontWeight.
 */
export const fonts = {
  light: "DMSans-Light",
  regular: "DMSans-Regular",
  medium: "DMSans-Medium",
  semibold: "DMSans-SemiBold",
  bold: "DMSans-Bold",
} as const;

export type FontWeightName = keyof typeof fonts;
