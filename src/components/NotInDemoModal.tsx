import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { AppText } from "./AppText";
import { Overlay } from "./Overlay";

type Props = {
  visible: boolean;
  /** What was tapped, e.g. "Send music". */
  feature?: string;
  onClose: () => void;
};

/** Shown when a demo feature isn't built: says so plainly (never "coming soon"). */
export function NotInDemoModal({ visible, feature, onClose }: Props) {
  const colors = useTheme();
  const { t } = useT();
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <View style={styles.content}>
        <View
          style={[styles.iconWrap, { backgroundColor: colors.surfaceRaised }]}
        >
          <Ionicons name="flask-outline" size={26} color={colors.purple} />
        </View>
        <AppText variant="heading" align="center">
          {t("demo.title")}
        </AppText>
        <AppText muted align="center" style={styles.message}>
          {feature ? t("demo.textFeature", { feature }) : t("demo.text")}
        </AppText>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <AppText weight="semibold" color={colors.white}>
            {t("common.ok")}
          </AppText>
        </Pressable>
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
  button: {
    marginTop: 22,
    alignSelf: "stretch",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
