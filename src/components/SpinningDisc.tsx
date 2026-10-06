import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

const DISC = require("../../assets/images/disc_logo.png");
const TURN_MS = 6000; // one full turn

type Props = {
  size: number;
  playing: boolean;
  /** Increase it to bring the disc back to its start position (Stop button). */
  resetKey: number;
};

/** The Playtune disc: spins while music plays, stops where it is on pause, goes back to the start on Stop. */
export function SpinningDisc({ size, playing, resetKey }: Props) {
  const rotation = useSharedValue(0);
  const resetting = useRef(false);

  useEffect(() => {
    if (playing) {
      const start = ((rotation.get() % 360) + 360) % 360;
      rotation.set(start);
      rotation.set(
        withRepeat(
          withTiming(start + 360, { duration: TURN_MS, easing: Easing.linear }),
          -1,
          false,
        ),
      );
    } else if (!resetting.current) {
      cancelAnimation(rotation);
    }
  }, [playing, rotation]);

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

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Image
        source={DISC}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </Animated.View>
  );
}
