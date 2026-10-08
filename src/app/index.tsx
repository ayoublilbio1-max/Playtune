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
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AddToPlaylistSheet,
  queueSongs,
} from "../components/AddToPlaylistSheet";
import { AppText } from "../components/AppText";
import { CollectionList, type LibraryTab } from "../components/CollectionList";
import { IconButton } from "../components/IconButton";
import { LibraryToolbar } from "../components/LibraryToolbar";
import { MINI_PLAYER_SPACE, MiniPlayer } from "../components/MiniPlayer";
import { PlayingBars } from "../components/PlayingBars";
import { PlaylistsRow } from "../components/PlaylistsRow";
import { PromptModal } from "../components/PromptModal";
import { RecentList } from "../components/RecentList";
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
import {
  allowAndScan,
  hideSongs,
  initLibrary,
  useLibrary,
} from "../store/library";
import { usePlayer } from "../store/player";
import {
  addSongsToPlaylist,
  createPlaylist,
  getPlaylists,
  loadPlaylists,
} from "../store/playlists";
import { resumeLastSession } from "../store/resume";

/** Home tabs. Each has an icon before its name; Recently played shows the moving bars instead. */
const TABS: {
  key: LibraryTab;
  label: TKey;
  icon?: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "songs", label: "browse.songs", icon: "musical-notes" },
  { key: "recent", label: "home.recent" },
  { key: "album", label: "browse.albums", icon: "disc" },
  { key: "artist", label: "browse.artists", icon: "person" },
  { key: "folder", label: "browse.folders", icon: "folder" },
];

let splashHidden = false;

