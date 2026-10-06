import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { displayArtist, formatTime, type EngineSong } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { AppText } from "./AppText";
import { Artwork } from "./Artwork";

type Props = {
  song: EngineSong;
  index: number;
  active?: boolean;
  onPress: (index: number) => void;
  onLongPress?: (song: EngineSong) => void;
  /** Button on the right: more (⋮), remove (–), check (picker), or nothing. */
  trailing?: "more" | "remove" | "check" | "none";
  checked?: boolean;
  /** Dimmed and not tappable (e.g. already in the playlist). */
  disabled?: boolean;
  onTrailingPress?: (song: EngineSong) => void;
};

export const ROW_HEIGHT = 62;

export const SongRow = memo(function SongRow({
  song,
  index,
  active = false,
  onPress,
  onLongPress,
  trailing = "none",
  checked = false,
  disabled = false,
  onTrailingPress,
}: Props) {
  const colors = useTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onPress(index)}
      onLongPress={onLongPress ? () => onLongPress(song) : undefined}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: active ? colors.surface : "transparent",
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Artwork songId={song.id} size={46} radius={10} />
      <View style={styles.texts}>
        <AppText
          numberOfLines={1}
          weight="medium"
          color={active ? colors.accent : undefined}
        >
          {song.title}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {displayArtist(song.artist)} · {formatTime(song.durationMs)}
        </AppText>
      </View>

      {trailing === "more" ? (
        <Pressable
          hitSlop={10}
          style={styles.trailing}
          onPress={() => onTrailingPress?.(song)}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
      ) : null}
      {trailing === "remove" ? (
        <Pressable
          hitSlop={10}
          style={styles.trailing}
          onPress={() => onTrailingPress?.(song)}
        >
          <Ionicons
            name="remove-circle-outline"
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
      ) : null}
      {trailing === "check" ? (
        <View style={styles.trailing}>
          <Ionicons
            name={checked ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={checked ? colors.accent : colors.textFaint}
          />
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  texts: {
    flex: 1,
  },
  trailing: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
