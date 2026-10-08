import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { DraggableList } from "../components/DraggableList";
import { IconButton } from "../components/IconButton";
import { MINI_PLAYER_SPACE, MiniPlayer } from "../components/MiniPlayer";
import { Overlay } from "../components/Overlay";
import { ReorderSongRow } from "../components/ReorderSongRow";
import { ScreenHeader } from "../components/ScreenHeader";
import { ROW_HEIGHT, SongRow } from "../components/SongRow";
import { SongListSkeleton } from "../components/SongRowSkeleton";
import { showToast, Toast } from "../components/Toast";
import {
  formatTotalDuration,
  PlaytuneEngine,
  type EngineSong,
} from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { initLibrary, useLibrary } from "../store/library";
import { usePlayer } from "../store/player";

/**
 * The play queue: every song in order, the current one highlighted.
 * Tap = play it. ⋮ = move up / down, remove. "Reorder" (⇅) = drag songs by their handle.
 */
export default function QueueScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t, tn } = useT();

  const songById = useLibrary((s) => s.allById);
  const libraryStatus = useLibrary((s) => s.status);
  const currentIndex = usePlayer((s) => s.index);
  const mediaId = usePlayer((s) => s.mediaId);
  const queueLength = usePlayer((s) => s.queueLength);

  const [ids, setIds] = useState<string[] | null>(null);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  // Hidden songs can still be in the queue, so they are looked up in every song (allById).

  const refresh = useCallback(async (reason: string) => {
    const start = Date.now();
    try {
      const next = await PlaytuneEngine.getQueueIds();
      setIds(next);
      if (__DEV__)
        console.log(
          `[queue] read ${next.length} songs in ${Date.now() - start}ms (${reason})`,
        );
    } catch (e) {
      if (__DEV__) console.log(`[queue] read failed — ${String(e)}`);
      setIds([]);
    }
  }, []);

  useEffect(() => {
    initLibrary();
  }, []);

  // On open, and whenever the engine changes the queue or moves to another song.
  // Short delay: one song change sends several player events, so the queue is read once after them.
  useEffect(() => {
    const id = setTimeout(
      () => refresh(`queue ${queueLength}, index ${currentIndex}`),
      120,
    );
    return () => clearTimeout(id);
  }, [queueLength, mediaId, currentIndex, refresh]);

  const songs = useMemo(
    () =>
      (ids ?? [])
        .map((id) => songById.get(id))
        .filter((s): s is EngineSong => !!s),
    [ids, songById],
  );
  // Reorder mode works on the engine's own list (same indexes), with keys that stay the same while moving.
  const entries = useMemo(() => {
    const seen = new Map<string, number>();
    return (ids ?? []).map((id) => {
      const n = (seen.get(id) ?? 0) + 1;
      seen.set(id, n);
      return { key: `${id}~${n}`, id, song: songById.get(id) };
    });
  }, [ids, songById]);

  const onDragMove = useCallback(
    async (from: number, to: number) => {
      if (__DEV__) console.log(`[queue] drag ${from} → ${to}`);
      setIds((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
      await PlaytuneEngine.moveInQueue(from, to).catch(() => {});
      refresh("dragged");
    },
    [refresh],
  );

  const upNext = songs.slice(Math.max(0, currentIndex + 1));
  const upNextMs = upNext.reduce((sum, s) => sum + s.durationMs, 0);

  const playAt = useCallback((index: number) => {
    if (__DEV__) console.log(`[queue] play #${index}`);
    PlaytuneEngine.skipToIndex(index).catch(() => {});
  }, []);

  const openMenu = useCallback(
    (song: EngineSong) => {
      const index = (ids ?? []).indexOf(song.id);
      if (index >= 0) setMenuIndex(index);
    },
    [ids],
  );

  const move = async (from: number, to: number) => {
    setMenuIndex(null);
    if (to < 0 || to >= songs.length) return;
    if (__DEV__) console.log(`[queue] move ${from} → ${to}`);
    await PlaytuneEngine.moveInQueue(from, to).catch(() => {});
    refresh("moved");
  };

  const remove = async (index: number) => {
    setMenuIndex(null);
    const title = songs[index]?.title ?? "";
    if (__DEV__) console.log(`[queue] remove #${index}`);
    await PlaytuneEngine.removeFromQueue(index).catch(() => {});
    showToast(t("toast.removedFromQueue", { title }));
    refresh("removed");
  };

  const menuSong = menuIndex !== null ? songs[menuIndex] : undefined;
  const loading =
    ids === null ||
    libraryStatus === "checking" ||
    libraryStatus === "scanning";

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader
        title={t("menu.queue")}
        right={
          songs.length > 1 ? (
            reordering ? (
              <Pressable
                hitSlop={8}
                onPress={() => setReordering(false)}
                style={styles.done}
              >
                <AppText weight="semibold" color={colors.accent}>
                  {t("common.done")}
                </AppText>
              </Pressable>
            ) : (
              <IconButton
                name="swap-vertical"
                size={22}
                accessibilityLabel={t("reorder.title")}
                onPress={() => setReordering(true)}
              />
            )
          ) : null
        }
      />

      {loading ? (
        <SongListSkeleton rows={7} />
      ) : songs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="list" size={44} color={colors.accent} />
          <AppText variant="heading" align="center">
            {t("queue.emptyTitle")}
          </AppText>
          <AppText muted align="center">
            {t("queue.emptyText")}
          </AppText>
        </View>
      ) : reordering ? (
        <DraggableList
          data={entries}
          keyOf={(e) => e.key}
          rowHeight={ROW_HEIGHT}
          onMove={onDragMove}
          header={
            <AppText variant="caption" muted style={styles.summary}>
              {t("reorder.hint")}
            </AppText>
          }
          footerSpace={queueLength > 0 ? MINI_PLAYER_SPACE : 32}
          renderItem={(e, index) =>
            e.song ? (
              <ReorderSongRow song={e.song} active={index === currentIndex} />
            ) : (
              <AppText muted style={styles.summary}>
                {t("common.unknownSong")}
              </AppText>
            )
          }
        />
      ) : (
        <FlashList
          data={songs}
          keyExtractor={(s, i) => `${i}-${s.id}`}
          extraData={currentIndex}
          initialScrollIndex={Math.max(0, currentIndex - 1)}
          renderItem={({ item, index }) => (
            <View style={index < currentIndex ? styles.played : undefined}>
              <SongRow
                song={item}
                index={index}
                active={index === currentIndex}
                onPress={playAt}
                onLongPress={openMenu}
                trailing="more"
                onTrailingPress={openMenu}
              />
            </View>
          )}
          ListHeaderComponent={
            <AppText variant="caption" muted style={styles.summary}>
              {t("queue.summary", {
                songs: tn("songs", songs.length),
                next: tn("songs", upNext.length),
                time: formatTotalDuration(upNextMs),
              })}
            </AppText>
          }
          contentContainerStyle={{
            paddingBottom: queueLength > 0 ? MINI_PLAYER_SPACE : 32,
          }}
        />
      )}

      <MiniPlayer />

      <Overlay
        visible={menuSong !== undefined}
        onClose={() => setMenuIndex(null)}
      >
        <AppText variant="heading" numberOfLines={1} style={styles.menuTitle}>
          {menuSong?.title ?? ""}
        </AppText>
        {menuIndex !== null && menuIndex !== currentIndex ? (
          <MenuRow
            icon="play"
            label={t("queue.playNow")}
            onPress={() => {
              setMenuIndex(null);
              playAt(menuIndex);
            }}
          />
        ) : null}
        {menuIndex !== null && menuIndex > 0 ? (
          <MenuRow
            icon="arrow-up"
            label={t("queue.moveUp")}
            onPress={() => move(menuIndex, menuIndex - 1)}
          />
        ) : null}
        {menuIndex !== null && menuIndex < songs.length - 1 ? (
          <MenuRow
            icon="arrow-down"
            label={t("queue.moveDown")}
            onPress={() => move(menuIndex, menuIndex + 1)}
          />
        ) : null}
        {menuIndex !== null && menuIndex !== currentIndex ? (
          <MenuRow
            icon="remove-circle-outline"
            label={t("queue.remove")}
            danger
            onPress={() => remove(menuIndex)}
          />
        ) : null}
      </Overlay>

      <Toast />
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const colors = useTheme();
  const color = danger ? colors.danger : colors.textPrimary;
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={color} />
      <AppText color={color}>{label}</AppText>
    </Pressable>
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
    gap: 10,
    paddingHorizontal: 32,
  },
  summary: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  done: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  played: {
    opacity: 0.5,
  },
  menuTitle: {
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
});
