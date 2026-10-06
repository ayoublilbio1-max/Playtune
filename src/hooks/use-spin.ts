import { useEffect, useRef } from "react";
import {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

/**
 * Rotation for the disc and the artwork circle (runs on the UI thread, smooth even when the app is busy):
 * spins while `playing`, stops where it is on pause, goes back to the start when `resetKey` increases (Stop).
 */
export function useSpin(playing: boolean, resetKey: number, turnMs: number) {
  const rotation = useSharedValue(0);
  const resetting = useRef(false);

  useEffect(() => {
    if (playing) {
      const start = ((rotation.get() % 360) + 360) % 360;
      rotation.set(start);
      rotation.set(
        withRepeat(
          withTiming(start + 360, { duration: turnMs, easing: Easing.linear }),
          -1,
          false,
        ),
      );
    } else if (!resetting.current) {
      cancelAnimation(rotation);
    }
  }, [playing, turnMs, rotation]);

  useEffect(() => {
    if (resetKey === 0) return;
    resetting.current = true;
    cancelAnimation(rotation);
    const current = ((rotation.get() % 360) + 360) % 360;
    rotation.set(current);
    rotation.set(
      withTiming(current > 180 ? 360 : 0, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      }),
    );
    const timer = setTimeout(() => {
      resetting.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, [resetKey, rotation]);

  return useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));
}
