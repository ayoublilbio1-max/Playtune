import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../hooks/use-theme";
import { createStore } from "../store/create-store";
import { AppText } from "./AppText";

const store = createStore({ message: "", id: 0 });

/** Shows a short message at the top of the screen for 2 seconds. */
export function showToast(message: string) {
  store.set((s) => ({ message, id: s.id + 1 }));
}

/** Place once per screen, as the last child of the root view. */
export function Toast() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const message = store.useStore((s) => s.message);
  const id = store.useStore((s) => s.id);
  const [visibleId, setVisibleId] = useState(0);
  // A screen that opens later must not replay an old message (that was the "Removed from Liked songs" bug).
  const idAtMount = useRef(id);

  useEffect(() => {
    if (id === 0 || id === idAtMount.current) return;
    setVisibleId(id);
    const timer = setTimeout(() => setVisibleId(0), 2000);
    return () => clearTimeout(timer);
  }, [id]);

  if (visibleId === 0 || visibleId !== id) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      style={[
        styles.toast,
        {
          top: insets.top + 10,
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
        },
      ]}
    >
      <AppText weight="medium" align="center" numberOfLines={2}>
        {message}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    maxWidth: "86%",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 200,
    elevation: 200,
  },
});
