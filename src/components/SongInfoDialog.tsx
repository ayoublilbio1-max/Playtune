import { Pressable, StyleSheet, View } from "react-native";

import {
    displayAlbum,
    displayArtist,
    formatTime,
    type EngineSong,
} from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
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
  return song.mimeType?.split("/").pop()?.toUpperCase() ?? "Unknown";
}

/** ⋮ → Song info: details read from the phone's music library. */
export function SongInfoDialog({ song, visible, onClose }: Props) {
  const colors = useTheme();
  if (!song) return null;

  const rows: [string, string][] = [
    ["Title", song.title],
    ["Artist", displayArtist(song.artist)],
    ["Album", displayAlbum(song.album)],
    ["Year", song.year ? String(song.year) : "—"],
    ["Duration", formatTime(song.durationMs)],
    ["Format", formatName(song)],
    ["Size", formatSize(song.size)],
    ["File", song.fileName ?? "—"],
    ["Folder", song.path ?? "—"],
  ];

  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <AppText variant="heading" style={styles.title}>
        Song info
      </AppText>
      {rows.map(([label, value]) => (
        <View
          key={label}
          style={[styles.row, { borderBottomColor: colors.border }]}
        >
          <AppText variant="caption" muted style={styles.label}>
            {label}
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
        <AppText weight="semibold">Close</AppText>
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
