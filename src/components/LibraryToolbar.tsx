import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { fonts } from "../constants/fonts";
import { useTheme } from "../hooks/use-theme";
import { IconButton } from "./IconButton";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onSortPress: () => void;
  onEqualizerPress: () => void;
};

/** Search field + Sort button + Equalizer button, in one row. */
export function LibraryToolbar({
  query,
  onQueryChange,
  onSortPress,
  onEqualizerPress,
}: Props) {
  const colors = useTheme();

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.search,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search songs, artists, albums"
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.input, { color: colors.textPrimary }]}
        />
        {query ? (
          <Pressable hitSlop={10} onPress={() => onQueryChange("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <IconButton
        name="swap-vertical"
        size={21}
        box="soft"
        accessibilityLabel="Sort songs"
        onPress={onSortPress}
      />
      <IconButton
        family="mci"
        name="equalizer"
        size={22}
        box="soft"
        accessibilityLabel="Equalizer"
        onPress={onEqualizerPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  search: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 44,
    paddingVertical: 0,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
