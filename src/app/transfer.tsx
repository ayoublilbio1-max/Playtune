import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { NotInDemoModal } from "../components/NotInDemoModal";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { useLibrary } from "../store/library";
import { usePlaylists } from "../store/playlists";

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

/**
 * Settings › Transfer music (design only for now): send the library to another phone, or receive one.
 * Send / Receive open the "not in the demo" message.
 */
export default function TransferScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t, tn } = useT();
  const songs = useLibrary((s) => s.songs);
  const playlistCount = usePlaylists(
    (s) => s.playlists.filter((p) => p.kind === "user").length,
  );

  const [withPlaylists, setWithPlaylists] = useState(true);
  const [demoFeature, setDemoFeature] = useState<string | null>(null);

  const totalBytes = songs.reduce((sum, s) => sum + s.size, 0);

  const open = (feature: string) => {
    if (__DEV__) console.log(`[transfer] ${feature} tapped (not in the demo)`);
    setDemoFeature(feature);
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title={t("settings.transfer")} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.hero}>
          <View
            style={[
              styles.phone,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="musical-notes" size={30} color={colors.accent} />
          </View>
          <View style={styles.arrows}>
            <Ionicons name="arrow-forward" size={22} color={colors.cyan} />
            <Ionicons name="arrow-back" size={22} color={colors.purple} />
          </View>
          <View
            style={[
              styles.phone,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={30}
              color={colors.textMuted}
            />
          </View>
        </View>

        <AppText variant="heading" align="center">
          {t("transfer.title")}
        </AppText>
        <AppText muted align="center" style={styles.lead}>
          {t("transfer.lead")}
        </AppText>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <AppText variant="label" muted style={styles.cardTitle}>
            {t("transfer.whatGoes").toUpperCase()}
          </AppText>
          <View style={styles.statRow}>
            <Ionicons name="musical-note" size={20} color={colors.accent} />
            <AppText style={styles.flex}>{tn("songs", songs.length)}</AppText>
            <AppText muted>{formatBytes(totalBytes)}</AppText>
          </View>
          <View style={styles.statRow}>
            <Ionicons name="list" size={20} color={colors.purple} />
            <AppText style={styles.flex}>
              {tn("playlists", playlistCount)}
            </AppText>
            <Switch
              value={withPlaylists}
              onValueChange={setWithPlaylists}
              trackColor={{ false: colors.surfaceRaised, true: colors.violet }}
              thumbColor={colors.white}
            />
          </View>
          <AppText variant="caption" muted>
            {t("transfer.note")}
          </AppText>
        </View>

        <Pressable
          onPress={() => open(t("transfer.send"))}
          style={({ pressed }) => [
            styles.big,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="paper-plane" size={22} color={colors.white} />
          <View style={styles.flex}>
            <AppText weight="semibold" color={colors.white}>
              {t("transfer.send")}
            </AppText>
            <AppText variant="caption" color={colors.glowPink}>
              {t("transfer.sendHint")}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.white} />
        </Pressable>

        <Pressable
          onPress={() => open(t("transfer.receive"))}
          style={({ pressed }) => [
            styles.big,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="download-outline" size={22} color={colors.purple} />
          <View style={styles.flex}>
            <AppText weight="semibold">{t("transfer.receive")}</AppText>
            <AppText variant="caption" muted>
              {t("transfer.receiveHint")}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </ScrollView>

      <NotInDemoModal
        visible={demoFeature !== null}
        feature={demoFeature ?? undefined}
        onClose={() => setDemoFeature(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    marginVertical: 18,
  },
  phone: {
    width: 74,
    height: 120,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  arrows: {
    gap: 4,
  },
  lead: {
    marginTop: 6,
    paddingHorizontal: 8,
  },
  card: {
    marginTop: 22,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 32,
  },
  flex: {
    flex: 1,
  },
  big: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 20,
  },
});
