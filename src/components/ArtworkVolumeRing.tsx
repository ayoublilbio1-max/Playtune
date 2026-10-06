import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedProps,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import { PlaytuneEngine, type VolumeInfo } from "../engine/engine";
import { useArtwork } from "../hooks/use-artwork";
import { useSpin } from "../hooks/use-spin";
import { useTheme } from "../hooks/use-theme";
import { ArtworkPlaceholder } from "./ArtworkPlaceholder";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The volume arc goes around the lower part of the circle:
// from just above the left side (190°), through the bottom, to just above the right side (-10°).
// Angles are clockwise from 3 o'clock (screen coordinates, y goes down).
const START_DEG = 190;
const SWEEP_DEG = 200;
const RING_GAP = 18; // space between the artwork and the arc
const STROKE = 8;
const TOUCH_BAND = 34; // how far from the arc a finger still grabs it

type Props = {
  songId: string | null;
  diameter: number;
  playing: boolean;
  /** Increase to bring the artwork back to its start angle (Stop). */
  resetKey: number;
};

/**
 * The Player screen's centerpiece: the round artwork (spins while playing) and, around its lower half,
 * the phone's media volume. Drag along the arc to change the volume (no phone volume bar appears).
 * The arc also follows the phone's volume buttons. 🔇 mutes/unmutes, 🔊 is one step louder.
 */
