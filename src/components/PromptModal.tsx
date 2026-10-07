import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { fonts } from "../constants/fonts";
import { useTheme } from "../hooks/use-theme";
import { useT } from "../i18n";
import { AppText } from "./AppText";
import { Overlay } from "./Overlay";

type Props = {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

const MAX_LENGTH = 40;

/** Themed text prompt (playlist name). Placed near the top so the keyboard never covers it. */
export function PromptModal({
  visible,
  title,
  initialValue = "",
  placeholder,
  confirmLabel,
  onSubmit,
  onCancel,
}: Props) {
  const colors = useTheme();
  const { t } = useT();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Overlay visible={visible} onClose={onCancel} placement="top">
      <AppText variant="heading">{title}</AppText>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        autoFocus
        maxLength={MAX_LENGTH}
        returnKeyType="done"
        onSubmitEditing={submit}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      />
      <AppText variant="label" muted align="right" style={styles.counter}>
        {value.length}/{MAX_LENGTH}
      </AppText>
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
          <AppText weight="semibold">{t("common.cancel")}</AppText>
        </Pressable>
        <Pressable
          disabled={!trimmed}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.accent,
              opacity: !trimmed ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}
          onPress={submit}
        >
          <AppText weight="semibold" color={colors.white}>
            {confirmLabel ?? t("common.save")}
          </AppText>
        </Pressable>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: 16,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  counter: {
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