type Prompt =
  | null
  | { mode: "create" }
  | { mode: "create-and-add"; songs: EngineSong[] };

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
  const isPlaying = usePlayer((s) => s.isPlaying);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<SortKey>(loadSort);
  const [sortOpen, setSortOpen] = useState(false);
  const [addSong, setAddSong] = useState<EngineSong | null>(null);
  /** Selection mode (long-press a song): ids of the selected songs; null = not selecting. */
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [addMany, setAddMany] = useState<EngineSong[] | null>(null);
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

  const selecting = selected !== null;

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onPressSong = useCallback(
    (index: number) => {
      const song = visible[index];
      if (selecting) {
        if (song) toggleSelect(song.id);
        return;
      }
      playSongs(visible, index, q ? "search" : `library (${sort})`);
    },
    [visible, q, sort, selecting, toggleSelect],
  );

  const onLongPressSong = useCallback(
    (song: EngineSong) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (selecting) {
        toggleSelect(song.id);
        return;
      }
      if (__DEV__) console.log("[select] selection mode on");
      setSelected(new Set([song.id]));
    },
    [selecting, toggleSelect],
  );

  // Back leaves selection mode.
  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelected(null);
      return true;
    });
    return () => sub.remove();
  }, [selecting]);

  // Selected songs in list order (the order they are played / added in).
  const selectedSongs = useMemo(
    () => (selected ? sorted.filter((s) => selected.has(s.id)) : []),
    [selected, sorted],
  );
  const allSelected =
    selecting && visible.length > 0 && visible.every((s) => selected.has(s.id));

  const selectionAction = (action: "play" | "queue" | "playlist" | "hide") => {
    const list = selectedSongs;
    if (list.length === 0) return;
    if (__DEV__) console.log(`[select] ${action} — ${list.length} songs`);
    if (action === "play") playSongs(list, 0, "selection");
    if (action === "queue") queueSongs(list, false);
    if (action === "playlist") {
      setAddMany(list);
      return;
    }
    if (action === "hide") {
      hideSongs(list.map((s) => s.id));
      showToast(tn("toast.hiddenMany", list.length));
    }
    setSelected(null);
  };

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
      const added = await addSongsToPlaylist(
        id,
        current.songs.map((s) => s.id),
      );
      showToast(
        current.songs.length > 1
          ? tn("toast.addedSongsTo", added, { name })
          : t("toast.addedTo", { name }),
      );
      setSelected(null);
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
      {selecting ? (
        <View style={styles.header}>
          <View style={styles.selectTitle}>
            <IconButton
              name="close"
              size={26}
              accessibilityLabel={t("common.close")}
              onPress={() => setSelected(null)}
            />
            <AppText variant="heading">
              {t("select.count", { count: selected.size })}
            </AppText>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() =>
              setSelected(
                allSelected ? new Set() : new Set(visible.map((s) => s.id)),
              )
            }
            style={styles.selectAll}
          >
            <AppText weight="semibold" color={colors.accent}>
              {allSelected ? t("select.none") : t("select.all")}
            </AppText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <AppText variant="title">Playtune</AppText>
          <IconButton
            name="menu"
            size={28}
            accessibilityLabel="Menu"
            onPress={() => setMenuOpen(true)}
          />
        </View>
      )}

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
              const isTab = item.key === tab;
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
                      backgroundColor: isTab ? colors.accent : colors.surface,
                      borderColor: isTab ? colors.accent : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {item.key === "recent" ? (
                    <PlayingBars
                      playing={isPlaying}
                      color={isTab ? colors.white : colors.accent}
                      height={12}
                    />
                  ) : item.icon ? (
                    <Ionicons
                      name={item.icon}
                      size={14}
                      color={isTab ? colors.white : colors.accent}
                    />
                  ) : null}
                  <AppText
                    variant="caption"
                    weight={isTab ? "semibold" : "medium"}
                    color={isTab ? colors.white : undefined}
                  >
                    {t(item.label)}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          {tab === "recent" ? (
            <RecentList
              query={q}
              bottomSpace={hasQueue ? MINI_PLAYER_SPACE : 32}
              onMore={openAddSheet}
            />
          ) : tab !== "songs" ? (
            <CollectionList
              kind={tab}
              query={q}
              bottomSpace={hasQueue ? MINI_PLAYER_SPACE : 32}
            />
          ) : (
            <FlashList
              data={visible}
              keyExtractor={(s) => s.id}
              extraData={`${currentId}|${selected ? selected.size : -1}|${selected ? [...selected].join(",") : ""}`}
              renderItem={({ item, index }) => (
                <SongRow
                  song={item}
                  index={index}
                  active={item.id === currentId}
                  onPress={onPressSong}
                  onLongPress={onLongPressSong}
                  trailing={selecting ? "check" : "more"}
                  checked={selecting && selected.has(item.id)}
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
                paddingBottom: hasQueue
                  ? MINI_PLAYER_SPACE
                  : selecting
                    ? 120
                    : 32,
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

      {selecting ? (
        <View
          style={[
            styles.selectBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              bottom: insets.bottom + 10,
            },
          ]}
        >
          {(
            [
              ["play", "play", "select.play"],
              ["queue", "list", "sheet.addToQueue"],
              ["playlist", "add-circle-outline", "sheet.addToPlaylist"],
              ["hide", "eye-off-outline", "sheet.hide"],
            ] as const
          ).map(([action, icon, label]) => (
            <Pressable
              key={action}
              disabled={selected.size === 0}
              onPress={() => selectionAction(action)}
              style={({ pressed }) => [
                styles.selectAction,
                { opacity: selected.size === 0 ? 0.4 : pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons
                name={icon}
                size={22}
                color={action === "play" ? colors.accent : colors.textPrimary}
              />
              <AppText variant="label" align="center" numberOfLines={1}>
                {t(label)}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : (
        <MiniPlayer />
      )}

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
          setPrompt({ mode: "create-and-add", songs: [song] });
        }}
      />
      <AddToPlaylistSheet
        song={null}
        songs={addMany}
        onClose={() => {
          setAddMany(null);
          setSelected(null);
        }}
        onNewPlaylist={() => {}}
        onNewPlaylistMany={(list) => {
          setAddMany(null);
          setPrompt({ mode: "create-and-add", songs: list });
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: -12,
  },
  selectAll: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectBar: {
    position: "absolute",
    left: 10,
    right: 10,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 6,
    elevation: 12,
  },
  selectAction: {
    flex: 1,
    alignItems: "center",
    gap: 4,
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
