import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { SORT_OPTIONS, type SortKey } from "../constants/sort";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { AppText } from "./AppText";
import { Overlay } from "./Overlay";

type Props = {
  visible: boolean;
  value: SortKey;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
};

export function SortSheet({ visible, value, onSelect, onClose }: Props) {
  const colors = useTheme();
  const { t } = useT();

  return (
    <Overlay visible={visible} onClose={onClose}>
      <AppText variant="heading" style={styles.title}>
        {t("sort.heading")}
      </AppText>
      {SORT_OPTIONS.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: selected
                  ? colors.surfaceRaised
                  : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.texts}>
              <AppText
                weight={selected ? "semibold" : "regular"}
                color={selected ? colors.accent : undefined}
              >
                {t(option.label)}
              </AppText>
              <AppText variant="label" muted>
                {t(option.hint)}
              </AppText>
            </View>
            <Ionicons
              name={selected ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={selected ? colors.accent : colors.textFaint}
            />
          </Pressable>
        );
      })}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  texts: {
    flex: 1,
  },
});
