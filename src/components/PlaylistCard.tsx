import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useId } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { usePlaylistCover } from "../hooks/use-artwork";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { AppText } from "./AppText";
import { ArtworkPlaceholder } from "./ArtworkPlaceholder";

export const CARD_WIDTH = 148;
export const CARD_HEIGHT = 184;
const SHADE_HEIGHT = 96;

type Props = {
  id: number;
  name: string;
  /** Songs that still exist on the phone, in playlist order. */
  songIds: string[];
  /** The built-in "Liked songs" (heart placeholder). */
  liked?: boolean;
  onOpen: (id: number) => void;
  onPlay: (id: number) => void;
};

/** Playlist card: cover (first song with artwork, or the gradient placeholder), name, count, play button. */
export const PlaylistCard = memo(function PlaylistCard({
  id,
  name,
  songIds,
  liked = false,
  onOpen,
  onPlay,
}: Props) {
  const colors = useTheme();
  const { t, tn } = useT();
  const cover = usePlaylistCover(songIds, 400);
  const shadeId = `shade${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const count = songIds.length;

  return (
    <Pressable
      onPress={() => onOpen(id)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <ArtworkPlaceholder
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          iconScale={0.3}
          icon={liked ? "heart" : "musical-note"}
          style={StyleSheet.absoluteFill}
        />
      )}

      <Svg width={CARD_WIDTH} height={SHADE_HEIGHT} style={styles.shade}>
        <Defs>
          <LinearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0A0014" stopOpacity="0" />
            <Stop offset="1" stopColor="#0A0014" stopOpacity="0.88" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={CARD_WIDTH}
          height={SHADE_HEIGHT}
          fill={`url(#${shadeId})`}
        />
      </Svg>

      <View style={styles.info}>
        <View style={styles.texts}>
          <AppText
            weight="semibold"
            size={15}
            numberOfLines={1}
            color={colors.white}
          >
            {liked ? t("common.likedSongs") : name}
          </AppText>
          <AppText variant="caption" numberOfLines={1} color={colors.glowPink}>
            {tn("songs", count)}
          </AppText>
        </View>
        {count > 0 ? (
          <Pressable
            hitSlop={8}
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
      </View>
    </Pressable>
  );
});

/** First card of the row: create a playlist. */
export function NewPlaylistCard({ onPress }: { onPress: () => void }) {
  const colors = useTheme();
  const { t } = useT();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.newCard,
        {
          borderColor: colors.accent,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.plus, { backgroundColor: colors.accent }]}>
        <Ionicons name="add" size={28} color={colors.white} />
      </View>
      <AppText weight="semibold" align="center">
        {t("common.newPlaylist")}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 22,
    overflow: "hidden",
  },
  shade: {
    position: "absolute",
    left: 0,
    bottom: 0,
  },
  info: {
    position: "absolute",
    left: 12,
    right: 10,
    bottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
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
  newCard: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  plus: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
