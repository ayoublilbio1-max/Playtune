import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "./AppText";
import { IconButton } from "./IconButton";

type Props = {
  title?: string;
  right?: ReactNode;
};

/** Back button + title + optional right action. Back falls back to Home if there is no screen behind. */
export function ScreenHeader({ title, right }: Props) {
  return (
    <View style={styles.row}>
      <IconButton
        name="chevron-back"
        size={26}
        accessibilityLabel="Back"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
      />
      <AppText variant="heading" numberOfLines={1} style={styles.title}>
        {title ?? ""}
      </AppText>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  title: {
    flex: 1,
  },
  right: {
    minWidth: 40,
    alignItems: "flex-end",
  },
});
