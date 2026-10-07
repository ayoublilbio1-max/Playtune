import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { usePlaylistCover } from "../hooks/use-artwork";
import { useTheme } from "../hooks/use-theme";
import { AppText } from "./AppText";
import { ArtworkPlaceholder } from "./ArtworkPlaceholder";
import { IconButton } from "./IconButton";

export const PLAYLIST_ROW_HEIGHT = 76;
const COVER = 56;

type Props = {
  id: number;
  name: string;
  /** Songs that still exist on the phone, in playlist order. */
  songIds: string[];
  /** "12 songs · 48 min" */
  subtitle: string;
  liked?: boolean;
  onOpen: (id: number) => void;
  onPlay: (id: number) => void;
  /** ⋮ (rename / delete). Not shown for Liked songs. */
  onMore?: (id: number) => void;
};

/** One playlist in the Playlists screen: cover, name, count, ▶ and ⋮. */
export const PlaylistListRow = memo(function PlaylistListRow({
  id,
  name,
  songIds,
  subtitle,
  liked = false,
  onOpen,
  onPlay,
  onMore,
}: Props) {
  const colors = useTheme();
  const cover = usePlaylistCover(songIds, 200);

  return (
    <Pressable
      onPress={() => onOpen(id)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surface : "transparent" },
      ]}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={styles.cover}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <ArtworkPlaceholder
          width={COVER}
          radius={14}
          iconScale={0.4}
          icon={liked ? "heart" : "musical-note"}
        />
      )}

      <View style={styles.texts}>
        <AppText weight="semibold" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>

      {songIds.length > 0 ? (
        <Pressable
          hitSlop={8}
          accessibilityLabel={`Play ${name}`}
          onPress={() => onPlay(id)}
          style={({ pressed }) => [
            styles.play,
            { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons
            name="play"
            size={16}
            color={colors.white}
            style={styles.playIcon}
          />
        </Pressable>
      ) : null}

      {onMore ? (
        <IconButton
          name="ellipsis-vertical"
          size={18}
          color={colors.textMuted}
          accessibilityLabel={`${name} options`}
          onPress={() => onMore(id)}
        />
      ) : (
        <View style={styles.moreSpace} />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: PLAYLIST_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 20,
    paddingRight: 8,
  },
  cover: {
    width: COVER,
    height: COVER,
    borderRadius: 14,
  },
  texts: {
    flex: 1,
  },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    marginLeft: 2,
  },
  moreSpace: {
    width: 44,
  },
});
