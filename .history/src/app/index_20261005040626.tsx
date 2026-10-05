import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { ConfirmModal } from "../components/ConfirmModal";
import {
  PlaytuneEngine,
  displayArtist,
  formatTime,
  hasAudioPermission,
  requestAudioPermission,
  scanLibrary,
  toQueueItem,
  type EngineSong,
  type EqualizerInfo,
  type PlayerState,
  type Progress,
  type RepeatMode,
} from "../engine/engine";
import { useTheme } from "../hooks/use-theme";

/**
 * v1.0.0 — ENGINE TEST SCREEN.
 * Its only job is to prove every native part of the first build works:
 * permission, scan, artwork, queue, background playback, notification, repeat,
 * shuffle, equalizer. The real Home screen and tabs replace it next (JS only).
 */

type Status =
  | "checking"
  | "need-permission"
  | "blocked"
  | "scanning"
  | "ready"
  | "error";

const artCache = new Map<string, string | null>();

function useArtwork(id: string, size = 128) {
  const [uri, setUri] = useState<string | null>(artCache.get(id) ?? null);

  useEffect(() => {
    let alive = true;
    if (artCache.has(id)) {
      setUri(artCache.get(id) ?? null);
      return;
    }
    setUri(null);
    PlaytuneEngine.getArtwork(id, size)
      .then((u) => {
        artCache.set(id, u);
        if (alive) setUri(u);
      })
      .catch((e) => {
        if (__DEV__) console.log(`[artwork] failed for ${id}: ${String(e)}`);
      });
    return () => {
      alive = false;
    };
  }, [id, size]);

  return uri;
}

const SongRow = memo(function SongRow({
  song,
  active,
  onPress,
}: {
  song: EngineSong;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  const art = useArtwork(song.id);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: active ? colors.surface : "transparent",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.art, { backgroundColor: colors.surfaceRaised }]}>
        {art ? (
          <Image
            source={{ uri: art }}
            style={styles.artImage}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <Ionicons name="musical-note" size={20} color={colors.textFaint} />
        )}
      </View>
      <View style={styles.rowText}>
        <AppText
          numberOfLines={1}
          weight="medium"
          color={active ? colors.accent : undefined}
        >
          {song.title}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {displayArtist(song.artist)} · {formatTime(song.durationMs)}
        </AppText>
      </View>
    </Pressable>
  );
});

