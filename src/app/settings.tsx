import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { ConfirmModal } from "../components/ConfirmModal";
import { ScreenHeader } from "../components/ScreenHeader";
import { showToast, Toast } from "../components/Toast";
import { APP_VERSION, DEVELOPER } from "../constants/app";
import { clearArtworkCache } from "../hooks/use-artwork";
import { useTheme } from "../hooks/use-theme";
import { rescanLibrary, useLibrary } from "../store/library";
import {
    MIN_SONG_OPTIONS,
    setMinSongSeconds,
    useSettings,
    type MinSongSeconds,
} from "../store/settings";
import { setThemeMode, useThemeMode } from "../store/theme";

const DISC = require("../../assets/images/disc_logo.png");

function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useTheme();
  return (
    <View style={styles.section}>
      <AppText variant="label" muted style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const colors = useTheme();
  return (
    <Pressable
      disabled={!onPress || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceRaised : "transparent",
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceRaised }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.rowTexts}>
        <AppText weight="medium">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" muted>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Settings: theme, library (skip short songs, rescan), storage (artwork cache), about. */
export default function SettingsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const mode = useThemeMode();
  const minSongSeconds = useSettings((s) => s.minSongSeconds);
  const libraryStatus = useLibrary((s) => s.status);
  const songCount = useLibrary((s) => s.songs.length);

  const [scanning, setScanning] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const canScan = libraryStatus === "ready" || libraryStatus === "error";

  const rescan = async (reason: string) => {
    if (scanning) return;
    setScanning(true);
    if (__DEV__) console.log(`[settings] rescan (${reason})`);
    const count = await rescanLibrary();
    setScanning(false);
    showToast(
      count === null
        ? "Could not scan the library"
        : count === 1
          ? "Found 1 song"
          : `Found ${count} songs`,
    );
  };

  const pickMinSong = (value: MinSongSeconds) => {
    if (value === minSongSeconds) return;
    setMinSongSeconds(value);
    if (canScan) rescan("skip short songs changed");
  };

  const onClearCache = async () => {
    setConfirmClear(false);
    try {
      const count = await clearArtworkCache();
      showToast(
        count === 1 ? "Cleared 1 picture" : `Cleared ${count} pictures`,
      );
    } catch (e) {
      if (__DEV__)
        console.log(`[settings] clear artwork failed — ${String(e)}`);
      showToast("Could not clear the pictures");
    }
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title="Settings" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Section title="Appearance">
          <Row
            icon={mode === "light" ? "sunny" : "moon"}
            iconColor={colors.purple}
            title="Light theme"
            subtitle={mode === "light" ? "On" : "Off — dark theme"}
            onPress={() => setThemeMode(mode === "light" ? "dark" : "light")}
            right={
              <Switch
                value={mode === "light"}
                onValueChange={(on) => setThemeMode(on ? "light" : "dark")}
                trackColor={{
                  false: colors.surfaceRaised,
                  true: colors.violet,
                }}
                thumbColor={colors.white}
              />
            }
          />
        </Section>

        <Section title="Library">
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <View
                style={[
                  styles.rowIcon,
                  { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={colors.neonBlue}
                />
              </View>
              <View style={styles.rowTexts}>
                <AppText weight="medium">Skip short songs</AppText>
                <AppText variant="caption" muted>
                  {minSongSeconds === 0
                    ? "Every audio file is shown"
                    : `Hides files shorter than ${minSongSeconds} seconds (voice notes, ringtones)`}
                </AppText>
              </View>
            </View>
            <View style={styles.chips}>
              {MIN_SONG_OPTIONS.map((value) => {
                const selected = value === minSongSeconds;
                return (
                  <Pressable
                    key={value}
                    disabled={scanning}
                    onPress={() => pickMinSong(value)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? colors.purple
                          : colors.surfaceRaised,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      weight={selected ? "semibold" : "medium"}
                      color={selected ? colors.white : undefined}
                    >
                      {value === 0 ? "Off" : `${value} s`}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Row
            icon="refresh"
            iconColor={colors.accent}
            title={scanning ? "Scanning…" : "Rescan library"}
            subtitle={
              canScan
                ? `${songCount === 1 ? "1 song" : `${songCount} songs`} on this phone`
                : "Allow access to your music first (on Home)"
            }
            disabled={!canScan || scanning}
            onPress={() => rescan("button")}
          />
        </Section>

        <Section title="Storage">
          <Row
            icon="images-outline"
            iconColor={colors.cyan}
            title="Clear artwork cache"
            subtitle="Deletes the saved cover pictures. They are made again when needed."
            onPress={() => setConfirmClear(true)}
          />
        </Section>

        <Section title="About">
          <View style={styles.about}>
            <Image source={DISC} style={styles.logo} contentFit="contain" />
            <View style={styles.rowTexts}>
              <AppText weight="semibold">Playtune</AppText>
              <AppText variant="caption" muted>
                Plays the music saved on your phone. No account, no internet
                needed.
              </AppText>
            </View>
          </View>
        </Section>

        <View style={styles.footer}>
          <AppText variant="caption" muted align="center">
            Version {APP_VERSION}
          </AppText>
          <AppText variant="caption" muted align="center">
            Developed with{" "}
            <AppText variant="caption" color={colors.accent}>
              ♥
            </AppText>{" "}
            by {DEVELOPER}
          </AppText>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmClear}
        icon="images-outline"
        title="Clear artwork cache?"
        message="The saved cover pictures are deleted. Your songs and playlists are not touched."
        confirmLabel="Clear"
        destructive={false}
        onCancel={() => setConfirmClear(false)}
        onConfirm={onClearCache}
      />

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    paddingHorizontal: 6,
    letterSpacing: 1,
  },
  card: {
    borderRadius: 20,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTexts: {
    flex: 1,
  },
  block: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  blockHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
    paddingLeft: 48,
  },
  chip: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  about: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  logo: {
    width: 40,
    height: 40,
  },
  footer: {
    gap: 2,
    marginTop: 4,
  },
});
