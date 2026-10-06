import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../hooks/use-theme";
import { AppText } from "./AppText";
import { Overlay } from "./Overlay";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button (default). Set false for a neutral, accent-coloured confirm. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Themed replacement for the phone's native Alert. Never use Alert for confirmations.
 * Render it as the last child of the screen's root view.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  icon = "trash-outline",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
}: Props) {
  const colors = useTheme();
  const confirmColor = destructive ? colors.danger : colors.accent;

  return (
    <Overlay visible={visible} onClose={onCancel} placement="center">
      <View style={styles.content}>
        <View
          style={[styles.iconWrap, { backgroundColor: confirmColor + "22" }]}
        >
          <Ionicons name={icon} size={26} color={confirmColor} />
        </View>

        <AppText variant="heading" align="center">
          {title}
        </AppText>
        {message ? (
          <AppText variant="body" muted align="center" style={styles.message}>
            {message}
          </AppText>
        ) : null}

        <View style={styles.row}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: colors.surfaceRaised,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={onCancel}
          >
            <AppText weight="semibold">{cancelLabel}</AppText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: confirmColor, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {},
              );
              onConfirm();
            }}
          >
            <AppText weight="semibold" color={colors.white}>
              {confirmLabel}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  message: {
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
    alignSelf: "stretch",
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
