import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../../components/AppText";
import { ArtworkPlaceholder } from "../../components/ArtworkPlaceholder";
import { ConfirmModal } from "../../components/ConfirmModal";
import { DraggableList } from "../../components/DraggableList";
import { IconButton } from "../../components/IconButton";
import { MINI_PLAYER_SPACE, MiniPlayer } from "../../components/MiniPlayer";
import { Overlay } from "../../components/Overlay";
import { PromptModal } from "../../components/PromptModal";
import { ReorderSongRow } from "../../components/ReorderSongRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ROW_HEIGHT, SongRow } from "../../components/SongRow";
import { SongListSkeleton } from "../../components/SongRowSkeleton";
import { showToast, Toast } from "../../components/Toast";
import {
  formatTotalDuration,
  playSongs,
  type EngineSong,
} from "../../engine/engine";
import { usePlaylistCover } from "../../hooks/use-artwork";
import { useTheme } from "../../hooks/use-theme";
import { useT } from "../../i18n";
import { initLibrary, useLibrary } from "../../store/library";
import { usePlayer } from "../../store/player";
import {
  deletePlaylist,
  loadPlaylists,
  playlistName,
  removeSongFromPlaylist,
  renamePlaylist,
  reorderPlaylist,
  usePlaylists,
} from "../../store/playlists";

const COVER_SIZE = 200;

