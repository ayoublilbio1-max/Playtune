import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddToPlaylistSheet } from "../components/AddToPlaylistSheet";
import { AppText } from "../components/AppText";
import { Artwork } from "../components/Artwork";
import { MINI_PLAYER_SPACE, MiniPlayer } from "../components/MiniPlayer";
import { PlayingBars } from "../components/PlayingBars";
import { PromptModal } from "../components/PromptModal";
import { ScreenHeader } from "../components/ScreenHeader";
import { SongListSkeleton } from "../components/SongRowSkeleton";
import { showToast, Toast } from "../components/Toast";
import { playSongs, type EngineSong } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { useHistory } from "../store/history";
import { initLibrary, useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import { addSongsToPlaylist, createPlaylist } from "../store/playlists";

const ROW = 68;

const RankRow = memo(function RankRow({
  song,
  index,
  count,
  active,
  playing,
  onPress,
  onMore,
}: {
  song: EngineSong;
  index: number;
  count: number;
  active: boolean;
  playing: boolean;
  onPress: (index: number) => void;
  onMore: (song: EngineSong) => void;
}) {
  const colors = useTheme();
  const { t } = useT();
  const top3 = index < 3;
  return (
    <Pressable
      onPress={() => onPress(index)}
      onLongPress={() => onMore(song)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: active ? colors.surface : "transparent",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.rank}>
        {active ? (
          <PlayingBars playing={playing} />
        ) : (
          <AppText
            weight="bold"
            size={top3 ? 18 : 15}
            color={top3 ? colors.accent : colors.textMuted}
          >
            {index + 1}
          </AppText>
        )}
      </View>
      <Artwork songId={song.id} size={48} radius={10} />
      <View style={styles.texts}>
        <AppText
          weight="medium"
          numberOfLines={1}
          color={active ? colors.accent : undefined}
        >
          {song.title}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {song.artist?.trim() ? song.artist : t("common.unknownArtist")}
        </AppText>
      </View>
      <View style={[styles.count, { backgroundColor: colors.surfaceRaised }]}>
        <AppText variant="label" weight="semibold" color={colors.purple}>
          {t("most.plays", { count })}
        </AppText>
      </View>
      <Pressable hitSlop={10} onPress={() => onMore(song)} style={styles.more}>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
});

/** ☰ › Most played: songs ranked by how many times they were played (15 s or more counts as a play). */
export default function MostPlayedScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const mostIds = useHistory((s) => s.most);
  const counts = useHistory((s) => s.counts);
  const byId = useLibrary((s) => s.byId);
  const status = useLibrary((s) => s.status);
  const currentId = usePlayer((s) => s.mediaId);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const hasQueue = usePlayer((s) => s.queueLength > 0);

  const [sheetSong, setSheetSong] = useState<EngineSong | null>(null);
  const [newPlaylistFor, setNewPlaylistFor] = useState<EngineSong | null>(null);

  useEffect(() => {
    initLibrary();
  }, []);

  // Hidden or deleted songs are left out.
  const songs = useMemo(
    () => mostIds.map((id) => byId.get(id)).filter((s): s is EngineSong => !!s),
    [mostIds, byId],
  );

  const onPress = useCallback(
    (index: number) => playSongs(songs, index, "most played"),
    [songs],
  );

  const onCreateAndAdd = async (name: string) => {
    const target = newPlaylistFor;
    setNewPlaylistFor(null);
    if (!target) return;
    const id = await createPlaylist(name);
    await addSongsToPlaylist(id, [target.id]);
    showToast(t("toast.addedTo", { name }));
  };

  const loading = status === "checking" || status === "scanning";

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title={t("home.most")} />

      {loading ? (
        <SongListSkeleton />
      ) : (
        <FlashList
          data={songs}
          keyExtractor={(s) => s.id}
          extraData={`${currentId}${isPlaying}`}
          renderItem={({ item, index }) => (
            <RankRow
              song={item}
              index={index}
              count={counts.get(item.id) ?? 0}
              active={item.id === currentId}
              playing={isPlaying}
              onPress={onPress}
              onMore={setSheetSong}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={44} color={colors.purple} />
              <AppText variant="heading" align="center">
                {t("most.emptyTitle")}
              </AppText>
              <AppText muted align="center">
                {t("most.emptyText")}
              </AppText>
            </View>
          }
          contentContainerStyle={{
            paddingBottom: hasQueue ? MINI_PLAYER_SPACE : 32,
          }}
        />
      )}

      <MiniPlayer />

      <AddToPlaylistSheet
        song={sheetSong}
        onClose={() => setSheetSong(null)}
        onNewPlaylist={(s) => {
          setSheetSong(null);
          setNewPlaylistFor(s);
        }}
      />
      <PromptModal
        visible={newPlaylistFor !== null}
        title={t("common.newPlaylist")}
        placeholder={t("common.playlistName")}
        confirmLabel={t("common.create")}
        onSubmit={onCreateAndAdd}
        onCancel={() => setNewPlaylistFor(null)}
      />
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  row: {
    height: ROW,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 12,
    paddingRight: 8,
  },
  rank: {
    width: 28,
    alignItems: "center",
  },
  texts: {
    flex: 1,
  },
  count: {
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
  },
  more: {
    width: 32,
    alignItems: "center",
  },
  empty: {
    alignItems: "center",
    gap: 10,
    marginTop: 80,
    paddingHorizontal: 32,
  },
});
