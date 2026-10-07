import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { ScreenHeader } from "../components/ScreenHeader";
import { Slider } from "../components/Slider";
import { equalizer, type EqualizerInfo } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";

/** Engine calls while a finger drags a slider: at most one every 90 ms (the final value is always sent). */
const LIVE_INTERVAL_MS = 90;

function formatHz(hz: number) {
  return hz >= 1000
    ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}k`
    : `${hz}`;
}

function formatDb(levelMb: number) {
  const db = Math.round(levelMb / 100);
  return `${db > 0 ? "+" : ""}${db} dB`;
}

/**
 * Equalizer (temporary design — the final one comes later).
 * On/off, presets, one slider per band, bass boost and virtualizer.
 * Colours: purple / violet for controls, cyan → blue gradient for the band lines.
 */
export default function EqualizerScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<EqualizerInfo | null>(null);
  const [error, setError] = useState("");
  /** Band levels shown while dragging (millibels). */
  const [liveLevels, setLiveLevels] = useState<Record<number, number>>({});
  const lastSent = useRef<Record<string, number>>({});

  useEffect(() => {
    const start = Date.now();
    equalizer
      .get()
      .then((i) => {
        setInfo(i);
        if (__DEV__)
          console.log(
            `[eq] loaded in ${Date.now() - start}ms — supported=${i.supported} enabled=${i.enabled}`,
          );
      })
      .catch((e) => {
        setError(String(e));
        if (__DEV__) console.log(`[eq] load failed — ${String(e)}`);
      });
  }, []);

  /** Sends live values while dragging, at most every LIVE_INTERVAL_MS per control. */
  const sendLive = (key: string, send: () => void) => {
    const now = Date.now();
    if (now - (lastSent.current[key] ?? 0) < LIVE_INTERVAL_MS) return;
    lastSent.current[key] = now;
    send();
  };

  if (error) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ScreenHeader title="Equalizer" />
        <View style={styles.center}>
          <AppText muted align="center">
            {error}
          </AppText>
        </View>
      </View>
    );
  }

  if (!info) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ScreenHeader title="Equalizer" />
      </View>
    );
  }

  if (!info.supported) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ScreenHeader title="Equalizer" />
        <View style={styles.center}>
          <AppText muted align="center">
            This phone doesn't support an equalizer.
          </AppText>
        </View>
      </View>
    );
  }

  const [min, max] = info.levelRange ?? [-1500, 1500];
  const range = max - min || 1;
  const enabled = !!info.enabled;
  const presets = info.presets ?? [];
  const bands = info.bands ?? [];

  const toLevel = (ratio: number) =>
    Math.round((min + ratio * range) / 50) * 50;

  const onToggle = (value: boolean) => {
    setInfo({ ...info, enabled: value });
    equalizer
      .setEnabled(value)
      .then(setInfo)
      .catch(() => {});
  };

  const onPreset = (index: number) => {
    if (__DEV__) console.log(`[eq] preset → ${presets[index]}`);
    equalizer
      .applyPreset(index)
      .then(setInfo)
      .catch(() => {});
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title="Equalizer" />

      <View style={styles.content}>
        <View
          style={[
            styles.card,
            styles.toggleRow,
            { backgroundColor: colors.surface },
          ]}
        >
          <View style={styles.flex}>
            <AppText weight="semibold">Equalizer</AppText>
            <AppText variant="caption" muted>
              {enabled ? "On — applies to every song" : "Off"}
            </AppText>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: colors.surfaceRaised, true: colors.violet }}
            thumbColor={colors.white}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetScroll}
          contentContainerStyle={styles.presets}
        >
          {info.preset === -1 ? <Chip label="Custom" selected /> : null}
          {presets.map((name, index) => (
            <Chip
              key={`${index}-${name}`}
              label={name}
              selected={info.preset === index}
              onPress={() => onPreset(index)}
            />
          ))}
        </ScrollView>

        <View
          style={[
            styles.card,
            styles.bandsCard,
            { backgroundColor: colors.surface, opacity: enabled ? 1 : 0.5 },
          ]}
        >
          {bands.map((band) => {
            const level = liveLevels[band.index] ?? band.level;
            return (
              <View key={band.index} style={styles.band}>
                <AppText
                  variant="label"
                  color={level !== 0 ? colors.neonBlue : colors.textMuted}
                >
                  {formatDb(level)}
                </AppText>
                <View style={styles.bandSlider}>
                  <Slider
                    vertical
                    value={(band.level - min) / range}
                    smoothMs={220}
                    thickness={6}
                    thumbSize={18}
                    step={0.01}
                    activeColor={colors.neonBlue}
                    activeGradient={colors.eqBandGradient}
                    inactiveColor={colors.surfaceRaised}
                    thumbColor={colors.cyan}
                    onValueChange={(r) => {
                      const lv = toLevel(r);
                      setLiveLevels((prev) => ({ ...prev, [band.index]: lv }));
                      sendLive(`band${band.index}`, () => {
                        equalizer.setBand(band.index, lv).catch(() => {});
                      });
                    }}
                    onSlidingComplete={(r) => {
                      const lv = toLevel(r);
                      if (__DEV__)
                        console.log(
                          `[eq] band ${formatHz(band.centerHz)}Hz → ${formatDb(lv)}`,
                        );
                      equalizer
                        .setBand(band.index, lv)
                        .then((next) => {
                          setInfo(next);
                          setLiveLevels((prev) => {
                            const copy = { ...prev };
                            delete copy[band.index];
                            return copy;
                          });
                        })
                        .catch(() => {});
                    }}
                  />
                </View>
                <AppText variant="label" muted>
                  {formatHz(band.centerHz)}
                </AppText>
              </View>
            );
          })}
        </View>

        {info.bassSupported ? (
          <StrengthRow
            label="Bass boost"
            strength={info.bassStrength ?? 0}
            dimmed={!enabled}
            onLive={(s) =>
              sendLive("bass", () => equalizer.setBass(s).catch(() => {}))
            }
            onDone={(s) => {
              if (__DEV__) console.log(`[eq] bass → ${Math.round(s / 10)}%`);
              equalizer
                .setBass(s)
                .then(setInfo)
                .catch(() => {});
            }}
          />
        ) : null}

        {info.virtualizerSupported ? (
          <StrengthRow
            label="Virtualizer"
            strength={info.virtualizerStrength ?? 0}
            dimmed={!enabled}
            onLive={(s) =>
              sendLive("virt", () =>
                equalizer.setVirtualizer(s).catch(() => {}),
              )
            }
            onDone={(s) => {
              if (__DEV__)
                console.log(`[eq] virtualizer → ${Math.round(s / 10)}%`);
              equalizer
                .setVirtualizer(s)
                .then(setInfo)
                .catch(() => {});
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress?: () => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.purple : colors.surface,
          borderColor: selected ? colors.violet : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <AppText
        variant="caption"
        weight={selected ? "semibold" : "medium"}
        color={selected ? colors.white : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function StrengthRow({
  label,
  strength,
  dimmed,
  onLive,
  onDone,
}: {
  label: string;
  strength: number;
  dimmed: boolean;
  onLive: (strength: number) => void;
  onDone: (strength: number) => void;
}) {
  const colors = useTheme();
  const [live, setLive] = useState<number | null>(null);
  const shown = live ?? strength;

  return (
    <View
      style={[
        styles.card,
        styles.strength,
        { backgroundColor: colors.surface, opacity: dimmed ? 0.5 : 1 },
      ]}
    >
      <View style={styles.strengthTop}>
        <AppText weight="medium">{label}</AppText>
        <AppText
          variant="caption"
          color={shown > 0 ? colors.purple : colors.textMuted}
        >
          {Math.round(shown / 10)}%
        </AppText>
      </View>
      <Slider
        value={strength / 1000}
        smoothMs={220}
        thickness={6}
        thumbSize={18}
        step={0.01}
        activeColor={colors.purple}
        activeGradient={colors.eqStrengthGradient}
        inactiveColor={colors.surfaceRaised}
        thumbColor={colors.purple}
        onValueChange={(r) => {
          const s = Math.round(r * 1000);
          setLive(s);
          onLive(s);
        }}
        onSlidingComplete={(r) => {
          setLive(null);
          onDone(Math.round(r * 1000));
        }}
      />
    </View>
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
    paddingHorizontal: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  flex: {
    flex: 1,
  },
  presetScroll: {
    flexGrow: 0,
  },
  presets: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: "center",
  },
  bandsCard: {
    flex: 1,
    minHeight: 200,
    maxHeight: 340,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 14,
  },
  band: {
    alignItems: "center",
    gap: 8,
  },
  bandSlider: {
    flex: 1,
  },
  strength: {
    gap: 2,
  },
  strengthTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
