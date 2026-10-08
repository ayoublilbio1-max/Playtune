import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { playSongs, type EngineSong } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { useHistory } from "../store/history";
import { useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import { AppText } from "./AppText";
import { SongRow } from "./SongRow";

type Props = {
  /** Search text (already lower-case and trimmed). */
  query: string;
  bottomSpace: number;
  onMore: (song: EngineSong) => void;
};

/** Home › Recently played tab: the last songs listened to (15 s or more), newest first. */
export function RecentList({ query, bottomSpace, onMore }: Props) {
  const colors = useTheme();
  const { t, tn } = useT();
  const recentIds = useHistory((s) => s.recent);
  const byId = useLibrary((s) => s.byId);
  const currentId = usePlayer((s) => s.mediaId);

  // Hidden or deleted songs are left out.
  const songs = useMemo(() => {
    const list = recentIds
      .map((id) => byId.get(id))
      .filter((s): s is EngineSong => !!s);
    if (!query) return list;
    return list.filter((s) =>
      `${s.title} ${s.artist ?? ""} ${s.album ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [recentIds, byId, query]);

  const onPress = useCallback(
    (index: number) => playSongs(songs, index, "recently played"),
    [songs],
  );

  return (
    <FlashList
      data={songs}
      keyExtractor={(s) => s.id}
      extraData={currentId}
      renderItem={({ item, index }) => (
        <SongRow
          song={item}
          index={index}
          active={item.id === currentId}
          onPress={onPress}
          onLongPress={onMore}
          trailing="more"
          onTrailingPress={onMore}
        />
      )}
      ListHeaderComponent={
        songs.length > 0 ? (
          <AppText variant="caption" muted style={styles.count}>
            {tn("songs", songs.length)}
          </AppText>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={42} color={colors.purple} />
          <AppText muted align="center">
            {query ? t("home.noMatch") : t("home.recentEmpty")}
          </AppText>
        </View>
      }
      contentContainerStyle={{ paddingBottom: bottomSpace }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  count: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  empty: {
    alignItems: "center",
    gap: 10,
    marginTop: 48,
    paddingHorizontal: 32,
  },
});
