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
import { IconButton } from "../../components/IconButton";
import { MINI_PLAYER_SPACE, MiniPlayer } from "../../components/MiniPlayer";
import { Overlay } from "../../components/Overlay";
import { PromptModal } from "../../components/PromptModal";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SongRow } from "../../components/SongRow";
import { SongListSkeleton } from "../../components/SongRowSkeleton";
import { showToast, Toast } from "../../components/Toast";
import {
    formatTotalDuration,
    playSongs,
    type EngineSong,
} from "../../engine/engine";
import { usePlaylistCover } from "../../hooks/use-artwork";
import { useTheme } from "../../hooks/use-theme";
import { initLibrary, useLibrary } from "../../store/library";
import { usePlayer } from "../../store/player";
import {
    deletePlaylist,
    loadPlaylists,
    removeSongFromPlaylist,
    renamePlaylist,
    usePlaylists,
} from "../../store/playlists";

const COVER_SIZE = 200;

export default function PlaylistScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const loaded = usePlaylists((s) => s.loaded);
  const playlist = usePlaylists((s) => s.playlists.find((p) => p.id === id));
  const byId = useLibrary((s) => s.byId);
  const libraryStatus = useLibrary((s) => s.status);
  const currentId = usePlayer((s) => s.mediaId);
  const hasQueue = usePlayer((s) => s.queueLength > 0);

  const [menuOpen, setMenuOpen] = useState(false);
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
            This playlist doesn't exist anymore.
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
        <ArtworkPlaceholder width={COVER_SIZE} radius={24} iconScale={0.36} />
      )}
      <AppText
        variant="title"
        align="center"
        numberOfLines={2}
        style={styles.name}
      >
        {playlist?.name ?? ""}
      </AppText>
      <AppText variant="caption" muted align="center">
        {songs.length === 1 ? "1 song" : `${songs.length} songs`}
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
            Play
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
          <AppText weight="semibold">Add songs</AppText>
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
        right={
          playlist ? (
            <IconButton
              name="ellipsis-vertical"
              size={20}
              accessibilityLabel="Playlist options"
              onPress={() => setMenuOpen(true)}
            />
          ) : null
        }
      />

      {!loaded ||
      libraryStatus === "checking" ||
      libraryStatus === "scanning" ? (
        <SongListSkeleton />
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
              No songs yet. Tap “Add songs” to fill this playlist.
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
          <AppText>Rename playlist</AppText>
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
          <AppText color={colors.danger}>Delete playlist</AppText>
        </Pressable>
      </Overlay>

      <PromptModal
        visible={renameOpen}
        title="Rename playlist"
        initialValue={playlist?.name ?? ""}
        confirmLabel="Save"
        onCancel={() => setRenameOpen(false)}
        onSubmit={(name) => {
          setRenameOpen(false);
          renamePlaylist(id, name);
        }}
      />

      <ConfirmModal
        visible={confirmDelete}
        title="Delete playlist?"
        message={`"${playlist?.name ?? ""}" will be deleted. Your songs stay on the phone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          const name = playlist?.name ?? "";
          router.back();
          deletePlaylist(id).then(() => showToast(`Deleted ${name}`));
        }}
      />

      <ConfirmModal
        visible={removeSong !== null}
        icon="remove-circle-outline"
        title="Remove from playlist?"
        message={
          removeSong ? `"${removeSong.title}" stays on your phone.` : undefined
        }
        confirmLabel="Remove"
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