function IconButton({
  name,
  onPress,
  size = 24,
  color,
  big,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  big?: boolean;
  badge?: string;
}) {
  const colors = useTheme();
  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        big
          ? [styles.bigButton, { backgroundColor: colors.accent }]
          : styles.iconButton,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.textPrimary} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <AppText size={9} weight="bold">
            {badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function EngineTestScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>("checking");
  const [errorText, setErrorText] = useState("");
  const [songs, setSongs] = useState<EngineSong[]>([]);
  const [scanMs, setScanMs] = useState(0);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [progress, setProgress] = useState<Progress>({
    positionMs: 0,
    durationMs: 0,
    bufferedMs: 0,
  });
  const [eq, setEq] = useState<EqualizerInfo | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const barWidth = useRef(1);

  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const current = player?.mediaId ? songById.get(player.mediaId) : undefined;

  const loadSongs = useCallback(async () => {
    setStatus("scanning");
    try {
      const start = Date.now();
      const list = await scanLibrary();
      setScanMs(Date.now() - start);
      setSongs(list);
      setStatus("ready");
    } catch (e) {
      if (__DEV__) console.log(`[home] scan failed: ${String(e)}`);
      setErrorText(String(e));
      setStatus("error");
    }
  }, []);

  // First launch: check permission, scan, and pick up a player that may already be running.
  useEffect(() => {
    if (__DEV__)
      console.log(
        "[home] engine info",
        JSON.stringify(PlaytuneEngine.getEngineInfo()),
      );
    (async () => {
      const granted = await hasAudioPermission();
      if (!granted) {
        setStatus("need-permission");
        return;
      }
      await loadSongs();
      try {
        const state = await PlaytuneEngine.getState();
        setPlayer(state);
        if (__DEV__)
          console.log("[home] live player state", JSON.stringify(state));
        if (state.queueLength === 0) {
          const last = await PlaytuneEngine.getLastSession();
          if (__DEV__)
            console.log(
              `[home] last session: ${last ? `${last.mediaIds.length} songs, index ${last.index}` : "none"}`,
            );
        }
      } catch (e) {
        if (__DEV__) console.log(`[home] getState failed: ${String(e)}`);
      }
    })();
  }, [loadSongs]);

  // Engine events
  useEffect(() => {
    const subs = [
      PlaytuneEngine.addListener("onPlayerState", (s) => setPlayer(s)),
      PlaytuneEngine.addListener("onTrackChange", (e) => {
        if (__DEV__) console.log(`[player] track → ${e.mediaId} (${e.reason})`);
      }),
      PlaytuneEngine.addListener("onError", (e) => {
        if (__DEV__)
          console.log(`[player] error ${e.code} on ${e.mediaId}: ${e.message}`);
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  // Progress polling while something is loaded
  useEffect(() => {
    if (!player || player.queueLength === 0) return;
    const id = setInterval(() => {
      PlaytuneEngine.getProgress()
        .then(setProgress)
        .catch(() => {});
    }, 500);
    return () => clearInterval(id);
  }, [player?.queueLength]);

  const onAllow = async () => {
    const result = await requestAudioPermission();
    if (result === "granted") await loadSongs();
    else setStatus(result === "blocked" ? "blocked" : "need-permission");
  };

  const playFrom = useCallback(
    (index: number) => {
      const start = Date.now();
      PlaytuneEngine.setQueue(songs.map(toQueueItem), index, 0, true)
        .then(() => {
          if (__DEV__)
            console.log(
              `[queue] ${songs.length} songs sent, start ${index}, in ${Date.now() - start}ms`,
            );
        })
        .catch((e) => {
          if (__DEV__) console.log(`[queue] setQueue failed: ${String(e)}`);
        });
    },
    [songs],
  );

  const cycleRepeat = () => {
    const next: Record<RepeatMode, RepeatMode> = {
      off: "all",
      all: "one",
      one: "off",
    };
    PlaytuneEngine.setRepeatMode(next[player?.repeatMode ?? "off"]).catch(
      () => {},
    );
  };

  const loadEq = async () => {
    const info = await PlaytuneEngine.getEqualizer();
    if (__DEV__) console.log("[eq] info", JSON.stringify(info));
    setEq(info);
  };

  const nextPreset = async () => {
    if (!eq?.presets?.length) return;
    const index = ((eq.preset ?? -1) + 1) % eq.presets.length;
    setEq(await PlaytuneEngine.usePreset(index));
  };

  const onSeek = (e: GestureResponderEvent) => {
    if (!progress.durationMs) return;
    const ratio = Math.min(
      1,
      Math.max(0, e.nativeEvent.locationX / barWidth.current),
    );
    PlaytuneEngine.seekTo(ratio * progress.durationMs).catch(() => {});
  };

  const ratio = progress.durationMs
    ? progress.positionMs / progress.durationMs
    : 0;

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={styles.header}>
        <AppText variant="title">Playtune</AppText>
        <AppText variant="caption" muted>
          v1.0.0 · engine test
          {status === "ready"
            ? ` · ${songs.length} songs · scan ${scanMs}ms`
            : ""}
        </AppText>
      </View>

      {status === "checking" || status === "scanning" ? (
        <View style={styles.center}>
          <AppText muted>
            {status === "checking"
              ? "Checking access…"
              : "Scanning your songs…"}
          </AppText>
        </View>
      ) : null}

      {status === "need-permission" || status === "blocked" ? (
        <View style={styles.center}>
          <Ionicons name="musical-notes" size={48} color={colors.accent} />
          <AppText variant="heading" align="center">
            Allow access to your music
          </AppText>
          <AppText muted align="center">
            {status === "blocked"
              ? "Access was denied. Turn it on in Settings › Apps › Playtune › Permissions."
              : "Playtune needs it to find the songs on your phone."}
          </AppText>
          {status === "need-permission" ? (
            <Pressable
              style={[styles.primary, { backgroundColor: colors.accent }]}
              onPress={onAllow}
            >
              <AppText weight="semibold">Allow</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {status === "error" ? (
        <View style={styles.center}>
          <AppText muted align="center">
            {errorText}
          </AppText>
        </View>
      ) : null}

      {status === "ready" ? (
        <>
          {/* Equalizer test strip */}
          <View style={[styles.eqStrip, { backgroundColor: colors.surface }]}>
            {eq === null ? (
              <Pressable onPress={loadEq}>
                <AppText weight="medium" color={colors.cyan}>
                  Test equalizer
                </AppText>
              </Pressable>
            ) : !eq.supported ? (
              <AppText muted>Equalizer not supported on this phone</AppText>
            ) : (
              <>
                <Pressable
                  onPress={async () =>
                    setEq(await PlaytuneEngine.setEqualizerEnabled(!eq.enabled))
                  }
                >
                  <AppText
                    weight="semibold"
                    color={eq.enabled ? colors.accent : colors.textMuted}
                  >
                    EQ {eq.enabled ? "ON" : "OFF"}
                  </AppText>
                </Pressable>
                <Pressable onPress={nextPreset} style={styles.eqItem}>
                  <AppText numberOfLines={1} muted={!eq.enabled}>
                    {(eq.preset ?? -1) >= 0
                      ? eq.presets?.[eq.preset ?? 0]
                      : "Custom"}{" "}
                    ›
                  </AppText>
                </Pressable>
                {eq.bassSupported ? (
                  <Pressable
                    onPress={async () =>
                      setEq(
                        await PlaytuneEngine.setBassBoost(
                          ((eq.bassStrength ?? 0) + 250) % 1250,
                        ),
                      )
                    }
                  >
                    <AppText muted={!eq.enabled}>
                      Bass {Math.round((eq.bassStrength ?? 0) / 10)}%
                    </AppText>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>

          <View style={styles.list}>
            <FlashList
              data={songs}
              keyExtractor={(s) => s.id}
              extraData={player?.mediaId}
              renderItem={({ item, index }) => (
                <SongRow
                  song={item}
                  active={item.id === player?.mediaId}
                  onPress={() => playFrom(index)}
                />
              )}
              contentContainerStyle={{ paddingBottom: 170 }}
              ListEmptyComponent={
                <AppText muted align="center" style={{ marginTop: 40 }}>
                  No songs found on this phone.
                </AppText>
              }
            />
          </View>
        </>
      ) : null}

      {/* Mini player */}
      {player && player.queueLength > 0 ? (
        <View
          style={[
            styles.mini,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              bottom: insets.bottom + 10,
            },
          ]}
        >
          <Pressable onPress={() => router.push("/player")}>
            <AppText weight="semibold" numberOfLines={1}>
              {current?.title ?? "Unknown song"}
            </AppText>
            <AppText variant="caption" muted numberOfLines={1}>
              {displayArtist(current?.artist)} ·{" "}
              {formatTime(progress.positionMs)} /{" "}
              {formatTime(progress.durationMs)}
            </AppText>
          </Pressable>

          <Pressable
            onPress={onSeek}
            onLayout={(e) =>
              (barWidth.current = e.nativeEvent.layout.width || 1)
            }
            style={styles.barTouch}
          >
            <View
              style={[styles.bar, { backgroundColor: colors.surfaceRaised }]}
            >
              <View
                style={[
                  styles.barFill,
                  { width: `${ratio * 100}%`, backgroundColor: colors.accent },
                ]}
              />
            </View>
          </Pressable>

          <View style={styles.controls}>
            <IconButton
              name="shuffle"
              color={player.shuffle ? colors.accent : colors.textMuted}
              onPress={() =>
                PlaytuneEngine.setShuffle(!player.shuffle).catch(() => {})
              }
            />
            <IconButton
              name="play-skip-back"
              onPress={() => PlaytuneEngine.previous().catch(() => {})}
            />
            <IconButton
              big
              name={player.isPlaying ? "pause" : "play"}
              size={28}
              onPress={() => PlaytuneEngine.togglePlay().catch(() => {})}
            />
            <IconButton
              name="play-skip-forward"
              onPress={() => PlaytuneEngine.next().catch(() => {})}
            />
            <IconButton
              name="repeat"
              color={
                player.repeatMode === "off" ? colors.textMuted : colors.accent
              }
              badge={player.repeatMode === "one" ? "1" : undefined}
              onPress={cycleRepeat}
            />
            <IconButton
              name="stop-circle-outline"
              color={colors.textMuted}
              onPress={() => setConfirmStop(true)}
            />
          </View>
        </View>
      ) : null}

      <ConfirmModal
        visible={confirmStop}
        icon="stop-circle-outline"
        title="Stop playback?"
        message="The queue stays, you can press play again later."
        confirmLabel="Stop"
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => {
          setConfirmStop(false);
          PlaytuneEngine.stop().catch(() => {});
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
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
  eqStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  eqItem: { flex: 1 },
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  art: {
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  artImage: { width: "100%", height: "100%" },
  rowText: { flex: 1 },
  mini: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  barTouch: { paddingVertical: 10 },
  bar: { height: 4, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bigButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
});
