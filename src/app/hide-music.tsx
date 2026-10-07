import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { Artwork } from "../components/Artwork";
import { ScreenHeader } from "../components/ScreenHeader";
import { SongListSkeleton } from "../components/SongRowSkeleton";
import { fonts } from "../constants/fonts";
import { formatTime, type EngineSong } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { hideSongs, unhideSongs, useLibrary } from "../store/library";

type Filter = "all" | "hidden";

const HideRow = memo(function HideRow({
  song,
  hidden,
  onToggle,
}: {
  song: EngineSong;
  hidden: boolean;
  onToggle: (song: EngineSong, hide: boolean) => void;
}) {
  const colors = useTheme();
  const { t } = useT();
  return (
    <Pressable
      onPress={() => onToggle(song, !hidden)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={hidden ? styles.dim : undefined}>
        <Artwork songId={song.id} size={46} radius={10} />
      </View>
      <View style={[styles.texts, hidden && styles.dim]}>
        <AppText weight="medium" numberOfLines={1}>
          {song.title}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {song.artist?.trim() ? song.artist : t("common.unknownArtist")} ·{" "}
          {formatTime(song.durationMs)}
        </AppText>
      </View>
      <View
        style={[
          styles.eye,
          { backgroundColor: hidden ? colors.surfaceRaised : "transparent" },
        ]}
      >
        <Ionicons
          name={hidden ? "eye-off" : "eye-outline"}
          size={20}
          color={hidden ? colors.accent : colors.textMuted}
        />
      </View>
    </Pressable>
  );
});

/**
 * Settings › Hide music: tap a song to hide it from the whole app (library, playlists, albums, search).
 * Files stay on the phone; tap again to show it.
 */
export default function HideMusicScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t, tn } = useT();

  const status = useLibrary((s) => s.status);
  const allSongs = useLibrary((s) => s.allSongs);
  const hidden = useLibrary((s) => s.hidden);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const q = deferred.trim().toLowerCase();

  const list = useMemo(() => {
    const base =
      filter === "hidden" ? allSongs.filter((s) => hidden.has(s.id)) : allSongs;
    const sorted = [...base].sort((a, b) => a.title.localeCompare(b.title));
    return q
      ? sorted.filter((s) =>
          `${s.title} ${s.artist ?? ""}`.toLowerCase().includes(q),
        )
      : sorted;
  }, [allSongs, hidden, filter, q]);

  const onToggle = useCallback((song: EngineSong, hide: boolean) => {
    if (hide) hideSongs([song.id]);
    else unhideSongs([song.id]);
  }, []);

  const loading = status === "checking" || status === "scanning";

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader
        title={t("settings.hideMusic")}
        right={
          hidden.size > 0 ? (
            <Pressable
              hitSlop={8}
              onPress={() => unhideSongs([...hidden])}
              style={styles.showAll}
            >
              <AppText
                variant="caption"
                weight="semibold"
                color={colors.accent}
              >
                {t("hide.showAll")}
              </AppText>
            </Pressable>
          ) : null
        }
      />

      <AppText variant="caption" muted style={styles.intro}>
        {t("hide.intro")}
      </AppText>

      <View
        style={[
          styles.search,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("home.search")}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          autoCorrect={false}
          style={[styles.input, { color: colors.textPrimary }]}
        />
        {query ? (
          <Pressable hitSlop={10} onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters}>
        {(["all", "hidden"] as const).map((key) => {
          const selected = key === filter;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <AppText
                variant="caption"
                weight={selected ? "semibold" : "medium"}
                color={selected ? colors.white : undefined}
              >
                {key === "all"
                  ? t("hide.all", { count: allSongs.length })
                  : t("hide.hidden", { count: hidden.size })}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <SongListSkeleton />
      ) : (
        <FlashList
          data={list}
          keyExtractor={(s) => s.id}
          extraData={hidden}
          renderItem={({ item }) => (
            <HideRow
              song={item}
              hidden={hidden.has(item.id)}
              onToggle={onToggle}
            />
          )}
          ListEmptyComponent={
            <AppText muted align="center" style={styles.empty}>
              {filter === "hidden" && !q ? t("hide.none") : t("home.noMatch")}
            </AppText>
          }
          ListFooterComponent={
            list.length > 0 ? (
              <AppText
                variant="label"
                muted
                align="center"
                style={styles.footer}
              >
                {tn("songs", list.length)}
              </AppText>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  showAll: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  intro: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  search: {
    marginHorizontal: 16,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 44,
    paddingVertical: 0,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    height: 62,
  },
  texts: {
    flex: 1,
  },
  dim: {
    opacity: 0.4,
  },
  eye: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    marginTop: 40,
    paddingHorizontal: 32,
  },
  footer: {
    paddingTop: 12,
  },
});
