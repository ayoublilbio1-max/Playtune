import { useEffect, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../hooks/use-theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** bottom = sheet, center = dialog, top = dialog near the top (for text input, stays above the keyboard). */
  placement?: "bottom" | "center" | "top";
  children: ReactNode;
};

/**
 * Sheets and dialogs drawn inside the screen (not a separate Android window),
 * so the hidden navigation bar stays hidden while they are open.
 * Render it as the LAST child of the screen's root view so it covers everything.
 * The phone's Back gesture closes it.
 */
export function Overlay({
  visible,
  onClose,
  placement = "bottom",
  children,
}: Props) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      style={styles.root}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      />

      {placement === "bottom" ? (
        <Animated.View
          entering={SlideInDown.duration(240)}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: colors.textFaint }]}
          />
          {children}
        </Animated.View>
      ) : (
        <View
          pointerEvents="box-none"
          style={[
            styles.dialogWrap,
            placement === "top"
              ? { justifyContent: "flex-start", paddingTop: insets.top + 72 }
              : null,
          ]}
        >
          <Animated.View
            entering={ZoomIn.duration(180)}
            style={[
              styles.dialog,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {children}
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  dialogWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
  },
});