export function ArtworkVolumeRing({
  songId,
  diameter,
  playing,
  resetKey,
}: Props) {
  const colors = useTheme();
  const art = useArtwork(songId, 600);
  const spin = useSpin(playing, resetKey, 20000);
  const gradientId = `vol${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const radius = diameter / 2 + RING_GAP;
  const size = radius * 2 + STROKE + 56; // room for the two icons
  const center = size / 2;
  const arcLength = (radius * SWEEP_DEG * Math.PI) / 180;

  const point = (deg: number, r = radius) => {
    const a = (deg * Math.PI) / 180;
    return { x: center + r * Math.cos(a), y: center + r * Math.sin(a) };
  };
  const start = point(START_DEG);
  const end = point(START_DEG - SWEEP_DEG);
  // Counter-clockwise on screen (sweep-flag 0), large arc (200° > 180°).
  const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 0 ${end.x} ${end.y}`;
  const muteIcon = point(START_DEG + 18, radius + 6);
  const loudIcon = point(START_DEG - SWEEP_DEG - 18, radius + 6);

  // ---------- Volume state ----------
  const [info, setInfo] = useState<VolumeInfo | null>(null);
  const level = useSharedValue(0); // 0..1 shown on the arc
  const dragging = useSharedValue(false);
  const lastIndex = useSharedValue(-1);
  const beforeMute = useRef<number | null>(null);
  const infoRef = useRef<VolumeInfo | null>(null);

  const toRatio = (v: VolumeInfo) =>
    v.max > v.min ? (v.volume - v.min) / (v.max - v.min) : 0;

  const applyInfo = useCallback(
    (v: VolumeInfo, animate: boolean) => {
      infoRef.current = v;
      setInfo(v);
      if (dragging.get()) return;
      const r = toRatio(v);
      level.set(animate ? withTiming(r, { duration: 180 }) : r);
    },
    [dragging, level],
  );

  useEffect(() => {
    PlaytuneEngine.getVolume()
      .then((v) => {
        applyInfo(v, false);
        if (__DEV__)
          console.log(
            `[volume] ${v.volume}/${v.max} (min ${v.min}, fixed ${v.fixed})`,
          );
      })
      .catch((e) => {
        if (__DEV__) console.log(`[volume] read failed — ${String(e)}`);
      });
    // Phone volume buttons → move the arc.
    const sub = PlaytuneEngine.addListener("onVolumeChange", (v) =>
      applyInfo(v, true),
    );
    return () => sub.remove();
  }, [applyInfo]);

  const setVolume = useCallback((index: number) => {
    PlaytuneEngine.setVolume(index)
      .then((v) => {
        infoRef.current = v;
        setInfo(v);
      })
      .catch(() => {});
  }, []);

  const onDragEnd = useCallback(
    (ratio: number) => {
      const v = infoRef.current;
      if (!v) return;
      const index = Math.round(v.min + ratio * (v.max - v.min));
      if (__DEV__) console.log(`[volume] set by arc → ${index}/${v.max}`);
      setVolume(index);
      // Snap the arc to the real step.
      level.set(
        withTiming(v.max > v.min ? (index - v.min) / (v.max - v.min) : 0, {
          duration: 160,
        }),
      );
    },
    [level, setVolume],
  );

  const onTouchStart = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const steps = info ? info.max - info.min : 15;
  const minIndex = info?.min ?? 0;
  const disabled = !info || info.fixed;

  const gesture = useMemo(() => {
    // Angle of a touch → 0..1 along the arc, or -1 if the finger is not on the arc.
    // `strict` (first touch only): the finger must be near the arc line and not on the 🔇/🔊 icons.
    const ratioAt = (x: number, y: number, strict: boolean) => {
      "worklet";
      const dx = x - center;
      const dy = y - center;
      if (
        strict &&
        Math.abs(Math.sqrt(dx * dx + dy * dy) - radius) > TOUCH_BAND
      )
        return -1;
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI; // (-180, 180], clockwise from 3 o'clock
      if (deg < -90) deg += 360; // now (-90, 270]: the left-upper side comes after 180°
      const endDeg = START_DEG - SWEEP_DEG; // -10
      if (deg > START_DEG) {
        if (strict && deg > START_DEG + 12) return -1; // above the left end (🔇 icon area)
        return 0;
      }
      if (deg < endDeg) {
        if (strict && deg < endDeg - 12) return -1; // above the right end (🔊 icon area)
        return 1;
      }
      return (START_DEG - deg) / SWEEP_DEG;
    };

    return Gesture.Pan()
      .enabled(!disabled)
      .manualActivation(true)
      .onTouchesDown((e, manager) => {
        "worklet";
        const t = e.allTouches[0];
        if (!t || ratioAt(t.x, t.y, true) < 0) {
          manager.fail();
          return;
        }
        manager.activate();
      })
      .onStart((e) => {
        "worklet";
        dragging.set(true);
        const r = ratioAt(e.x, e.y, false);
        level.set(r);
        lastIndex.set(Math.round(minIndex + r * steps));
        scheduleOnRN(onTouchStart);
      })
      .onUpdate((e) => {
        "worklet";
        const r = ratioAt(e.x, e.y, false);
        level.set(r);
        const index = Math.round(minIndex + r * steps);
        if (index !== lastIndex.get()) {
          lastIndex.set(index);
          scheduleOnRN(setVolume, index); // live: you hear it while dragging
        }
      })
      .onFinalize(() => {
        "worklet";
        if (!dragging.get()) return;
        dragging.set(false);
        scheduleOnRN(onDragEnd, level.get());
      });
  }, [
    center,
    radius,
    disabled,
    steps,
    minIndex,
    dragging,
    level,
    lastIndex,
    onTouchStart,
    setVolume,
    onDragEnd,
  ]);

  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - level.get()),
    strokeOpacity: level.get() < 0.004 ? 0 : 1,
  }));

  const muted = !!info && info.volume <= info.min;

  const onMutePress = () => {
    if (!info || disabled) return;
    Haptics.selectionAsync().catch(() => {});
    if (muted) {
      const back =
        beforeMute.current ??
        Math.round(info.min + (info.max - info.min) * 0.4);
      setVolume(back);
      level.set(
        withTiming((back - info.min) / Math.max(1, info.max - info.min), {
          duration: 200,
        }),
      );
    } else {
      beforeMute.current = info.volume;
      setVolume(info.min);
      level.set(withTiming(0, { duration: 200 }));
    }
  };

  const onLouderPress = () => {
    if (!info || disabled) return;
    Haptics.selectionAsync().catch(() => {});
    const next = Math.min(info.max, info.volume + 1);
    setVolume(next);
    level.set(
      withTiming((next - info.min) / Math.max(1, info.max - info.min), {
        duration: 200,
      }),
    );
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: size, height: size }} collapsable={false}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.violet} />
              <Stop offset="0.6" stopColor={colors.purple} />
              <Stop offset="1" stopColor={colors.accent} />
            </LinearGradient>
          </Defs>
          <Path
            d={arcPath}
            stroke={colors.surfaceRaised}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
          <AnimatedPath
            d={arcPath}
            stroke={`url(#${gradientId})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${arcLength} ${arcLength}`}
            animatedProps={fillProps}
          />
        </Svg>

        {/* Artwork (spins while playing) */}
        <Animated.View
          style={[
            styles.art,
            {
              width: diameter,
              height: diameter,
              borderRadius: diameter / 2,
              left: center - diameter / 2,
              top: center - diameter / 2,
            },
            spin,
          ]}
        >
          {art ? (
            <Image
              source={{ uri: art }}
              style={{ width: diameter, height: diameter }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <ArtworkPlaceholder
              width={diameter}
              radius={diameter / 2}
              iconScale={0.34}
            />
          )}
        </Animated.View>

        <Pressable
          hitSlop={12}
          onPress={onMutePress}
          style={[
            styles.icon,
            {
              left: muteIcon.x - 14,
              top: muteIcon.y - 14,
              opacity: disabled ? 0.35 : 1,
            },
          ]}
        >
          <Ionicons
            name={muted ? "volume-mute" : "volume-mute-outline"}
            size={22}
            color={colors.accent}
          />
        </Pressable>
        <Pressable
          hitSlop={12}
          onPress={onLouderPress}
          style={[
            styles.icon,
            {
              left: loudIcon.x - 14,
              top: loudIcon.y - 14,
              opacity: disabled ? 0.35 : 1,
            },
          ]}
        >
          <Ionicons
            name="volume-high-outline"
            size={22}
            color={colors.accent}
          />
        </Pressable>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  art: {
    position: "absolute",
    overflow: "hidden",
  },
  icon: {
    position: "absolute",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
