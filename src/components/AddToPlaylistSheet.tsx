import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { PlaytuneEngine, toQueueItem, type EngineSong } from "../engine/engine";
import { usePlaylistCover } from "../hooks/use-artwork";
import { useTheme } from "../hooks/use-theme";
import { t as tNow, useT } from "../i18n";
import { hideSongs } from "../store/library";
import { getPlayer } from "../store/player";
import {
  addSongsToPlaylist,
  playlistName,
  usePlaylists,
  type Playlist,
} from "../store/playlists";
import { AppText } from "./AppText";
import { ArtworkPlaceholder } from "./ArtworkPlaceholder";
import { Overlay } from "./Overlay";
import { showToast } from "./Toast";

type Props = {
  song: EngineSong | null;
  onClose: () => void;
  /** "New playlist" tapped: the screen asks for a name, creates it and adds the song. */
  onNewPlaylist: (song: EngineSong) => void;
  /** Play next / Add to queue / Hide row at the top (off on the Player screen). */
  showActions?: boolean;
};

/** Adds songs to the queue: right after the current song, or at the end. Starts playing if nothing is queued. */
export async function queueSongs(songs: EngineSong[], playNext: boolean) {
  if (songs.length === 0) return;
  const empty = getPlayer().queueLength === 0;
  try {
    if (empty) {
      await PlaytuneEngine.setQueue(songs.map(toQueueItem), 0, 0, true);
    } else {
      await PlaytuneEngine.addToQueue(songs.map(toQueueItem), playNext);
    }
    if (__DEV__)
      console.log(
        `[queue] ${playNext ? "play next" : "add to end"}: ${songs.length} songs (was empty: ${empty})`,
      );
    showToast(
      empty
        ? tNow("toast.playing")
        : playNext
          ? tNow("toast.playNext")
          : tNow("toast.addedToQueue"),
    );
  } catch (e) {
    if (__DEV__) console.log(`[queue] add failed — ${String(e)}`);
  }
}

function Action({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon}
      <AppText
        variant="caption"
        weight="medium"
        align="center"
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/** Long-press a song (or tap ⋮): play next, add to queue, hide, or add it to a playlist. */
export function AddToPlaylistSheet({
  song,
  onClose,
  onNewPlaylist,
  showActions = true,
}: Props) {
  const colors = useTheme();
  const { t } = useT();
  const playlists = usePlaylists((s) => s.playlists);

  const add = async (playlist: Playlist) => {
    if (!song) return;
    onClose();
    const added = await addSongsToPlaylist(playlist.id, [song.id]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    const name = playlistName(playlist);
    showToast(
      added > 0
        ? tNow("toast.addedTo", { name })
        : tNow("toast.alreadyIn", { name }),
    );
  };

  const queue = (playNext: boolean) => {
    if (!song) return;
    onClose();
    queueSongs([song], playNext);
  };

  const hide = () => {
    if (!song) return;
    onClose();
    hideSongs([song.id]);
    showToast(tNow("toast.hidden", { title: song.title }));
  };

  return (
    <Overlay visible={song !== null} onClose={onClose}>
      <AppText variant="heading" numberOfLines={1}>
        {showActions ? song?.title : t("sheet.addToPlaylist")}
      </AppText>
      <AppText
        variant="caption"
        muted
        numberOfLines={1}
        style={styles.subtitle}
      >
        {showActions
          ? song?.artist?.trim()
            ? song.artist
            : t("common.unknownArtist")
          : song?.title}
      </AppText>

      {showActions ? (
        <>
          <View style={styles.actions}>
            <Action
              icon={
                <MaterialCommunityIcons
                  name="playlist-play"
                  size={24}
                  color={colors.accent}
                />
              }
              label={t("sheet.playNext")}
              onPress={() => queue(true)}
            />
            <Action
              icon={
                <MaterialCommunityIcons
                  name="playlist-plus"
                  size={24}
                  color={colors.purple}
                />
              }
              label={t("sheet.addToQueue")}
              onPress={() => queue(false)}
            />
            <Action
              icon={
                <Ionicons
                  name="eye-off-outline"
                  size={22}
                  color={colors.textMuted}
                />
              }
              label={t("sheet.hide")}
              onPress={hide}
            />
          </View>
          <AppText variant="label" muted style={styles.section}>
            {t("sheet.addToPlaylist").toUpperCase()}
          </AppText>
        </>
      ) : null}

      <Pressable
        onPress={() => {
          if (song) onNewPlaylist(song);
        }}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View
          style={[
            styles.thumb,
            styles.newThumb,
            { backgroundColor: colors.accent },
          ]}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </View>
        <AppText weight="semibold" style={styles.flex}>
          {t("common.newPlaylist")}
        </AppText>
      </Pressable>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {playlists.map((p) => (
          <PlaylistOption
            key={p.id}
            playlist={p}
            contains={song ? p.songIds.includes(song.id) : false}
            onPress={add}
          />
        ))}
      </ScrollView>
    </Overlay>
  );
}

function PlaylistOption({
  playlist,
  contains,
  onPress,
}: {
  playlist: Playlist;
  contains: boolean;
  onPress: (p: Playlist) => void;
}) {
  const colors = useTheme();
  const { t, tn } = useT();
  const cover = usePlaylistCover(playlist.songIds, 128);
  const count = playlist.songIds.length;

  return (
    <Pressable
      disabled={contains}
      onPress={() => onPress(playlist)}
      style={({ pressed }) => [
        styles.row,
        { opacity: contains ? 0.5 : pressed ? 0.7 : 1 },
      ]}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={styles.thumb}
          contentFit="cover"
        />
      ) : (
        <ArtworkPlaceholder
          width={44}
          radius={10}
          icon={playlist.kind === "liked" ? "heart" : "musical-note"}
        />
      )}
      <View style={styles.flex}>
        <AppText weight="medium" numberOfLines={1}>
          {playlist.kind === "liked" ? t("common.likedSongs") : playlist.name}
        </AppText>
        <AppText variant="label" muted>
          {contains ? t("sheet.alreadyAdded") : tn("songs", count)}
        </AppText>
      </View>
      <Ionicons
        name={contains ? "checkmark-circle" : "add-circle-outline"}
        size={22}
        color={contains ? colors.accent : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    height: 68,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  section: {
    marginTop: 16,
    marginBottom: 2,
    letterSpacing: 1,
  },
  list: {
    flexGrow: 0,
    maxHeight: 260,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  newThumb: {
    alignItems: "center",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
  },
});
