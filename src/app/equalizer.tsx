import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

import { AppText } from "../components/AppText";
import { EqIcon } from "../components/EqIcon";
import { ScreenHeader } from "../components/ScreenHeader";
import { Slider } from "../components/Slider";
import { equalizer, type EqualizerInfo } from "../engine/engine";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";

/** Engine calls while a finger drags a slider: at most one every 90 ms (the final value is always sent). */
const LIVE_INTERVAL_MS = 90;
/** Left column with the dB scale (+12 … -12). */
const AXIS = 44;
const CURVE_HEIGHT = 120;
const SLIDER_HEIGHT = 230;

function formatHz(hz: number) {
  return hz >= 1000
    ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz`
    : `${hz} Hz`;
}

function formatDb(levelMb: number) {
  const db = Math.round(levelMb / 100);
  return `${db > 0 ? "+" : ""}${db} dB`;
}

/** Smooth line through the points (Catmull-Rom turned into cubic Béziers). */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Rounded gradient background (selected preset pill). */
function GradientPill({
  colorsList,
  radius,
}: {
  colorsList: readonly string[];
  radius: number;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) =>
        setSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id="pill" x1="0" y1="0" x2="1" y2="0">
              {colorsList.map((c, i) => (
                <Stop
                  key={i}
                  offset={String(i / (colorsList.length - 1))}
                  stopColor={c}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={size.w}
            height={size.h}
            rx={radius}
            fill="url(#pill)"
          />
        </Svg>
      ) : null}
    </View>
  );
}

function IconBubble({ children }: { children: ReactNode }) {
  const colors = useTheme();
  return (
    <View style={[styles.bubble, { backgroundColor: colors.surfaceRaised }]}>
      {children}
    </View>
  );
}

function Card({ children, style }: { children: ReactNode; style?: object }) {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function EqSkeleton() {
  const colors = useTheme();
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[styles.content, pulse]}>
      {[86, 44, 420, 96, 96].map((h, i) => (
        <View
          key={i}
          style={{
            height: h,
            borderRadius: i === 1 ? 22 : 24,
            backgroundColor: colors.surface,
          }}
        />
      ))}
    </Animated.View>
  );
}

/**
 * Equalizer: on/off, presets, a curve that follows the bands, one vertical slider per band
 * with a dB scale, bass boost and virtualizer.
 */
export default function EqualizerScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const [info, setInfo] = useState<EqualizerInfo | null>(null);
  const [error, setError] = useState("");
  /** Band levels shown while dragging (millibels). */
  const [liveLevels, setLiveLevels] = useState<Record<number, number>>({});
  const [cardWidth, setCardWidth] = useState(0);
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

  const [min, max] = info?.levelRange ?? [-1500, 1500];
  const range = max - min || 1;
  const bands = useMemo(() => info?.bands ?? [], [info]);
  const levels = bands.map((b) => liveLevels[b.index] ?? b.level);
  const levelsKey = levels.join(",");

  // Curve through the band levels, drawn across the whole card.
  const curve = useMemo(() => {
    if (cardWidth <= 0 || bands.length === 0) return null;
    const lv = levelsKey.split(",").map(Number);
    const colW = (cardWidth - AXIS) / bands.length;
    const top = 18;
    const h = CURVE_HEIGHT - 36;
    const yOf = (level: number) => top + (1 - (level - min) / range) * h;
    const zero = yOf(0);
    const pts = lv.map((level, i) => ({
      x: AXIS + colW * (i + 0.5),
      y: yOf(level),
    }));
    const all = [
      { x: 0, y: (pts[0].y + zero) / 2 },
      ...pts,
      { x: cardWidth, y: (pts[pts.length - 1].y + zero) / 2 },
    ];
    const line = smoothPath(all);
    return {
      line,
      fill: `${line} L ${cardWidth} ${CURVE_HEIGHT} L 0 ${CURVE_HEIGHT} Z`,
      pts,
      zero,
      colW,
    };
  }, [cardWidth, bands.length, levelsKey, min, range]);

  if (error || (info && !info.supported)) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ScreenHeader title={t("menu.equalizer")} />
        <View style={styles.center}>
          <EqIcon size={44} color={colors.purple} />
          <AppText muted align="center">
            {error || t("eq.unsupported")}
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
        <ScreenHeader title={t("menu.equalizer")} />
        <EqSkeleton />
      </View>
    );
  }

  const enabled = !!info.enabled;
  const presets = info.presets ?? [];
  const maxDb = Math.round(max / 100);
  const minDb = Math.round(min / 100);
  const scale = [maxDb, Math.round(maxDb / 2), 0, Math.round(minDb / 2), minDb];

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
      <ScreenHeader title={t("menu.equalizer")} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
      >
        {/* On / off */}
        <Card style={styles.toggleRow}>
          <IconBubble>
            <EqIcon size={26} color={colors.accent} />
          </IconBubble>
          <View style={styles.flex}>
            <AppText size={17} weight="semibold">
              {t("menu.equalizer")}
            </AppText>
            <AppText
              variant="caption"
              color={enabled ? colors.purple : colors.textMuted}
            >
              {enabled ? t("eq.on") : t("eq.off")}
            </AppText>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: colors.surfaceRaised, true: colors.violet }}
            thumbColor={colors.white}
          />
        </Card>

        {/* Presets */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetScroll}
          contentContainerStyle={styles.presets}
        >
          {info.preset === -1 ? <Chip label={t("eq.custom")} selected /> : null}
          {presets.map((name, index) => (
            <Chip
              key={`${index}-${name}`}
              label={name}
              selected={info.preset === index}
              onPress={() => onPreset(index)}
            />
          ))}
        </ScrollView>

        {/* Curve + bands */}
        <View
          style={[
            styles.bandsCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: enabled ? 1 : 0.5,
            },
          ]}
          onLayout={(e: LayoutChangeEvent) =>
            setCardWidth(e.nativeEvent.layout.width)
          }
        >
          {curve ? (
            <Svg width={cardWidth} height={CURVE_HEIGHT}>
              <Defs>
                <LinearGradient id="eqLine" x1="0" y1="0" x2="1" y2="0">
                  {colors.eqCurveGradient.map((c, i) => (
                    <Stop
                      key={i}
                      offset={String(i / (colors.eqCurveGradient.length - 1))}
                      stopColor={c}
                    />
                  ))}
                </LinearGradient>
                <LinearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop
                    offset="0"
                    stopColor={colors.purple}
                    stopOpacity="0.28"
                  />
                  <Stop offset="1" stopColor={colors.purple} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {curve.pts.map((p, i) => (
                <Line
                  key={`g${i}`}
                  x1={p.x}
                  y1={8}
                  x2={p.x}
                  y2={CURVE_HEIGHT - 4}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
              <Line
                x1={0}
                y1={curve.zero}
                x2={cardWidth}
                y2={curve.zero}
                stroke={colors.border}
                strokeWidth={1}
              />
              <Path d={curve.fill} fill="url(#eqFill)" />
              <Path
                d={curve.line}
                stroke="url(#eqLine)"
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
              />
              {curve.pts.map((p, i) => (
                <Circle
                  key={`d${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill={
                    colors.eqCurveGradient[
                      Math.min(
                        colors.eqCurveGradient.length - 1,
                        Math.floor(
                          (i / Math.max(1, curve.pts.length - 1)) *
                            (colors.eqCurveGradient.length - 1) +
                            0.5,
                        ),
                      )
                    ]
                  }
                />
              ))}
            </Svg>
          ) : (
            <View style={{ height: CURVE_HEIGHT }} />
          )}

          <View style={styles.bandsArea}>
            {/* dB scale */}
            <View style={[styles.axis, { height: SLIDER_HEIGHT }]}>
              {scale.map((db, i) => (
                <View key={i} style={styles.axisRow}>
                  <AppText variant="label" color={colors.purple}>
                    {db > 0 ? `+${db}` : `${db}`}
                  </AppText>
                  <View
                    style={[styles.tick, { backgroundColor: colors.border }]}
                  />
                </View>
              ))}
            </View>

            {bands.map((band, i) => {
              const level = levels[i];
              return (
                <View key={band.index} style={styles.band}>
                  <View style={{ height: SLIDER_HEIGHT }}>
                    <Slider
                      vertical
                      value={(band.level - min) / range}
                      smoothMs={220}
                      thickness={12}
                      thumbSize={26}
                      step={0.01}
                      activeColor={colors.purple}
                      activeGradient={colors.eqBandGradient}
                      inactiveColor={colors.surfaceRaised}
                      thumbColor={colors.purple}
                      thumbBorderColor={colors.glowPink}
                      thumbBorderWidth={2}
                      onValueChange={(r) => {
                        const lv = toLevel(r);
                        setLiveLevels((prev) => ({
                          ...prev,
                          [band.index]: lv,
                        }));
                        sendLive(`band${band.index}`, () => {
                          equalizer.setBand(band.index, lv).catch(() => {});
                        });
                      }}
                      onSlidingComplete={(r) => {
                        const lv = toLevel(r);
                        if (__DEV__)
                          console.log(
                            `[eq] band ${formatHz(band.centerHz)} → ${formatDb(lv)}`,
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
                  <AppText weight="medium" style={styles.bandDb}>
                    {formatDb(level)}
                  </AppText>
                  <AppText variant="caption" color={colors.purple}>
                    {formatHz(band.centerHz)}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>

        {info.bassSupported ? (
          <StrengthCard
            icon={
              <MaterialCommunityIcons
                name="speaker"
                size={26}
                color={colors.accent}
              />
            }
            label={t("eq.bass")}
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
          <StrengthCard
            icon={
              <Ionicons name="volume-high" size={24} color={colors.accent} />
            }
            label={t("eq.virtualizer")}
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
      </ScrollView>
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
          borderColor: selected ? "transparent" : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {selected ? (
        <GradientPill colorsList={colors.eqCurveGradient} radius={22} />
      ) : null}
      <AppText
        weight={selected ? "semibold" : "medium"}
        color={selected ? colors.white : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function StrengthCard({
  icon,
  label,
  strength,
  dimmed,
  onLive,
  onDone,
}: {
  icon: ReactNode;
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
    <Card style={[styles.strength, { opacity: dimmed ? 0.5 : 1 }]}>
      <IconBubble>{icon}</IconBubble>
      <View style={styles.flex}>
        <View style={styles.strengthTop}>
          <AppText size={17} weight="semibold">
            {label}
          </AppText>
          <AppText weight="medium" color={colors.purple}>
            {Math.round(shown / 10)}%
          </AppText>
        </View>
        <Slider
          value={strength / 1000}
          smoothMs={220}
          thickness={10}
          thumbSize={24}
          step={0.01}
          activeColor={colors.accent}
          activeGradient={colors.eqStrengthGradient}
          inactiveColor={colors.surfaceRaised}
          thumbColor={colors.accent}
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
    </Card>
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
    gap: 12,
    paddingHorizontal: 32,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 16,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
  },
  presetScroll: {
    flexGrow: 0,
  },
  presets: {
    gap: 10,
  },
  chip: {
    paddingHorizontal: 22,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  bandsCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: 18,
  },
  bandsArea: {
    flexDirection: "row",
    paddingTop: 8,
  },
  axis: {
    width: AXIS,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  axisRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    paddingRight: 4,
  },
  tick: {
    width: 8,
    height: 1,
  },
  band: {
    flex: 1,
    alignItems: "center",
  },
  bandDb: {
    marginTop: 12,
  },
  strength: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  strengthTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
