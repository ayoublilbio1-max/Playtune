import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { ScreenHeader } from "../components/ScreenHeader";
import { showToast, Toast } from "../components/Toast";
import { WHEEL_ITEM, WheelPicker } from "../components/WheelPicker";
import { useSleepCountdown } from "../hooks/use-countdown";
import { useTheme } from "../hooks/use-theme";
import {
    cancelSleepTimer,
    formatCountdown,
    refreshSleepTimer,
    startSleepTimer,
} from "../store/sleep";

const PRESETS = [15, 30, 45, 60];
const EXTEND_MS = 5 * 60 * 1000;

function describe(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : "", s ? `${s} s` : ""]
    .filter(Boolean)
    .join(" ");
}

/** Pulsing boxes in place of the wheels for the first frame (the screen opens at once, the wheels follow). */
function WheelsSkeleton() {
  const colors = useTheme();
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[styles.wheels, pulse]}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.wheelGhost, { backgroundColor: colors.surfaceRaised }]}
        />
      ))}
    </Animated.View>
  );
}

/**
 * Sleep timer screen: hours : minutes : seconds wheels with 15/30/45/60 min shortcuts.
 * While a timer runs: the countdown, "+5 min" and "Turn off".
 * The real timer runs in the engine's background service (fades out the last 10 s, then pauses).
 */
export default function SleepTimerScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const remaining = useSleepCountdown();
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [wheelsReady, setWheelsReady] = useState(false);

  useEffect(() => {
    refreshSleepTimer();
    // Let the screen appear first; the 144 wheel rows are built on the next frames.
    const start = Date.now();
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        setWheelsReady(true);
        if (__DEV__)
          console.log(
            `[sleep] wheels shown ${Date.now() - start}ms after open`,
          );
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  const total = hours * 3600 + minutes * 60 + seconds;

  const start = async () => {
    if (total === 0) return;
    await startSleepTimer(total * 1000);
    showToast(`Music stops in ${describe(total)}`);
  };

  const extend = async () => {
    if (remaining === null) return;
    await startSleepTimer(remaining + EXTEND_MS);
    showToast("5 minutes added");
  };

  const turnOff = async () => {
    await cancelSleepTimer();
    setHours(0);
    setMinutes(0);
    setSeconds(0);
    showToast("Sleep timer off");
  };

  const pickPreset = (min: number) => {
    setHours(Math.floor(min / 60));
    setMinutes(min % 60);
    setSeconds(0);
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title="Sleep timer" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
      >
        {remaining !== null ? (
          <View style={styles.active}>
            <View
              style={[
                styles.ring,
                { borderColor: colors.accent, backgroundColor: colors.surface },
              ]}
            >
              <Ionicons name="moon" size={26} color={colors.purple} />
              <AppText
                size={44}
                weight="bold"
                color={colors.accent}
                style={styles.countdown}
              >
                {formatCountdown(remaining)}
              </AppText>
              <AppText variant="caption" muted>
                until the music stops
              </AppText>
            </View>
            <AppText variant="caption" muted align="center" style={styles.note}>
              The music fades out during the last 10 seconds, then pauses. The
              timer keeps running when you leave the app.
            </AppText>
            <View style={styles.buttons}>
              <Pressable
                onPress={extend}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: colors.surfaceRaised,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="add" size={20} color={colors.textPrimary} />
                <AppText weight="semibold">5 min</AppText>
              </Pressable>
              <Pressable
                onPress={turnOff}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: colors.danger,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <AppText weight="semibold" color={colors.white}>
                  Turn off
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <AppText variant="heading" align="center" style={styles.title}>
              Stop music after
            </AppText>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.units}>
                {["hours", "min", "sec"].map((u) => (
                  <AppText
                    key={u}
                    variant="label"
                    muted
                    align="center"
                    style={styles.unit}
                  >
                    {u}
                  </AppText>
                ))}
              </View>
              {wheelsReady ? (
                <View style={styles.wheels}>
                  <WheelPicker count={24} value={hours} onChange={setHours} />
                  <AppText size={30} weight="bold" style={styles.colon}>
                    :
                  </AppText>
                  <WheelPicker
                    count={60}
                    value={minutes}
                    onChange={setMinutes}
                  />
                  <AppText size={30} weight="bold" style={styles.colon}>
                    :
                  </AppText>
                  <WheelPicker
                    count={60}
                    value={seconds}
                    onChange={setSeconds}
                  />
                </View>
              ) : (
                <WheelsSkeleton />
              )}
            </View>

            <View style={styles.presets}>
              {PRESETS.map((min) => {
                const selected = total === min * 60;
                return (
                  <Pressable
                    key={min}
                    onPress={() => pickPreset(min)}
                    style={({ pressed }) => [
                      styles.preset,
                      {
                        backgroundColor: selected
                          ? colors.accent
                          : colors.surface,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="alarm-outline"
                      size={20}
                      color={selected ? colors.white : colors.textMuted}
                    />
                    <AppText
                      weight="medium"
                      color={selected ? colors.white : undefined}
                    >
                      {min}m
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              disabled={total === 0}
              onPress={start}
              style={({ pressed }) => [
                styles.startButton,
                {
                  backgroundColor: colors.accent,
                  opacity: total === 0 ? 0.4 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="moon" size={18} color={colors.white} />
              <AppText weight="semibold" color={colors.white}>
                {total === 0 ? "Pick a time" : `Start · ${describe(total)}`}
              </AppText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Toast />
    </View>
  );
}

const WHEEL_WIDTH = 76;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  title: {
    marginBottom: 14,
  },
  card: {
    borderRadius: 24,
    paddingVertical: 16,
  },
  units: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6 + 14 + 6,
    marginBottom: 6,
  },
  unit: {
    width: WHEEL_WIDTH,
  },
  wheels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: WHEEL_ITEM * 3,
  },
  wheelGhost: {
    width: WHEEL_WIDTH,
    height: WHEEL_ITEM,
    borderRadius: 14,
    marginHorizontal: 10,
  },
  colon: {
    marginTop: -4,
    height: WHEEL_ITEM,
    textAlignVertical: "center",
  },
  presets: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  preset: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  startButton: {
    marginTop: 22,
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  active: {
    alignItems: "center",
    paddingTop: 20,
  },
  ring: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  countdown: {
    marginTop: 6,
  },
  note: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 26,
    alignSelf: "stretch",
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});