export default function PlaylistScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t, tn } = useT();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const loaded = usePlaylists((s) => s.loaded);
  const playlist = usePlaylists((s) => s.playlists.find((p) => p.id === id));
  const byId = useLibrary((s) => s.byId);
  const libraryStatus = useLibrary((s) => s.status);
  const currentId = usePlayer((s) => s.mediaId);
  const hasQueue = usePlayer((s) => s.queueLength > 0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeSong, setRemoveSong] = useState<EngineSong | null>(null);

  useEffect(() => {
    // Normally already loaded by Home; needed if this screen is opened first.
    if (!loaded) loadPlaylists();
    initLibrary();
  }, [loaded]);

  const songs = useMemo(
    () =>
      playlist
        ? playlist.songIds
            .map((sid) => byId.get(sid))
            .filter((s): s is EngineSong => !!s)
        : [],
    [playlist, byId],
  );
  const songIds = useMemo(() => songs.map((s) => s.id), [songs]);
  const totalMs = useMemo(
    () => songs.reduce((sum, s) => sum + s.durationMs, 0),
    [songs],
  );
  const cover = usePlaylistCover(songIds, 600);

  const onPressSong = useCallback(
    (index: number) => {
      playSongs(songs, index, `playlist #${id}`);
    },
    [songs, id],
  );

  const goAddSongs = () => {
    router.push({
      pathname: "/playlist/add-songs",
      params: { id: String(id) },
    });
  };

  if (loaded && !playlist) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ScreenHeader />
        <View style={styles.center}>
          <AppText muted align="center">
            {t("playlist.gone")}
          </AppText>
        </View>
      </View>
    );
  }

  const header = (
    <View style={styles.hero}>
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={styles.cover}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <ArtworkPlaceholder
          width={COVER_SIZE}
          radius={24}
          iconScale={0.36}
          icon={playlist?.kind === "liked" ? "heart" : "musical-note"}
        />
      )}
      <AppText
        variant="title"
        align="center"
        numberOfLines={2}
        style={styles.name}
      >
        {playlist ? playlistName(playlist) : ""}
      </AppText>
      <AppText variant="caption" muted align="center">
        {tn("songs", songs.length)}
        {songs.length > 0 ? ` · ${formatTotalDuration(totalMs)}` : ""}
      </AppText>

      <View style={styles.actions}>
        <Pressable
          disabled={songs.length === 0}
          onPress={() => onPressSong(0)}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: colors.accent,
              opacity: songs.length === 0 ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="play" size={18} color={colors.white} />
          <AppText weight="semibold" color={colors.white}>
            {t("common.play")}
          </AppText>
        </Pressable>
        <Pressable
          onPress={goAddSongs}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={20} color={colors.textPrimary} />
          <AppText weight="semibold">{t("playlist.addSongs")}</AppText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader
        title={reordering ? t("reorder.title") : undefined}
        right={
          reordering ? (
            <Pressable
              hitSlop={8}
              onPress={() => setReordering(false)}
              style={styles.done}
            >
              <AppText weight="semibold" color={colors.accent}>
                {t("common.done")}
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.headerRight}>
              {songs.length > 1 ? (
                <IconButton
                  name="swap-vertical"
                  size={22}
                  accessibilityLabel={t("reorder.title")}
                  onPress={() => setReordering(true)}
                />
              ) : null}
              {playlist && playlist.kind !== "liked" ? (
                <IconButton
                  name="ellipsis-vertical"
                  size={20}
                  accessibilityLabel="Playlist options"
                  onPress={() => setMenuOpen(true)}
                />
              ) : null}
            </View>
          )
        }
      />

      {!loaded ||
      libraryStatus === "checking" ||
      libraryStatus === "scanning" ? (
        <SongListSkeleton />
      ) : reordering ? (
        <DraggableList
          data={songs}
          keyOf={(s) => s.id}
          rowHeight={ROW_HEIGHT}
          onMove={(from, to) => {
            const next = songs.map((s) => s.id);
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            if (__DEV__) console.log(`[playlist] #${id}: drag ${from} → ${to}`);
            reorderPlaylist(id, next);
          }}
          header={
            <AppText variant="caption" muted style={styles.hint}>
              {t("reorder.hint")}
            </AppText>
          }
          footerSpace={hasQueue ? MINI_PLAYER_SPACE : 32}
          renderItem={(s) => (
            <ReorderSongRow song={s} active={s.id === currentId} />
          )}
        />
      ) : (
        <FlashList
          data={songs}
          keyExtractor={(s) => s.id}
          extraData={currentId}
          renderItem={({ item, index }) => (
            <SongRow
              song={item}
              index={index}
              active={item.id === currentId}
              onPress={onPressSong}
              trailing="remove"
              onTrailingPress={setRemoveSong}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <AppText muted align="center" style={styles.empty}>
              {t("playlist.empty")}
            </AppText>
          }
          contentContainerStyle={{
            paddingBottom: hasQueue ? MINI_PLAYER_SPACE : 32,
          }}
        />
      )}

      <MiniPlayer />

      {/* Options */}
      <Overlay visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <AppText variant="heading" numberOfLines={1} style={styles.menuTitle}>
          {playlist?.name}
        </AppText>
        <Pressable
          style={({ pressed }) => [
            styles.menuRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => {
            setMenuOpen(false);
            setRenameOpen(true);
          }}
        >
          <Ionicons
            name="create-outline"
            size={22}
            color={colors.textPrimary}
          />
          <AppText>{t("playlist.rename")}</AppText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.menuRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => {
            setMenuOpen(false);
            setConfirmDelete(true);
          }}
        >
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
          <AppText color={colors.danger}>{t("playlist.delete")}</AppText>
        </Pressable>
      </Overlay>

      <PromptModal
        visible={renameOpen}
        title={t("playlist.rename")}
        initialValue={playlist?.name ?? ""}
        onCancel={() => setRenameOpen(false)}
        onSubmit={(name) => {
          setRenameOpen(false);
          renamePlaylist(id, name);
        }}
      />

      <ConfirmModal
        visible={confirmDelete}
        title={t("playlist.deleteTitle")}
        message={t("playlist.deleteText", { name: playlist?.name ?? "" })}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          const name = playlist?.name ?? "";
          router.back();
          deletePlaylist(id).then(() =>
            showToast(t("toast.deleted", { name })),
          );
        }}
      />

      <ConfirmModal
        visible={removeSong !== null}
        icon="remove-circle-outline"
        title={t("playlist.removeTitle")}
        message={
          removeSong
            ? t("playlist.removeText", { title: removeSong.title })
            : undefined
        }
        confirmLabel={t("common.remove")}
        onCancel={() => setRemoveSong(null)}
        onConfirm={() => {
          const song = removeSong;
          setRemoveSong(null);
          if (song) removeSongFromPlaylist(id, song.id);
        }}
      />

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 24,
  },
  name: {
    marginTop: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  empty: {
    marginTop: 24,
    paddingHorizontal: 32,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  done: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hint: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  menuTitle: {
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
});
