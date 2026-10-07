import { Pressable, StyleSheet, View } from "react-native";

import {
  displayAlbum,
  displayArtist,
  formatTime,
  type EngineSong,
} from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useT, type TKey } from "../i18n";
import { AppText } from "./AppText";
import { Overlay } from "./Overlay";

type Props = {
  song: EngineSong | null;
  visible: boolean;
  onClose: () => void;
};

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatName(song: EngineSong) {
  const ext = song.fileName?.split(".").pop();
  if (ext && ext !== song.fileName) return ext.toUpperCase();
  return song.mimeType?.split("/").pop()?.toUpperCase() ?? "—";
}

/** ⋮ → Song info: details read from the phone's music library. */
export function SongInfoDialog({ song, visible, onClose }: Props) {
  const colors = useTheme();
  const { t } = useT();
  if (!song) return null;

  const rows: [TKey, string][] = [
    ["info.title", song.title],
    ["info.artist", displayArtist(song.artist)],
    ["info.album", displayAlbum(song.album)],
    ["info.year", song.year ? String(song.year) : "—"],
    ["info.duration", formatTime(song.durationMs)],
    ["info.format", formatName(song)],
    ["info.size", formatSize(song.size)],
    ["info.file", song.fileName ?? "—"],
    ["info.folder", song.path ?? "—"],
  ];

  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <AppText variant="heading" style={styles.title}>
        {t("player.songInfo")}
      </AppText>
      {rows.map(([label, value]) => (
        <View
          key={label}
          style={[styles.row, { borderBottomColor: colors.border }]}
        >
          <AppText variant="caption" muted style={styles.label}>
            {t(label)}
          </AppText>
          <AppText variant="caption" style={styles.value} selectable>
            {value}
          </AppText>
        </View>
      ))}
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [
          styles.close,
          { backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <AppText weight="semibold">{t("common.close")}</AppText>
      </Pressable>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    width: 72,
  },
  value: {
    flex: 1,
  },
  close: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
