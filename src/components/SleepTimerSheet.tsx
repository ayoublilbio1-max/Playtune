import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useSleepCountdown } from "../hooks/use-countdown";
import { useTheme } from "../hooks/use-theme";
import {
    cancelSleepTimer,
    formatCountdown,
    startSleepTimer,
} from "../store/sleep";
import { AppText } from "./AppText";
import { Overlay } from "./Overlay";
import { showToast } from "./Toast";
import { WHEEL_ITEM, WheelPicker } from "./WheelPicker";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const PRESETS = [15, 30, 45, 60];

function describe(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : "", s ? `${s} s` : ""]
    .filter(Boolean)
    .join(" ");
}

/** "Stop music after": hours : minutes : seconds wheels, 15/30/45/60 min shortcuts, Cancel / Start. */
export function SleepTimerSheet({ visible, onClose }: Props) {
  const colors = useTheme();
  const remaining = useSleepCountdown();
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Fresh wheels each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setHours(0);
    setMinutes(0);
    setSeconds(0);
  }, [visible]);

  const total = hours * 3600 + minutes * 60 + seconds;

  const start = async () => {
    if (total === 0) return;
    onClose();
    await startSleepTimer(total * 1000);
    showToast(`Music stops in ${describe(total)}`);
  };

  const turnOff = async () => {
    onClose();
    await cancelSleepTimer();
    showToast("Sleep timer off");
  };

  const pickPreset = (min: number) => {
    setHours(Math.floor(min / 60));
    setMinutes(min % 60);
    setSeconds(0);
  };

  return (
    <Overlay visible={visible} onClose={onClose}>
      {remaining !== null ? (
        <View style={styles.activeBox}>
          <AppText variant="heading">Music stops in</AppText>
          <AppText
            size={44}
            weight="bold"
            color={colors.accent}
            style={styles.countdown}
          >
            {formatCountdown(remaining)}
          </AppText>
          <AppText variant="caption" muted align="center">
            The music fades out during the last 10 seconds, then pauses.
          </AppText>
          <View style={styles.buttons}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: colors.surfaceRaised,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <AppText weight="semibold">Close</AppText>
            </Pressable>
            <Pressable
              onPress={turnOff}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.danger, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <AppText weight="semibold" color={colors.white}>
                Turn off timer
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : (
        <View>
          <AppText variant="heading" style={styles.title}>
            Stop music after
          </AppText>

          <View style={styles.wheels}>
            <WheelPicker count={24} value={hours} onChange={setHours} />
            <AppText size={30} weight="bold" style={styles.colon}>
              :
            </AppText>
            <WheelPicker count={60} value={minutes} onChange={setMinutes} />
            <AppText size={30} weight="bold" style={styles.colon}>
              :
            </AppText>
            <WheelPicker count={60} value={seconds} onChange={setSeconds} />
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
                        : colors.surfaceRaised,
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

          <View style={styles.buttons}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: colors.surfaceRaised,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <AppText weight="semibold">Cancel</AppText>
            </Pressable>
            <Pressable
              disabled={total === 0}
              onPress={start}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: colors.accent,
                  opacity: total === 0 ? 0.4 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <AppText weight="semibold" color={colors.white}>
                Start
              </AppText>
            </Pressable>
          </View>
        </View>
      )}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  wheels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
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
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    alignSelf: "stretch",
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  activeBox: {
    alignItems: "center",
    paddingTop: 4,
  },
  countdown: {
    marginVertical: 10,
  },
});
