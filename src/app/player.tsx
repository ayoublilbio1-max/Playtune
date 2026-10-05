import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { useTheme } from "../hooks/use-theme";

/**
 * Placeholder for the full player screen.
 * It exists now because the player notification opens playtune://player,
 * so the route must be there before the first build.
 */
export default function PlayerScreen() {
  const colors = useTheme();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <Pressable
        hitSlop={12}
        style={styles.back}
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
      >
        <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.center}>
        <View
          style={[
            styles.disc,
            { backgroundColor: colors.surface, borderColor: colors.accent },
          ]}
        >
          <Ionicons name="musical-notes" size={56} color={colors.accent} />
        </View>
        <AppText variant="title" align="center">
          Now playing
        </AppText>
        <AppText muted align="center">
          The full player screen comes next. Opened from the notification ✓
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  back: { paddingVertical: 12, alignSelf: "flex-start" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 80,
  },
  disc: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
});
