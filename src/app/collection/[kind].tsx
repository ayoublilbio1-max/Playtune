import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    AddToPlaylistSheet,
    queueSongs,
} from "../../components/AddToPlaylistSheet";
import { AppText } from "../../components/AppText";
import { ArtworkPlaceholder } from "../../components/ArtworkPlaceholder";
import { MINI_PLAYER_SPACE, MiniPlayer } from "../../components/MiniPlayer";
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
import { useT } from "../../i18n";
import { useCollection, type CollectionKind } from "../../store/collections";
import { initLibrary, useLibrary } from "../../store/library";
import { usePlayer } from "../../store/player";
import { addSongsToPlaylist, createPlaylist } from "../../store/playlists";

const COVER_SIZE = 190;

function isKind(value: string | undefined): value is CollectionKind {
  return value === "album" || value === "artist" || value === "folder";
}

/** One album, artist or folder: cover, name, Play / Add to queue, and its songs. */
export default function CollectionScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t, tn } = useT();
  const params = useLocalSearchParams<{ kind: string; key?: string }>();
  const kind: CollectionKind = isKind(params.kind) ? params.kind : "album";
  const key = params.key ?? "";

  const status = useLibrary((s) => s.status);
  const collection = useCollection(kind, key);
  const currentId = usePlayer((s) => s.mediaId);
  const hasQueue = usePlayer((s) => s.queueLength > 0);

  const [sheetSong, setSheetSong] = useState<EngineSong | null>(null);
  const [newPlaylistFor, setNewPlaylistFor] = useState<EngineSong | null>(null);

  useEffect(() => {
    initLibrary();
  }, []);

  const songs = useMemo(() => collection?.songs ?? [], [collection]);
  const ids = useMemo(() => songs.map((s) => s.id), [songs]);
  const cover = usePlaylistCover(ids, 600);

  const onPressSong = useCallback(
    (index: number) => {
      playSongs(songs, index, `${kind} ${key || "(unknown)"}`);
    },
    [songs, kind, key],
  );

  const onCreateAndAdd = async (name: string) => {
    const target = newPlaylistFor;
    setNewPlaylistFor(null);
    if (!target) return;
    const id = await createPlaylist(name);
    await addSongsToPlaylist(id, [target.id]);
    showToast(t("toast.addedTo", { name }));
  };

  const title =
    collection?.name ??
    (kind === "artist"
      ? t("common.unknownArtist")
      : kind === "folder"
        ? t("browse.unknownFolder")
        : t("common.unknownAlbum"));
  const typeLabel =
    kind === "album"
      ? t("browse.album")
      : kind === "artist"
        ? t("browse.artist")
        : t("browse.folder");
  const loading = status === "checking" || status === "scanning";

  if (!loading && !collection) {
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
            {t("browse.gone")}
          </AppText>
        </View>
      </View>
    );
  }

  const header = (
    <View style={styles.hero}>
      {kind === "folder" ? (
        <View style={[styles.folderCover, { backgroundColor: colors.surface }]}>
          <Ionicons name="folder-open" size={72} color={colors.purple} />
        </View>
      ) : cover ? (
        <Image
          source={{ uri: cover }}
          style={[styles.cover, kind === "artist" && styles.round]}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <ArtworkPlaceholder
          width={COVER_SIZE}
          radius={kind === "artist" ? COVER_SIZE / 2 : 24}
          iconScale={0.36}
        />
      )}
      <AppText variant="label" color={colors.accent} style={styles.type}>
        {typeLabel.toUpperCase()}
      </AppText>
      <AppText variant="title" align="center" numberOfLines={2}>
        {title}
      </AppText>
      {collection?.detail ? (
        <AppText variant="caption" muted align="center" numberOfLines={2}>
          {collection.detail}
        </AppText>
      ) : null}
      <AppText variant="caption" muted align="center">
        {kind === "artist" && collection
          ? `${tn("albums", collection.albumCount)} · `
          : ""}
        {tn("songs", songs.length)}
        {songs.length > 0
          ? ` · ${formatTotalDuration(collection?.totalMs ?? 0)}`
          : ""}
      </AppText>

      <View style={styles.actions}>
        <Pressable
          disabled={songs.length === 0}
          onPress={() => onPressSong(0)}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="play" size={18} color={colors.white} />
          <AppText weight="semibold" color={colors.white}>
            {t("common.play")}
          </AppText>
        </Pressable>
        <Pressable
          disabled={songs.length === 0}
          onPress={() => queueSongs(songs, false)}
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
          <MaterialCommunityIcons
            name="playlist-plus"
            size={20}
            color={colors.textPrimary}
          />
          <AppText weight="semibold">{t("sheet.addToQueue")}</AppText>
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
      <ScreenHeader />

      {loading ? (
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
              onLongPress={setSheetSong}
              trailing="more"
              onTrailingPress={setSheetSong}
            />
          )}
          ListHeaderComponent={header}
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
    gap: 2,
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 24,
  },
  round: {
    borderRadius: COVER_SIZE / 2,
  },
  folderCover: {
    width: 150,
    height: 150,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  type: {
    marginTop: 16,
    letterSpacing: 1.5,
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
    paddingHorizontal: 20,
    borderRadius: 22,
  },
});
