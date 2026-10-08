import { memo } from "react";
import { StyleSheet, View } from "react-native";

import type { EngineSong } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { AppText } from "./AppText";
import { Artwork } from "./Artwork";

/** Song line used in reorder mode (artwork, title, artist). The drag handle is added by DraggableList. */
export const ReorderSongRow = memo(function ReorderSongRow({
  song,
  active,
}: {
  song: EngineSong;
  active?: boolean;
}) {
  const colors = useTheme();
  const { t } = useT();
  return (
    <View style={styles.row}>
      <Artwork songId={song.id} size={46} radius={10} />
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
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 20,
  },
  texts: {
    flex: 1,
  },
});
