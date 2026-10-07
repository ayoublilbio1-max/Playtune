import { NavigationBar, setVisibilityAsync } from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useTheme } from "../hooks/use-theme";
import { initPlayer } from "../store/player";
import { useThemeMode } from "../store/theme";

// Keep the native splash until Home knows what to show, then fade it out.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

// Tapping the player notification opens playtune://player.
// This keeps the home screen underneath, so Back works after a cold start.
export const unstable_settings = {
  initialRouteName: "index",
};

/**
 * Hides the phone's ◁ ○ □ bar again (some phones show it after the app comes back from the background).
 * The <NavigationBar hidden /> below hides it while the app runs; a swipe from the bottom edge shows it for a moment.
 */
function hideNavigationBar(reason: string) {
  setVisibilityAsync("hidden")
    .then(() => {
      if (__DEV__) console.log(`[nav] navigation bar hidden (${reason})`);
    })
    .catch((e) => {
      if (__DEV__)
        console.log(`[nav] could not hide navigation bar — ${String(e)}`);
    });
}

export default function RootLayout() {
  const colors = useTheme();
  const mode = useThemeMode();

  useEffect(() => {
    initPlayer();

    // Some phones show the bar again after the app comes back from the background.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") hideNavigationBar("app active");
    });

    // Safety net: never leave the splash on screen.
    const splashTimer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);

    return () => {
      sub.remove();
      clearTimeout(splashTimer);
    };
  }, []);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      <NavigationBar hidden />
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
        <Stack.Screen
          name="equalizer"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="playlist/[id]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="playlist/add-songs"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="playlists"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="sleep-timer"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="settings"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="queue"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="lyrics"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="collection/[kind]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="hide-music"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="transfer"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="terms"
          options={{ animation: "slide_from_right" }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
