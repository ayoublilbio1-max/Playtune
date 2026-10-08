import { memo, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { playSongs, type EngineSong } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { useHistory } from "../store/history";
import { useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import { AppText } from "./AppText";
import { Artwork } from "./Artwork";
import { PlayingBars } from "./PlayingBars";

const CARD = 128;

const SongCard = memo(function SongCard({
  song,
  index,
  list,
  source,
  active,
  playing,
  badge,
}: {
  song: EngineSong;
  index: number;
  list: EngineSong[];
  source: string;
  active: boolean;
  playing: boolean;
  badge?: string;
}) {
  const colors = useTheme();
  const { t } = useT();
  return (
    <Pressable
      onPress={() => playSongs(list, index, source)}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View>
        <Artwork songId={song.id} size={CARD} radius={20} loadSize={256} />
        {active ? (
          <View style={[styles.playing, { backgroundColor: colors.overlay }]}>
            <PlayingBars playing={playing} color={colors.white} height={18} />
          </View>
        ) : null}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <AppText variant="label" weight="bold" color={colors.white}>
              {badge}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText
        weight="semibold"
        numberOfLines={1}
        color={active ? colors.accent : undefined}
        style={styles.title}
      >
        {song.title}
      </AppText>
      <AppText variant="caption" muted numberOfLines={1}>
        {song.artist?.trim() ? song.artist : t("common.unknownArtist")}
      </AppText>
    </Pressable>
  );
});

function Row({
  title,
  songs,
  source,
  counts,
}: {
  title: string;
  songs: EngineSong[];
  source: string;
  counts?: Map<string, number>;
}) {
  const currentId = usePlayer((s) => s.mediaId);
  const isPlaying = usePlayer((s) => s.isPlaying);
  if (songs.length === 0) return null;
  return (
    <View style={styles.row}>
      <AppText variant="heading" style={styles.heading}>
        {title}
      </AppText>
      <FlatList
        horizontal
        data={songs}
        keyExtractor={(s) => s.id}
        extraData={`${currentId}${isPlaying}`}
        renderItem={({ item, index }) => (
          <SongCard
            song={item}
            index={index}
            list={songs}
            source={source}
            active={item.id === currentId}
            playing={isPlaying}
            badge={counts ? `${counts.get(item.id) ?? 0}×` : undefined}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

/** Home: "Recently played" and "Most played" rows (hidden until something was played for 15 s). */
export function HistoryRows() {
  const { t } = useT();
  const recentIds = useHistory((s) => s.recent);
  const mostIds = useHistory((s) => s.most);
  const counts = useHistory((s) => s.counts);
  const byId = useLibrary((s) => s.byId);

  // Hidden or deleted songs are left out.
  const recent = useMemo(
    () =>
      recentIds
        .map((id) => byId.get(id))
        .filter((s): s is EngineSong => !!s)
        .slice(0, 20),
    [recentIds, byId],
  );
  const most = useMemo(
    () =>
      mostIds
        .map((id) => byId.get(id))
        .filter((s): s is EngineSong => !!s)
        .slice(0, 20),
    [mostIds, byId],
  );

  return (
    <>
      <Row title={t("home.recent")} songs={recent} source="recently played" />
      <Row
        title={t("home.most")}
        songs={most}
        source="most played"
        counts={counts}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingBottom: 18,
  },
  heading: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: CARD,
  },
  title: {
    marginTop: 8,
  },
  playing: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
  },
});
