import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddToPlaylistSheet } from "../components/AddToPlaylistSheet";
import { AppText } from "../components/AppText";
import { CollectionList, type LibraryTab } from "../components/CollectionList";
import { IconButton } from "../components/IconButton";
import { LibraryToolbar } from "../components/LibraryToolbar";
import { MINI_PLAYER_SPACE, MiniPlayer } from "../components/MiniPlayer";
import { PlaylistsRow } from "../components/PlaylistsRow";
import { PromptModal } from "../components/PromptModal";
import { SideMenu } from "../components/SideMenu";
import { SongRow } from "../components/SongRow";
import { SongListSkeleton } from "../components/SongRowSkeleton";
import { SortSheet } from "../components/SortSheet";
import { showToast, Toast } from "../components/Toast";
import {
  loadSort,
  saveSort,
  sortLabel,
  sortSongs,
  type SortKey,
} from "../constants/sort";
import { playSongs, type EngineSong } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useT, type TKey } from "../i18n";
import { allowAndScan, initLibrary, useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import {
  addSongsToPlaylist,
  createPlaylist,
  getPlaylists,
  loadPlaylists,
} from "../store/playlists";
import { resumeLastSession } from "../store/resume";

const TABS: { key: LibraryTab; label: TKey }[] = [
  { key: "songs", label: "browse.songs" },
  { key: "album", label: "browse.albums" },
  { key: "artist", label: "browse.artists" },
  { key: "folder", label: "browse.folders" },
];

let splashHidden = false;

type Prompt =
  | null
  | { mode: "create" }
  | { mode: "create-and-add"; song: EngineSong };

export default function HomeScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t, tn } = useT();

  const status = useLibrary((s) => s.status);
  const songs = useLibrary((s) => s.songs);
  const byId = useLibrary((s) => s.byId);
  const error = useLibrary((s) => s.error);
  const currentId = usePlayer((s) => s.mediaId);
  const hasQueue = usePlayer((s) => s.queueLength > 0);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<SortKey>(loadSort);
  const [sortOpen, setSortOpen] = useState(false);
  const [addSong, setAddSong] = useState<EngineSong | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("songs");

  useEffect(() => {
    initLibrary();
    loadPlaylists();
  }, []);

  // Resume on launch: last song ready (paused) once the songs are known.
  useEffect(() => {
    if (status === "ready") resumeLastSession();
  }, [status]);

  // Hide the splash once, as soon as we know what to show (songs, permission screen or error).
  useEffect(() => {
    if (status === "checking" || splashHidden) return;
    splashHidden = true;
    SplashScreen.hideAsync()
      .then(() => {
        if (__DEV__) console.log(`[splash] hidden (library: ${status})`);
      })
      .catch(() => {});
  }, [status]);

  const sorted = useMemo(() => sortSongs(songs, sort), [songs, sort]);
  const searchIndex = useMemo(
    () =>
      new Map(
        songs.map((s) => [
          s.id,
          `${s.title} ${s.artist ?? ""} ${s.album ?? ""}`.toLowerCase(),
        ]),
      ),
    [songs],
  );
  const q = deferredQuery.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return sorted;
    const start = Date.now();
    const result = sorted.filter((s) => searchIndex.get(s.id)?.includes(q));
    if (__DEV__)
      console.log(
        `[search] "${q}" → ${result.length} songs in ${Date.now() - start}ms`,
      );
    return result;
  }, [q, sorted, searchIndex]);

  const onPressSong = useCallback(
    (index: number) => {
      playSongs(visible, index, q ? "search" : `library (${sort})`);
    },
    [visible, q, sort],
  );

  const openAddSheet = useCallback((song: EngineSong) => {
    Haptics.selectionAsync().catch(() => {});
    setAddSong(song);
  }, []);

  const openPlaylist = useCallback((id: number) => {
    router.push({ pathname: "/playlist/[id]", params: { id: String(id) } });
  }, []);

  const playPlaylist = useCallback(
    (id: number) => {
      const playlist = getPlaylists().playlists.find((p) => p.id === id);
      if (!playlist) return;
      const list = playlist.songIds
        .map((sid) => byId.get(sid))
        .filter((s): s is EngineSong => !!s);
      playSongs(list, 0, `playlist #${id}`);
    },
    [byId],
  );

  const onSelectSort = (key: SortKey) => {
    setSort(key);
    saveSort(key);
    setSortOpen(false);
  };

  const onPromptSubmit = async (name: string) => {
    const current = prompt;
    setPrompt(null);
    if (!current) return;
    const id = await createPlaylist(name);
    if (current.mode === "create-and-add") {
      await addSongsToPlaylist(id, [current.song.id]);
      showToast(t("toast.addedTo", { name }));
    } else {
      openPlaylist(id);
    }
  };

  const listHeader = q ? (
    <AppText variant="caption" muted style={styles.sectionLabel}>
      {tn("results", visible.length)}
    </AppText>
  ) : (
    <View>
      <PlaylistsRow
        onCreate={() => setPrompt({ mode: "create" })}
        onOpen={openPlaylist}
        onPlay={playPlaylist}
      />
      <View style={styles.songsHeader}>
        <AppText variant="heading">{t("browse.songs")}</AppText>
        <AppText variant="caption" muted>
          {songs.length} · {t(sortLabel(sort))}
        </AppText>
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
      <View style={styles.header}>
        <AppText variant="title">Playtune</AppText>
        <IconButton
          name="menu"
          size={28}
          accessibilityLabel="Menu"
          onPress={() => setMenuOpen(true)}
        />
      </View>

      {status === "ready" ? (
        <>
          <LibraryToolbar
            query={query}
            onQueryChange={setQuery}
            onSortPress={() => setSortOpen(true)}
            onEqualizerPress={() => router.push("/equalizer")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabs}
          >
            {TABS.map((item) => {
              const selected = item.key === tab;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    if (__DEV__) console.log(`[home] tab → ${item.key}`);
                    setTab(item.key);
                  }}
                  style={({ pressed }) => [
                    styles.tab,
                    {
                      backgroundColor: selected
                        ? colors.accent
                        : colors.surface,
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
                    {t(item.label)}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          {tab !== "songs" ? (
            <CollectionList
              kind={tab}
              query={q}
              bottomSpace={hasQueue ? MINI_PLAYER_SPACE : 32}
            />
          ) : (
            <FlashList
              data={visible}
              keyExtractor={(s) => s.id}
              extraData={currentId}
              renderItem={({ item, index }) => (
                <SongRow
                  song={item}
                  index={index}
                  active={item.id === currentId}
                  onPress={onPressSong}
                  onLongPress={openAddSheet}
                  trailing="more"
                  onTrailingPress={openAddSheet}
                />
              )}
              ListHeaderComponent={listHeader}
              ListEmptyComponent={
                <AppText muted align="center" style={styles.empty}>
                  {q ? t("home.noMatch") : t("home.noSongs")}
                </AppText>
              }
              contentContainerStyle={{
                paddingBottom: hasQueue ? MINI_PLAYER_SPACE : 32,
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
          )}
        </>
      ) : null}

      {status === "checking" || status === "scanning" ? (
        <SongListSkeleton />
      ) : null}

      {status === "need-permission" || status === "blocked" ? (
        <View style={styles.center}>
          <Ionicons name="musical-notes" size={48} color={colors.accent} />
          <AppText variant="heading" align="center">
            {t("perm.title")}
          </AppText>
          <AppText muted align="center">
            {status === "blocked" ? t("perm.blocked") : t("perm.why")}
          </AppText>
          {status === "need-permission" ? (
            <Pressable
              style={[styles.primary, { backgroundColor: colors.accent }]}
              onPress={allowAndScan}
            >
              <AppText weight="semibold" color={colors.white}>
                {t("perm.allow")}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {status === "error" ? (
        <View style={styles.center}>
          <AppText muted align="center">
            {error}
          </AppText>
        </View>
      ) : null}

      <MiniPlayer />

      <SortSheet
        visible={sortOpen}
        value={sort}
        onSelect={onSelectSort}
        onClose={() => setSortOpen(false)}
      />
      <AddToPlaylistSheet
        song={addSong}
        onClose={() => setAddSong(null)}
        onNewPlaylist={(song) => {
          setAddSong(null);
          setPrompt({ mode: "create-and-add", song });
        }}
      />
      <PromptModal
        visible={prompt !== null}
        title={t("common.newPlaylist")}
        placeholder={t("common.playlistName")}
        confirmLabel={t("common.create")}
        onSubmit={onPromptSubmit}
        onCancel={() => setPrompt(null)}
      />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  tabsScroll: {
    flexGrow: 0,
  },
  tabs: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tab: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: "center",
  },
  sectionLabel: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  songsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  empty: {
    marginTop: 40,
    paddingHorizontal: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  primary: {
    marginTop: 8,
    paddingHorizontal: 36,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
  },
});
