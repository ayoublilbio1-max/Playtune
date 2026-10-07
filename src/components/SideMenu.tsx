import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSleepCountdown } from "../hooks/use-countdown";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { usePlayer } from "../store/player";
import { getLikedPlaylist } from "../store/playlists";
import { formatCountdown } from "../store/sleep";
import { setThemeMode, useThemeMode } from "../store/theme";
import { AppText } from "./AppText";
import { PlayingBars } from "./PlayingBars";

const DISC = require("../../assets/images/disc_logo.png");

type Props = {
  visible: boolean;
  onClose: () => void;
};

function MenuItem({
  icon,
  label,
  onPress,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  trailing?: ReactNode;
}) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        { backgroundColor: pressed ? colors.surfaceRaised : "transparent" },
      ]}
    >
      {icon}
      <AppText weight="medium" numberOfLines={1} style={styles.itemLabel}>
        {label}
      </AppText>
      {trailing}
    </Pressable>
  );
}

/** Bouncing bars next to "Now playing" while a song plays (resting while paused, hidden with no queue). */
function NowPlayingMark() {
  const hasQueue = usePlayer((s) => s.queueLength > 0);
  const isPlaying = usePlayer((s) => s.isPlaying);
  if (!hasQueue) return null;
  return <PlayingBars playing={isPlaying} />;
}

/** Time left on the sleep timer next to its menu item (only while the menu is open). */
function TimerLeft() {
  const colors = useTheme();
  const left = useSleepCountdown();
  if (left === null) return null;
  return (
    <AppText variant="label" color={colors.accent}>
      {formatCountdown(left)}
    </AppText>
  );
}

/**
 * Side menu (opens from the right, half the screen): links to the app's screens and the theme switch.
 * Drawn inside the screen (not a separate window) so the hidden navigation bar stays hidden.
 */
export function SideMenu({ visible, onClose }: Props) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mode = useThemeMode();
  const { t } = useT();
  const panelWidth = Math.max(Math.round(width * 0.5), 230);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const go = (action: () => void) => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
    action();
  };

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(160)}
      style={styles.root}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      />

      <Animated.View
        entering={SlideInRight.duration(240)}
        style={[
          styles.panel,
          {
            width: panelWidth,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingTop: insets.top + 18,
            paddingBottom: insets.bottom + 18,
          },
        ]}
      >
        <View style={styles.brand}>
          <Image source={DISC} style={styles.logo} contentFit="contain" />
          <AppText variant="heading">Playtune</AppText>
        </View>

        <View style={styles.items}>
          <MenuItem
            icon={
              <MaterialCommunityIcons
                name="playlist-music"
                size={22}
                color={colors.accent}
              />
            }
            label={t("menu.playlists")}
            onPress={() => go(() => router.push("/playlists"))}
          />
          <MenuItem
            icon={<Ionicons name="heart" size={22} color={colors.accent} />}
            label={t("common.likedSongs")}
            onPress={() =>
              go(() => {
                const liked = getLikedPlaylist();
                if (liked)
                  router.push({
                    pathname: "/playlist/[id]",
                    params: { id: String(liked.id) },
                  });
              })
            }
          />
          <MenuItem
            icon={
              <Ionicons
                name="play-circle-outline"
                size={22}
                color={colors.neonBlue}
              />
            }
            label={t("menu.nowPlaying")}
            trailing={<NowPlayingMark />}
            onPress={() => go(() => router.push("/player"))}
          />
          <MenuItem
            icon={
              <MaterialCommunityIcons
                name="playlist-play"
                size={22}
                color={colors.pink}
              />
            }
            label={t("menu.queue")}
            onPress={() => go(() => router.push("/queue"))}
          />
          <MenuItem
            icon={
              <MaterialCommunityIcons
                name="equalizer"
                size={22}
                color={colors.purple}
              />
            }
            label={t("menu.equalizer")}
            onPress={() => go(() => router.push("/equalizer"))}
          />
          <MenuItem
            icon={
              <Ionicons name="timer-outline" size={22} color={colors.cyan} />
            }
            label={t("menu.sleepTimer")}
            trailing={<TimerLeft />}
            onPress={() => go(() => router.push("/sleep-timer"))}
          />
          <MenuItem
            icon={
              <Ionicons
                name="settings-outline"
                size={22}
                color={colors.textMuted}
              />
            }
            label={t("menu.settings")}
            onPress={() => go(() => router.push("/settings"))}
          />
        </View>

        <View style={[styles.themeRow, { borderTopColor: colors.border }]}>
          <Ionicons
            name={mode === "light" ? "sunny" : "moon"}
            size={20}
            color={colors.textMuted}
          />
          <AppText weight="medium" style={styles.itemLabel}>
            {t("settings.lightTheme")}
          </AppText>
          <Switch
            value={mode === "light"}
            onValueChange={(on) => setThemeMode(on ? "light" : "dark")}
            trackColor={{ false: colors.surfaceRaised, true: colors.violet }}
            thumbColor={colors.white}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 150,
    elevation: 150,
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    paddingHorizontal: 12,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 22,
  },
  logo: {
    width: 34,
    height: 34,
  },
  items: {
    flex: 1,
    gap: 2,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 10,
    paddingVertical: 13,
    borderRadius: 14,
  },
  itemLabel: {
    flex: 1,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
