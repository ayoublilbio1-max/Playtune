import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { ConfirmModal } from "../components/ConfirmModal";
import { Overlay } from "../components/Overlay";
import { ScreenHeader } from "../components/ScreenHeader";
import { showToast, Toast } from "../components/Toast";
import { APP_VERSION, DEVELOPER } from "../constants/app";
import { applyPauseOnDetach, canChangePauseOnDetach } from "../engine/engine";
import { clearArtworkCache } from "../hooks/use-artwork";
import { useTheme } from "../hooks/use-theme";
import { t as tNow, useT } from "../i18n";
import { LANGUAGES, setLanguage } from "../store/language";
import { rescanLibrary, useLibrary } from "../store/library";
import {
  MIN_SONG_OPTIONS,
  setMinSongSeconds,
  setPauseOnDetach,
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

function Divider() {
  const colors = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function Row({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
  disabled,
  chevron,
}: {
  icon: ReactNode;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Shows › (opens another screen). */
  chevron?: boolean;
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
        {typeof icon === "string" ? (
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={iconColor}
          />
        ) : (
          icon
        )}
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
      {chevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      ) : null}
    </Pressable>
  );
}

/**
 * Settings: appearance (theme, language), playback (pause on detach), library (skip short songs, rescan,
 * hide music, transfer), storage, help (feedback, terms) and about.
 */
export default function SettingsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t, tn, language } = useT();
  const mode = useThemeMode();
  const minSongSeconds = useSettings((s) => s.minSongSeconds);
  const pauseOnDetach = useSettings((s) => s.pauseOnDetach);
  const libraryStatus = useLibrary((s) => s.status);
  const songCount = useLibrary((s) => s.songs.length);
  const hiddenCount = useLibrary((s) => s.hidden.size);

  const [scanning, setScanning] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const canScan = libraryStatus === "ready" || libraryStatus === "error";
  const detachLive = canChangePauseOnDetach();
  const currentLanguage =
    LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  const rescan = async (reason: string) => {
    if (scanning) return;
    setScanning(true);
    if (__DEV__) console.log(`[settings] rescan (${reason})`);
    const count = await rescanLibrary();
    setScanning(false);
    showToast(
      count === null ? tNow("toast.scanFailed") : tn("toast.found", count),
    );
  };

  const pickMinSong = (value: MinSongSeconds) => {
    if (value === minSongSeconds) return;
    setMinSongSeconds(value);
    if (canScan) rescan("skip short songs changed");
  };

  const onPauseOnDetach = async (value: boolean) => {
    setPauseOnDetach(value);
    const applied = await applyPauseOnDetach(value);
    if (!applied && !value) showToast(tNow("toast.nextUpdate"));
  };

  const onClearCache = async () => {
    setConfirmClear(false);
    try {
      const count = await clearArtworkCache();
      showToast(tn("toast.clearedPictures", count));
    } catch (e) {
      if (__DEV__)
        console.log(`[settings] clear artwork failed — ${String(e)}`);
      showToast(tNow("toast.clearFailed"));
    }
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title={t("menu.settings")} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Section title={t("settings.appearance")}>
          <Row
            icon={mode === "light" ? "sunny" : "moon"}
            iconColor={colors.purple}
            title={t("settings.lightTheme")}
            subtitle={
              mode === "light" ? t("settings.on") : t("settings.darkOn")
            }
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
          <Divider />
          <Row
            icon="language"
            iconColor={colors.cyan}
            title={t("settings.language")}
            subtitle={currentLanguage.name}
            chevron
            onPress={() => setLanguageOpen(true)}
          />
        </Section>

        <Section title={t("settings.playback")}>
          <Row
            icon="headset"
            iconColor={colors.accent}
            title={t("settings.pauseOnDetach")}
            subtitle={
              !pauseOnDetach && !detachLive
                ? t("settings.pauseOnDetachLater")
                : t("settings.pauseOnDetachHint")
            }
            onPress={() => onPauseOnDetach(!pauseOnDetach)}
            right={
              <Switch
                value={pauseOnDetach}
                onValueChange={onPauseOnDetach}
                trackColor={{
                  false: colors.surfaceRaised,
                  true: colors.violet,
                }}
                thumbColor={colors.white}
              />
            }
          />
        </Section>

        <Section title={t("settings.library")}>
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
                <AppText weight="medium">{t("settings.skipShort")}</AppText>
                <AppText variant="caption" muted>
                  {minSongSeconds === 0
                    ? t("settings.skipShortOff")
                    : t("settings.skipShortOn", { seconds: minSongSeconds })}
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
                      {value === 0 ? t("settings.off") : `${value} s`}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Divider />
          <Row
            icon="refresh"
            iconColor={colors.accent}
            title={scanning ? t("settings.scanning") : t("settings.rescan")}
            subtitle={
              canScan
                ? t("settings.onPhone", { songs: tn("songs", songCount) })
                : t("settings.allowFirst")
            }
            disabled={!canScan || scanning}
            onPress={() => rescan("button")}
          />
          <Divider />
          <Row
            icon="eye-off-outline"
            iconColor={colors.pink}
            title={t("settings.hideMusic")}
            subtitle={
              hiddenCount > 0
                ? tn("settings.hiddenCount", hiddenCount)
                : t("settings.hideMusicHint")
            }
            chevron
            onPress={() => router.push("/hide-music")}
          />
          <Divider />
          <Row
            icon={
              <MaterialCommunityIcons
                name="cellphone-arrow-down"
                size={20}
                color={colors.violet}
              />
            }
            title={t("settings.transfer")}
            subtitle={t("settings.transferHint")}
            chevron
            onPress={() => router.push("/transfer")}
          />
        </Section>

        <Section title={t("settings.storage")}>
          <Row
            icon="images-outline"
            iconColor={colors.cyan}
            title={t("settings.clearCache")}
            subtitle={t("settings.clearCacheHint")}
            onPress={() => setConfirmClear(true)}
          />
        </Section>

        <Section title={t("settings.help")}>
          <Row
            icon="chatbubble-ellipses-outline"
            iconColor={colors.accent}
            title={t("settings.feedback")}
            subtitle={t("settings.feedbackHint")}
            chevron
            onPress={() => setFeedbackOpen(true)}
          />
          <Divider />
          <Row
            icon="document-text-outline"
            iconColor={colors.textMuted}
            title={t("settings.terms")}
            chevron
            onPress={() => router.push("/terms")}
          />
        </Section>

        <Section title={t("settings.about")}>
          <View style={styles.about}>
            <Image source={DISC} style={styles.logo} contentFit="contain" />
            <View style={styles.rowTexts}>
              <AppText weight="semibold">Playtune</AppText>
              <AppText variant="caption" muted>
                {t("settings.aboutText")}
              </AppText>
            </View>
          </View>
        </Section>

        <View style={styles.footer}>
          <AppText variant="caption" muted align="center">
            {t("settings.version", { version: APP_VERSION })}
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

      {/* Language */}
      <Overlay visible={languageOpen} onClose={() => setLanguageOpen(false)}>
        <AppText variant="heading" style={styles.sheetTitle}>
          {t("settings.language")}
        </AppText>
        {LANGUAGES.map((l) => {
          const selected = l.code === language;
          return (
            <Pressable
              key={l.code}
              onPress={() => {
                setLanguageOpen(false);
                setLanguage(l.code);
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected
                    ? colors.surfaceRaised
                    : "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={styles.rowTexts}>
                <AppText
                  weight={selected ? "semibold" : "regular"}
                  color={selected ? colors.accent : undefined}
                >
                  {l.name}
                </AppText>
                <AppText variant="label" muted>
                  {l.english}
                </AppText>
              </View>
              <Ionicons
                name={selected ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={selected ? colors.accent : colors.textFaint}
              />
            </Pressable>
          );
        })}
      </Overlay>

      {/* Feedback */}
      <Overlay
        visible={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        placement="center"
      >
        <View style={styles.feedback}>
          <View
            style={[
              styles.feedbackIcon,
              { backgroundColor: colors.surfaceRaised },
            ]}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={26}
              color={colors.accent}
            />
          </View>
          <AppText variant="heading" align="center">
            {t("feedback.title")}
          </AppText>
          <AppText muted align="center">
            {t("feedback.text", { developer: DEVELOPER })}
          </AppText>
          <View
            style={[
              styles.infoBox,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <AppText variant="label" muted>
              {t("feedback.include")}
            </AppText>
            <AppText variant="caption" selectable>
              Playtune {APP_VERSION} · Android API {String(Platform.Version)}
            </AppText>
          </View>
          <Pressable
            onPress={() => setFeedbackOpen(false)}
            style={({ pressed }) => [
              styles.feedbackButton,
              { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <AppText weight="semibold" color={colors.white}>
              {t("common.ok")}
            </AppText>
          </Pressable>
        </View>
      </Overlay>

      <ConfirmModal
        visible={confirmClear}
        icon="images-outline"
        title={t("settings.clearTitle")}
        message={t("settings.clearText")}
        confirmLabel={t("settings.clear")}
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
  sheetTitle: {
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  feedback: {
    alignItems: "center",
    gap: 8,
  },
  feedbackIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  infoBox: {
    alignSelf: "stretch",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 2,
    marginTop: 6,
  },
  feedbackButton: {
    marginTop: 12,
    alignSelf: "stretch",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
