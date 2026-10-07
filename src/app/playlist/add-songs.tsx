import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../../components/AppText";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SongRow } from "../../components/SongRow";
import { showToast } from "../../components/Toast";
import { fonts } from "../../constants/fonts";
import { loadSort, sortSongs } from "../../constants/sort";
import { useTheme } from "../../hooks/use-theme";
import { useT } from "../../i18n";
import { useLibrary } from "../../store/library";
import {
  addSongsToPlaylist,
  playlistName,
  usePlaylists,
} from "../../store/playlists";

/** Pick songs to add to a playlist: search, tap to select, then "Add". */
export default function AddSongsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t, tn } = useT();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const playlist = usePlaylists((s) => s.playlists.find((p) => p.id === id));
  const songs = useLibrary((s) => s.songs);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  const inPlaylist = useMemo(
    () => new Set(playlist?.songIds ?? []),
    [playlist],
  );
  const sorted = useMemo(() => sortSongs(songs, loadSort()), [songs]);
  const q = deferredQuery.trim().toLowerCase();
  const visible = useMemo(
    () =>
      q
        ? sorted.filter((s) =>
            `${s.title} ${s.artist ?? ""} ${s.album ?? ""}`
              .toLowerCase()
              .includes(q),
          )
        : sorted,
    [sorted, q],
  );

  const toggle = useCallback(
    (index: number) => {
      const song = visible[index];
      if (!song || inPlaylist.has(song.id)) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(song.id)) next.delete(song.id);
        else next.add(song.id);
        return next;
      });
    },
    [visible, inPlaylist],
  );

  const onAdd = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    const ids = sorted.filter((s) => selected.has(s.id)).map((s) => s.id); // keep the list order
    const added = await addSongsToPlaylist(id, ids);
    showToast(tn("toast.addedSongs", added));
    router.back();
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader
        title={
          playlist
            ? t("playlist.addTo", { name: playlistName(playlist) })
            : t("playlist.addSongs")
        }
      />

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

      <FlashList
        data={visible}
        keyExtractor={(s) => s.id}
        extraData={selected}
        renderItem={({ item, index }) => {
          const already = inPlaylist.has(item.id);
          return (
            <SongRow
              song={item}
              index={index}
              onPress={toggle}
              trailing="check"
              checked={already || selected.has(item.id)}
              disabled={already}
            />
          );
        }}
        ListEmptyComponent={
          <AppText muted align="center" style={styles.empty}>
            {q ? t("home.noMatch") : t("home.noSongs")}
          </AppText>
        }
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      <View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + 14,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          disabled={selected.size === 0 || saving}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.accent,
              opacity: selected.size === 0 ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <AppText weight="semibold" color={colors.white}>
            {selected.size === 0
              ? t("playlist.selectSongs")
              : tn("playlist.addCount", selected.size)}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 10,
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
  empty: {
    marginTop: 40,
    paddingHorizontal: 32,
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  addButton: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
