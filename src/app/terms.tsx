import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { ScreenHeader } from "../components/ScreenHeader";
import { APP_VERSION, DEVELOPER } from "../constants/app";
import { useTheme } from "../hooks/use-theme";
import { useT, type TKey } from "../i18n";

const SECTIONS: [TKey, TKey][] = [
  ["terms.useTitle", "terms.useBody"],
  ["terms.musicTitle", "terms.musicBody"],
  ["terms.privacyTitle", "terms.privacyBody"],
  ["terms.permissionsTitle", "terms.permissionsBody"],
  ["terms.warrantyTitle", "terms.warrantyBody"],
  ["terms.changesTitle", "terms.changesBody"],
  ["terms.contactTitle", "terms.contactBody"],
];

/** Settings › Terms of use. */
export default function TermsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title={t("settings.terms")} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <AppText variant="caption" muted>
          {t("terms.updated", { version: APP_VERSION })}
        </AppText>
        <AppText style={styles.intro}>{t("terms.intro")}</AppText>
        {SECTIONS.map(([title, body], i) => (
          <View
            key={title}
            style={[styles.section, { borderTopColor: colors.border }]}
          >
            <AppText weight="semibold">
              {i + 1}. {t(title)}
            </AppText>
            <AppText muted style={styles.body}>
              {t(body, { developer: DEVELOPER })}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  intro: {
    marginTop: 10,
    marginBottom: 6,
  },
  section: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  body: {
    marginTop: 4,
  },
});
