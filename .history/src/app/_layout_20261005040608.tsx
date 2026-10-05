import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useTheme } from "../hooks/use-theme";

// Keep the native splash until the first screen is ready, then fade it out.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

// Tapping the player notification opens playtune://player.
// This keeps the home screen underneath, so Back works after a cold start.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const colors = useTheme();

  useEffect(() => {
    // Fonts are embedded in the app (expo-font plugin), so nothing loads at startup.
    // Screens that load data can hide the splash themselves later; for now hide on mount.
    const start = Date.now();
    SplashScreen.hideAsync()
      .then(() => {
        if (__DEV__)
          console.log(`[splash] hidden after ${Date.now() - start}ms`);
      })
      .catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "fade_from_bottom",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="player"
          options={{ animation: "slide_from_bottom" }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
