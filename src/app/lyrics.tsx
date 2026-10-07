import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { Artwork } from "../components/Artwork";
import { ScreenHeader } from "../components/ScreenHeader";
import { readLyrics } from "../engine/engine";
import {
    currentLineIndex,
    parseLyrics,
    type ParsedLyrics,
} from "../engine/lyrics";
import { usePlaybackProgress } from "../hooks/use-playback-progress";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { useLibrary } from "../store/library";
import { usePlayer } from "../store/player";

/** Lyrics already read this session (song id → text, null = the file has none). */
const cache = new Map<string, string | null>();

type LoadState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "none" }
  | { kind: "ready"; lyrics: ParsedLyrics };

function LyricsSkeleton() {
  const colors = useTheme();
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[styles.skeleton, pulse]}>
      {[78, 62, 85, 54, 70, 60, 80].map((w, i) => (
        <View
          key={i}
          style={[
            styles.skeletonLine,
            { width: `${w}%`, backgroundColor: colors.surface },
          ]}
        />
      ))}
    </Animated.View>
  );
}

/**
 * Lyrics of the song that is playing, read from the song file.
 * Synced lyrics ([mm:ss] lines) follow the music: the current line lights up and stays in view;
 * tap a line to jump there. Plain lyrics are shown as text.
 */
export default function LyricsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useT();

  const mediaId = usePlayer((s) => s.mediaId);
  const song = useLibrary((s) =>
    mediaId ? s.allById.get(mediaId) : undefined,
  );
  const { positionMs, seekTo } = usePlaybackProgress();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const scrollRef = useRef<ScrollView>(null);
  const lineY = useRef<number[]>([]);
  const userScrolledAt = useRef(0);

  // Read the lyrics whenever the song changes.
  useEffect(() => {
    if (!mediaId) {
      setState({ kind: "none" });
      return;
    }
    let alive = true;
    lineY.current = [];
    const show = (text: string | null) => {
      if (!alive) return;
      setState(
        text ? { kind: "ready", lyrics: parseLyrics(text) } : { kind: "none" },
      );
    };
    if (cache.has(mediaId)) {
      show(cache.get(mediaId) ?? null);
      return;
    }
    setState({ kind: "loading" });
    readLyrics(mediaId).then((text) => {
      if (text === undefined) {
        if (alive) setState({ kind: "unsupported" });
        return;
      }
      cache.set(mediaId, text);
      show(text);
      if (__DEV__ && text) {
        const parsed = parseLyrics(text);
        console.log(
          `[lyrics] ${parsed.synced ? "synced" : "plain"}, ${parsed.lines.length} lines`,
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [mediaId]);

  const lyrics = state.kind === "ready" ? state.lyrics : null;
  const current = useMemo(
    () =>
      lyrics?.synced ? currentLineIndex(lyrics.lines, positionMs + 250) : -1,
    [lyrics, positionMs],
  );

  // Keep the current line about a third from the top (unless the user scrolled in the last 4 s).
  useEffect(() => {
    if (!lyrics?.synced || current < 0) return;
    if (Date.now() - userScrolledAt.current < 4000) return;
    const y = lineY.current[current];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, y - height * 0.3),
      animated: true,
    });
  }, [current, lyrics, height]);

  const title = song?.title ?? t("common.unknownSong");
  const artist = song?.artist?.trim() ? song.artist : t("common.unknownArtist");

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title={t("lyrics.title")} />

      <View style={styles.songRow}>
        <Artwork songId={mediaId} size={48} radius={12} />
        <View style={styles.songTexts}>
          <AppText weight="semibold" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {artist}
          </AppText>
        </View>
        {lyrics?.synced ? (
          <View
            style={[styles.badge, { backgroundColor: colors.surfaceRaised }]}
          >
            <Ionicons name="pulse" size={14} color={colors.accent} />
            <AppText variant="label" color={colors.accent}>
              {t("lyrics.synced")}
            </AppText>
          </View>
        ) : null}
      </View>

      {state.kind === "loading" ? <LyricsSkeleton /> : null}

      {state.kind === "none" || state.kind === "unsupported" ? (
        <View style={styles.center}>
          <Ionicons
            name="document-text-outline"
            size={46}
            color={colors.purple}
          />
          <AppText variant="heading" align="center">
            {state.kind === "unsupported"
              ? t("lyrics.updateTitle")
              : t("lyrics.noneTitle")}
          </AppText>
          <AppText muted align="center">
            {state.kind === "unsupported"
              ? t("lyrics.updateText")
              : t("lyrics.noneText")}
          </AppText>
        </View>
      ) : null}

      {lyrics ? (
        <ScrollView
          ref={scrollRef}
          onScrollBeginDrag={() => {
            userScrolledAt.current = Date.now();
          }}
          contentContainerStyle={[
            styles.lines,
            { paddingBottom: insets.bottom + height * 0.4 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {lyrics.lines.map((line, i) => {
            if (!lyrics.synced) {
              return (
                <AppText
                  key={i}
                  size={19}
                  weight="medium"
                  style={line.text ? styles.plainLine : styles.gap}
                >
                  {line.text || " "}
                </AppText>
              );
            }
            const isCurrent = i === current;
            const isPast = i < current;
            return (
              <Pressable
                key={i}
                onLayout={(e) => {
                  lineY.current[i] = e.nativeEvent.layout.y;
                }}
                onPress={() => {
                  if (line.timeMs === null) return;
                  if (__DEV__) console.log(`[lyrics] jump to line ${i + 1}`);
                  userScrolledAt.current = 0;
                  seekTo(line.timeMs);
                }}
                style={styles.syncedLine}
              >
                <AppText
                  size={isCurrent ? 24 : 20}
                  weight={isCurrent ? "bold" : "semibold"}
                  color={
                    isCurrent
                      ? colors.accent
                      : isPast
                        ? colors.textFaint
                        : colors.textMuted
                  }
                >
                  {line.text || "♪"}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  songTexts: {
    flex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  skeleton: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 18,
  },
  skeletonLine: {
    height: 18,
    borderRadius: 9,
  },
  lines: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  plainLine: {
    marginBottom: 6,
  },
  gap: {
    height: 18,
  },
  syncedLine: {
    paddingVertical: 8,
  },
});
