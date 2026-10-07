import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddToPlaylistSheet } from "../components/AddToPlaylistSheet";
import { AppText } from "../components/AppText";
import { ArtworkVolumeRing } from "../components/ArtworkVolumeRing";
import { IconButton } from "../components/IconButton";
import { MarqueeText } from "../components/MarqueeText";
import { Overlay } from "../components/Overlay";
import { PromptModal } from "../components/PromptModal";
import { SeekBar } from "../components/SeekBar";
import { SkipButton } from "../components/SkipButton";
import { SongInfoDialog } from "../components/SongInfoDialog";
import { showToast, Toast } from "../components/Toast";
import { equalizer, PlaytuneEngine, type EngineSong } from "../engine/engine";
import { useSleepCountdown } from "../hooks/use-countdown";
import { usePlaybackProgress } from "../hooks/use-playback-progress";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { initLibrary, useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import {
  addSongsToPlaylist,
  createPlaylist,
  loadPlaylists,
  toggleLiked,
  usePlaylists,
} from "../store/playlists";
import { formatCountdown, refreshSleepTimer } from "../store/sleep";

const SKIP_MS = 10_000;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** ♥ with a small "pop" when tapped. Muted when not liked, magenta when liked. */
function LikeButton({
  liked,
  onPress,
}: {
  liked: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Pressable
      hitSlop={10}
      accessibilityLabel={
        liked ? "Remove from Liked songs" : "Add to Liked songs"
      }
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        scale.set(
          withSequence(
            withTiming(1.35, { duration: 110 }),
            withSpring(1, { damping: 8, stiffness: 220 }),
          ),
        );
        onPress();
      }}
      style={styles.actionButton}
    >
      {({ pressed }) => (
        <Animated.View style={style}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={28}
            color={liked || pressed ? colors.accent : colors.textMuted}
          />
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Now Playing: spinning artwork with the volume arc, title, actions, seek bar and controls. */
export default function PlayerScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { t } = useT();

  const mediaId = usePlayer((s) => s.mediaId);
  const repeatMode = usePlayer((s) => s.repeatMode);
  const queueLength = usePlayer((s) => s.queueLength);
  const song = useLibrary((s) =>
    mediaId ? s.allById.get(mediaId) : undefined,
  );
  const liked = usePlaylists((s) =>
    s.playlists.find((p) => p.kind === "liked"),
  );
  const playlistsLoaded = usePlaylists((s) => s.loaded);
  const isLiked = !!(mediaId && liked?.songIds.includes(mediaId));
  const inPlaylist = usePlaylists((s) =>
    mediaId
      ? s.playlists.some(
          (p) => p.kind === "user" && p.songIds.includes(mediaId),
        )
      : false,
  );
  const [eqOn, setEqOn] = useState(false);

  const { positionMs, durationMs, isPlaying, resetKey, seekTo, seekBy, stop } =
    usePlaybackProgress();
  const sleepLeft = useSleepCountdown();

  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [addSong, setAddSong] = useState<EngineSong | null>(null);
  const [newPlaylistFor, setNewPlaylistFor] = useState<EngineSong | null>(null);

  // Opened from the notification on a cold start: make sure the data is there.
  useEffect(() => {
    initLibrary();
    if (!playlistsLoaded) loadPlaylists();
  }, [playlistsLoaded]);

  // The timer may have finished while the app was in the background; the EQ may have changed on its screen.
  useFocusEffect(
    useCallback(() => {
      refreshSleepTimer();
      equalizer
        .get()
        .then((info) => setEqOn(!!info.supported && !!info.enabled))
        .catch(() => {});
    }, []),
  );

  const diameter = Math.round(Math.min(width - 150, height * 0.3, 270));
  const loopOn = repeatMode === "one";

  const onLike = async () => {
    if (!song) return;
    const nowLiked = await toggleLiked(song.id);
    showToast(nowLiked ? t("toast.liked") : t("toast.unliked"));
  };

  const onShare = () => {
    setMenuOpen(false);
    if (!song) return;
    PlaytuneEngine.shareSong(song.id, song.mimeType, song.title).catch((e) => {
      if (__DEV__) console.log(`[share] failed — ${String(e)}`);
      showToast(t("toast.shareFailed"));
    });
  };

  const onCreateAndAdd = async (name: string) => {
    const target = newPlaylistFor;
    setNewPlaylistFor(null);
    if (!target) return;
    const id = await createPlaylist(name);
    await addSongsToPlaylist(id, [target.id]);
    showToast(t("toast.addedTo", { name }));
  };

  if (queueLength === 0 || !mediaId) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <IconButton
            name="chevron-back"
            size={26}
            accessibilityLabel="Back"
            onPress={goBack}
          />
        </View>
        <View style={styles.empty}>
          <Ionicons name="musical-notes" size={48} color={colors.accent} />
          <AppText variant="heading">{t("player.nothingTitle")}</AppText>
          <AppText muted align="center">
            {t("player.nothingText")}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          name="chevron-back"
          size={26}
          accessibilityLabel="Back"
          onPress={goBack}
        />
        <View style={styles.headerRight}>
          <IconButton
            family="mci"
            name="text-box-outline"
            size={24}
            accessibilityLabel={t("lyrics.title")}
            onPress={() => router.push("/lyrics")}
          />
          <IconButton
            family="mci"
            name="playlist-play"
            size={26}
            accessibilityLabel={t("menu.queue")}
            onPress={() => router.push("/queue")}
          />
          <IconButton
            name="ellipsis-vertical"
            size={22}
            accessibilityLabel="More"
            onPress={() => setMenuOpen(true)}
          />
        </View>
      </View>

      {/* Artwork + volume */}
      <View style={styles.center}>
        <ArtworkVolumeRing
          songId={mediaId}
          diameter={diameter}
          playing={isPlaying}
          resetKey={resetKey}
        />
      </View>

      {/* Title (slides when too long) + artist */}
      <View style={styles.titles}>
        <MarqueeText
          key={mediaId}
          text={song?.title ?? t("common.unknownSong")}
          textProps={{ size: 26, weight: "bold" }}
        />
        <AppText size={16} muted align="center" numberOfLines={1}>
          {song?.artist?.trim() ? song.artist : t("common.unknownArtist")}
        </AppText>
      </View>

      {/* EQ · Sleep timer · Add to playlist ……… ♥ */}
      <View style={styles.actions}>
        <View style={styles.actionGroup}>
          <Pressable
            hitSlop={8}
            accessibilityLabel="Equalizer"
            onPress={() => router.push("/equalizer")}
            style={styles.actionButton}
          >
            {({ pressed }) => (
              <MaterialCommunityIcons
                name="equalizer"
                size={28}
                color={eqOn || pressed ? colors.purple : colors.textMuted}
              />
            )}
          </Pressable>
          <Pressable
            hitSlop={8}
            accessibilityLabel="Sleep timer"
            onPress={() => router.push("/sleep-timer")}
            style={styles.actionButton}
          >
            {({ pressed }) => (
              <>
                <Ionicons
                  name={sleepLeft !== null ? "timer" : "timer-outline"}
                  size={28}
                  color={
                    sleepLeft !== null || pressed
                      ? colors.accent
                      : colors.textMuted
                  }
                />
                {sleepLeft !== null ? (
                  <AppText
                    size={10}
                    weight="semibold"
                    color={colors.accent}
                    style={styles.timerLabel}
                  >
                    {formatCountdown(sleepLeft)}
                  </AppText>
                ) : null}
              </>
            )}
          </Pressable>
          <Pressable
            hitSlop={8}
            accessibilityLabel="Add to playlist"
            onPress={() => song && setAddSong(song)}
            style={styles.actionButton}
          >
            {({ pressed }) => (
              <MaterialCommunityIcons
                name={inPlaylist ? "playlist-check" : "playlist-plus"}
                size={30}
                color={inPlaylist || pressed ? colors.accent : colors.textMuted}
              />
            )}
          </Pressable>
        </View>
        <LikeButton liked={isLiked} onPress={onLike} />
      </View>

      {/* −10 s · seek bar · +10 s */}
      <View style={styles.seekRow}>
        <SkipButton direction="back" onPress={() => seekBy(-SKIP_MS)} />
        <View style={styles.seekBar}>
          <SeekBar
            positionMs={positionMs}
            durationMs={durationMs}
            isPlaying={isPlaying}
            onSeek={seekTo}
            thumbColor={colors.accent}
            thickness={5}
          />
        </View>
        <SkipButton direction="forward" onPress={() => seekBy(SKIP_MS)} />
      </View>

      {/* Loop · Previous · Play/Pause · Next · Stop */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 26 }]}>
        <IconButton
          name="repeat"
          size={28}
          color={loopOn ? colors.accent : colors.textMuted}
          badge={loopOn ? "1" : undefined}
          accessibilityLabel={loopOn ? "Loop on" : "Loop off"}
          onPress={() =>
            PlaytuneEngine.setRepeatMode(loopOn ? "off" : "one").catch(() => {})
          }
        />
        <IconButton
          name="play-back"
          size={32}
          color={colors.accent}
          accessibilityLabel="Previous"
          onPress={() => PlaytuneEngine.previous().catch(() => {})}
        />
        <IconButton
          name={isPlaying ? "pause" : "play"}
          size={32}
          box="accent"
          round
          boxSize={70}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          style={isPlaying ? undefined : styles.playOffset}
          onPress={() => PlaytuneEngine.togglePlay().catch(() => {})}
        />
        <IconButton
          name="play-forward"
          size={32}
          color={colors.accent}
          accessibilityLabel="Next"
          onPress={() => PlaytuneEngine.next().catch(() => {})}
        />
        <IconButton
          name="stop"
          size={26}
          color={colors.textMuted}
          pressedColor={colors.accent}
          accessibilityLabel="Stop"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
            stop();
          }}
        />
      </View>

      {/* ⋮ menu */}
      <Overlay visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <AppText variant="heading" numberOfLines={1} style={styles.menuTitle}>
          {song?.title ?? ""}
        </AppText>
        <Pressable
          style={({ pressed }) => [
            styles.menuRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={onShare}
        >
          <Ionicons
            name="share-social-outline"
            size={22}
            color={colors.textPrimary}
          />
          <AppText>{t("player.share")}</AppText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.menuRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => {
            setMenuOpen(false);
            setInfoOpen(true);
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={colors.textPrimary}
          />
          <AppText>{t("player.songInfo")}</AppText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.menuRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => {
            setMenuOpen(false);
            router.push("/queue");
          }}
        >
          <MaterialCommunityIcons
            name="playlist-play"
            size={22}
            color={colors.textPrimary}
          />
          <AppText>{t("menu.queue")}</AppText>
        </Pressable>
      </Overlay>

      <SongInfoDialog
        song={song ?? null}
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
      <AddToPlaylistSheet
        song={addSong}
        showActions={false}
        onClose={() => setAddSong(null)}
        onNewPlaylist={(s) => {
          setAddSong(null);
          setNewPlaylistFor(s);
        }}
      />
      <PromptModal
        visible={newPlaylistFor !== null}
        title={t("common.newPlaylist")}
        placeholder={t("common.playlistName")}
        confirmLabel={t("common.create")}
        onSubmit={onCreateAndAdd}
        onCancel={() => setNewPlaylistFor(null)}
      />
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titles: {
    paddingHorizontal: 28,
    gap: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginTop: 18,
  },
  actionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  actionButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  timerLabel: {
    position: "absolute",
    bottom: -8,
  },
  seekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 18,
  },
  seekBar: {
    flex: 1,
    paddingTop: 16,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginTop: 18,
  },
  playOffset: {
    paddingLeft: 4,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
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
