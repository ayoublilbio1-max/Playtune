import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../hooks/use-theme";
import { AppText } from "./AppText";

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

/** Themed replacement for the phone's native Alert. Never use Alert for confirmations. */
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onCancel}
      >
        <Pressable
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => {}}
        >
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
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
