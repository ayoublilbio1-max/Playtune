import { Image } from "expo-image";
import Animated from "react-native-reanimated";

import { useSpin } from "../hooks/use-spin";

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
  const spin = useSpin(playing, resetKey, TURN_MS);

  return (
    <Animated.View style={[{ width: size, height: size }, spin]}>
      <Image
        source={DISC}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </Animated.View>
  );
}
