import { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { useLibrary } from "../store/library";
import { usePlaylists } from "../store/playlists";
import { AppText } from "./AppText";
import { NewPlaylistCard, PlaylistCard } from "./PlaylistCard";

type Props = {
  onCreate: () => void;
  onOpen: (id: number) => void;
  onPlay: (id: number) => void;
};

type Item =
  | { kind: "new" }
  | { kind: "playlist"; id: number; name: string; songIds: string[] };

/** Horizontal row: "New playlist" card, then the user's playlists (newest first). */
export function PlaylistsRow({ onCreate, onOpen, onPlay }: Props) {
  const playlists = usePlaylists((s) => s.playlists);
  const byId = useLibrary((s) => s.byId);

  const items = useMemo<Item[]>(
    () => [
      { kind: "new" },
      ...playlists.map((p) => ({
        kind: "playlist" as const,
        id: p.id,
        name: p.name,
        // Songs deleted from the phone are not counted or shown.
        songIds: p.songIds.filter((id) => byId.has(id)),
      })),
    ],
    [playlists, byId],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText variant="heading">Playlists</AppText>
        {playlists.length > 0 ? (
          <AppText variant="caption" muted>
            {playlists.length}
          </AppText>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => (item.kind === "new" ? "new" : String(item.id))}
        renderItem={({ item }) =>
          item.kind === "new" ? (
            <NewPlaylistCard onPress={onCreate} />
          ) : (
            <PlaylistCard
              id={item.id}
              name={item.name}
              songIds={item.songIds}
              onOpen={onOpen}
              onPlay={onPlay}
            />
          )
        }
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 6,
    paddingBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
  },
  separator: {
    width: 12,
  },
});
