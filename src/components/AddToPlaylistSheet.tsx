import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { EngineSong } from "../engine/engine";
import { usePlaylistCover } from "../hooks/use-artwork";
import { useTheme } from "../hooks/use-theme";
import {
  addSongsToPlaylist,
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
};

/** Long-press a song (or tap ⋮): choose a playlist to add it to. */
export function AddToPlaylistSheet({ song, onClose, onNewPlaylist }: Props) {
  const colors = useTheme();
  const playlists = usePlaylists((s) => s.playlists);

  const add = async (playlist: Playlist) => {
    if (!song) return;
    onClose();
    const added = await addSongsToPlaylist(playlist.id, [song.id]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    showToast(
      added > 0 ? `Added to ${playlist.name}` : `Already in ${playlist.name}`,
    );
  };

  return (
    <Overlay visible={song !== null} onClose={onClose}>
      <AppText variant="heading">Add to playlist</AppText>
      <AppText
        variant="caption"
        muted
        numberOfLines={1}
        style={styles.subtitle}
      >
        {song?.title}
      </AppText>

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
          New playlist
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
        <ArtworkPlaceholder width={44} radius={10} />
      )}
      <View style={styles.flex}>
        <AppText weight="medium" numberOfLines={1}>
          {playlist.name}
        </AppText>
        <AppText variant="label" muted>
          {contains
            ? "Already added"
            : count === 1
              ? "1 song"
              : `${count} songs`}
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
  list: {
    flexGrow: 0,
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
