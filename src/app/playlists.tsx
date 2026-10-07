import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { ConfirmModal } from "../components/ConfirmModal";
import { IconButton } from "../components/IconButton";
import { MINI_PLAYER_SPACE, MiniPlayer } from "../components/MiniPlayer";
import { Overlay } from "../components/Overlay";
import { PlaylistListRow } from "../components/PlaylistListRow";
import { PromptModal } from "../components/PromptModal";
import { ScreenHeader } from "../components/ScreenHeader";
import { SongListSkeleton } from "../components/SongRowSkeleton";
import { showToast, Toast } from "../components/Toast";
import {
    formatTotalDuration,
    playSongs,
    type EngineSong,
} from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { initLibrary, useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import {
    createPlaylist,
    deletePlaylist,
    loadPlaylists,
    renamePlaylist,
    usePlaylists,
} from "../store/playlists";

type Row = {
  id: number;
  name: string;
  liked: boolean;
  songIds: string[];
  subtitle: string;
};

/** All playlists: Liked songs pinned first, then the user's playlists. Create, rename, delete, play. */
export default function PlaylistsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const loaded = usePlaylists((s) => s.loaded);
  const playlists = usePlaylists((s) => s.playlists);
  const byId = useLibrary((s) => s.byId);
  const libraryStatus = useLibrary((s) => s.status);
  const hasQueue = usePlayer((s) => s.queueLength > 0);

  const [createOpen, setCreateOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [renameFor, setRenameFor] = useState<number | null>(null);
  const [deleteFor, setDeleteFor] = useState<number | null>(null);

  useEffect(() => {
    if (!loaded) loadPlaylists();
    initLibrary();
  }, [loaded]);

  const rows = useMemo<Row[]>(() => {
    const liked = playlists.filter((p) => p.kind === "liked");
    const user = playlists.filter((p) => p.kind !== "liked");
    return [...liked, ...user].map((p) => {
      // Songs deleted from the phone are not counted or shown.
      const songIds = p.songIds.filter((id) => byId.has(id));
      const totalMs = songIds.reduce(
        (sum, id) => sum + (byId.get(id)?.durationMs ?? 0),
        0,
      );
      const count = songIds.length === 1 ? "1 song" : `${songIds.length} songs`;
      return {
        id: p.id,
        name: p.name,
        liked: p.kind === "liked",
        songIds,
        subtitle:
          songIds.length > 0
            ? `${count} · ${formatTotalDuration(totalMs)}`
            : count,
      };
    });
  }, [playlists, byId]);

  const userCount = rows.filter((r) => !r.liked).length;
  const nameOf = (id: number | null) =>
    rows.find((r) => r.id === id)?.name ?? "";

  const openPlaylist = useCallback((id: number) => {
    router.push({ pathname: "/playlist/[id]", params: { id: String(id) } });
  }, []);

  const playPlaylist = useCallback(
    (id: number) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      const songs = row.songIds
        .map((sid) => byId.get(sid))
        .filter((s): s is EngineSong => !!s);
      playSongs(songs, 0, `playlist #${id}`);
    },
    [rows, byId],
  );

  const onCreate = async (name: string) => {
    setCreateOpen(false);
    const id = await createPlaylist(name);
    showToast(`Created ${name}`);
    openPlaylist(id);
  };

  const loading =
    !loaded || libraryStatus === "checking" || libraryStatus === "scanning";

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader
        title="Playlists"
        right={
          <IconButton
            name="add"
            size={26}
            accessibilityLabel="New playlist"
            onPress={() => setCreateOpen(true)}
          />
        }
      />

      {loading ? (
        <SongListSkeleton rows={6} />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => (
            <PlaylistListRow
              id={item.id}
              name={item.name}
              songIds={item.songIds}
              subtitle={item.subtitle}
              liked={item.liked}
              onOpen={openPlaylist}
              onPlay={playPlaylist}
              onMore={item.liked ? undefined : setMenuFor}
            />
          )}
          ListHeaderComponent={
            <AppText variant="caption" muted style={styles.count}>
              {userCount === 1 ? "1 playlist" : `${userCount} playlists`} +
              Liked songs
            </AppText>
          }
          ListFooterComponent={
            userCount === 0 ? (
              <Pressable
                onPress={() => setCreateOpen(true)}
                style={({ pressed }) => [
                  styles.newBox,
                  {
                    borderColor: colors.accent,
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="add-circle" size={28} color={colors.accent} />
                <AppText weight="semibold">Create your first playlist</AppText>
              </Pressable>
            ) : null
          }
          contentContainerStyle={{
            paddingBottom: hasQueue ? MINI_PLAYER_SPACE : 32,
          }}
        />
      )}

      <MiniPlayer />

      {/* ⋮ options */}
      <Overlay visible={menuFor !== null} onClose={() => setMenuFor(null)}>
        <AppText variant="heading" numberOfLines={1} style={styles.menuTitle}>
          {nameOf(menuFor)}
        </AppText>
        <Pressable
          style={({ pressed }) => [
            styles.menuRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => {
            setRenameFor(menuFor);
            setMenuFor(null);
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
            setDeleteFor(menuFor);
            setMenuFor(null);
          }}
        >
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
          <AppText color={colors.danger}>Delete playlist</AppText>
        </Pressable>
      </Overlay>

      <PromptModal
        visible={createOpen}
        title="New playlist"
        placeholder="Playlist name"
        confirmLabel="Create"
        onSubmit={onCreate}
        onCancel={() => setCreateOpen(false)}
      />

      <PromptModal
        visible={renameFor !== null}
        title="Rename playlist"
        initialValue={nameOf(renameFor)}
        confirmLabel="Save"
        onCancel={() => setRenameFor(null)}
        onSubmit={(name) => {
          const id = renameFor;
          setRenameFor(null);
          if (id !== null) renamePlaylist(id, name);
        }}
      />

      <ConfirmModal
        visible={deleteFor !== null}
        title="Delete playlist?"
        message={`"${nameOf(deleteFor)}" will be deleted. Your songs stay on the phone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteFor(null)}
        onConfirm={() => {
          const id = deleteFor;
          const name = nameOf(id);
          setDeleteFor(null);
          if (id !== null)
            deletePlaylist(id).then(() => showToast(`Deleted ${name}`));
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
  count: {
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  newBox: {
    marginHorizontal: 20,
    marginTop: 14,
    height: 76,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
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
