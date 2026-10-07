import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

type Props = {
  /** 0..1, from the app (ignored while the finger is on the slider). */
  value: number;
  vertical?: boolean;
  /** Track thickness. */
  thickness?: number;
  thumbSize?: number;
  activeColor: string;
  /** Optional gradient for the filled part (vertical: top → bottom, horizontal: left → right). */
  activeGradient?: readonly string[];
  inactiveColor: string;
  thumbColor?: string;
  /** Animate value changes coming from the app (e.g. playback progress) over this many ms. */
  smoothMs?: number;
  /** Minimum change (0..1) before onValueChange is called again while dragging. */
  step?: number;
  onSlidingStart?: () => void;
  onValueChange?: (value: number) => void;
  onSlidingComplete: (value: number) => void;
  style?: StyleProp<ViewStyle>;
};

const clamp = (v: number) =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;

/**
 * Smooth slider: the finger moves the thumb on the UI thread (no lag even when the app is busy).
 * Drag or tap anywhere on the track. The app is told the value while dragging (throttled by `step`)
 * and the final value when the finger lifts.
 */
export function Slider(props: Props) {
  const {
    value,
    vertical = false,
    thickness = 4,
    thumbSize = 14,
    activeColor,
    activeGradient,
    inactiveColor,
    thumbColor,
    smoothMs = 0,
    step = 0.004,
    style,
  } = props;

  const length = useSharedValue(0);
  const [trackLength, setTrackLength] = useState(0);
  const gradientId = `sl${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const progress = useSharedValue(clamp(value));
  const dragging = useSharedValue(false);
  const lastSent = useSharedValue(-1);

  // Latest callbacks, so the gesture never has to be rebuilt during a drag.
  const callbacks = useRef(props);
  useEffect(() => {
    callbacks.current = props;
  });
  const handleStart = useCallback(
    () => callbacks.current.onSlidingStart?.(),
    [],
  );
  const handleChange = useCallback(
    (v: number) => callbacks.current.onValueChange?.(v),
    [],
  );
  const handleComplete = useCallback(
    (v: number) => callbacks.current.onSlidingComplete(v),
    [],
  );

  // Values coming from the app.
  useEffect(() => {
    if (dragging.get()) return;
    const v = clamp(value);
    if (smoothMs > 0 && Math.abs(v - progress.get()) < 0.05) {
      progress.set(
        withTiming(v, { duration: smoothMs, easing: Easing.linear }),
      );
    } else {
      progress.set(v);
    }
  }, [value, smoothMs, dragging, progress]);

  const gesture = useMemo(() => {
    const ratioAt = (x: number, y: number) => {
      "worklet";
      const len = length.get();
      if (len <= 0) return 0;
      const r = vertical ? 1 - y / len : x / len;
      return Math.min(1, Math.max(0, r));
    };

    return Gesture.Pan()
      .minDistance(0)
      .onBegin((e) => {
        "worklet";
        dragging.set(true);
        const r = ratioAt(e.x, e.y);
        progress.set(r);
        lastSent.set(r);
        scheduleOnRN(handleStart);
        scheduleOnRN(handleChange, r);
      })
      .onUpdate((e) => {
        "worklet";
        const r = ratioAt(e.x, e.y);
        progress.set(r);
        if (Math.abs(r - lastSent.get()) >= step) {
          lastSent.set(r);
          scheduleOnRN(handleChange, r);
        }
      })
      .onFinalize(() => {
        "worklet";
        if (!dragging.get()) return;
        dragging.set(false);
        scheduleOnRN(handleComplete, progress.get());
      });
  }, [
    vertical,
    step,
    length,
    progress,
    dragging,
    lastSent,
    handleStart,
    handleChange,
    handleComplete,
  ]);

  const fillStyle = useAnimatedStyle(() => {
    const size = progress.get() * length.get();
    return vertical ? { height: size } : { width: size };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const pos = progress.get() * length.get() - thumbSize / 2;
    const scale = dragging.get() ? 1.35 : 1;
    return vertical
      ? { transform: [{ translateY: -pos }, { scale }] }
      : { transform: [{ translateX: pos }, { scale }] };
  });

  const touch = Math.max(thumbSize + 18, 30);
  const thumbOffset = (touch - thumbSize) / 2;
  const trackOffset = (touch - thickness) / 2;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    length.set(vertical ? height : width);
    setTrackLength(vertical ? height : width);
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        onLayout={onLayout}
        style={[
          vertical
            ? { width: touch, height: "100%" }
            : { height: touch, width: "100%" },
          style,
        ]}
      >
        <View
          style={[
            {
              position: "absolute",
              backgroundColor: inactiveColor,
              borderRadius: thickness / 2,
              overflow: "hidden",
            },
            vertical
              ? { left: trackOffset, width: thickness, top: 0, bottom: 0 }
              : { top: trackOffset, height: thickness, left: 0, right: 0 },
          ]}
        >
          <Animated.View
            style={[
              {
                position: "absolute",
                overflow: "hidden",
                backgroundColor: activeGradient ? "transparent" : activeColor,
              },
              vertical
                ? { left: 0, right: 0, bottom: 0 }
                : { left: 0, top: 0, bottom: 0 },
              fillStyle,
            ]}
          >
            {activeGradient && trackLength > 0 ? (
              // The gradient covers the whole track; the fill only reveals its part of it.
              <Svg
                width={vertical ? thickness : trackLength}
                height={vertical ? trackLength : thickness}
                style={
                  vertical
                    ? { position: "absolute", left: 0, bottom: 0 }
                    : { position: "absolute", left: 0, top: 0 }
                }
              >
                <Defs>
                  <LinearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2={vertical ? "0" : "1"}
                    y2={vertical ? "1" : "0"}
                  >
                    {activeGradient.map((c, i) => (
                      <Stop
                        key={i}
                        offset={String(
                          activeGradient.length > 1
                            ? i / (activeGradient.length - 1)
                            : 0,
                        )}
                        stopColor={c}
                      />
                    ))}
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width={vertical ? thickness : trackLength}
                  height={vertical ? trackLength : thickness}
                  fill={`url(#${gradientId})`}
                />
              </Svg>
            ) : null}
          </Animated.View>
        </View>
        <Animated.View
          style={[
            {
              position: "absolute",
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: thumbColor ?? activeColor,
            },
            vertical
              ? { left: thumbOffset, bottom: 0 }
              : { top: thumbOffset, left: 0 },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}
