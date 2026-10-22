// Appearance — light / dark / high contrast, or follow the phone's setting
// (the default). The screen itself re-renders in the chosen theme, which IS
// the preview.
import { View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Body } from "../../src/components/ui";
import { RadioRow } from "../../src/components/fields";
import { useT } from "../../src/i18n";
import { useStore, type ThemePref } from "../../src/store";

const THEMES: Array<{ value: ThemePref; key: "themeSystem" | "themeLight" | "themeDark" | "themeContrast" }> = [
  { value: "system", key: "themeSystem" },
  { value: "light", key: "themeLight" },
  { value: "dark", key: "themeDark" },
  { value: "contrast", key: "themeContrast" },
];

export default function AppearanceSetting() {
  const t = useT();
  const theme = useStore((s) => s.theme);
  const setPrefs = useStore((s) => s.setPrefs);

  return (
    <Screen title={t("appearanceSetting")} speakText={t("chooseTheme")}>
      <Body>{t("chooseTheme")}</Body>
      <View style={{ gap: 16 }}>
        {THEMES.map((item) => (
          <RadioRow
            key={item.value}
            selected={theme === item.value}
            label={t(item.key)}
            onSelect={() => void setPrefs({ theme: item.value })}
          />
        ))}
      </View>
    </Screen>
  );
}
