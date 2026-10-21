// Language — Ελληνικά / English, applied instantly across the whole app.
import { View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { RadioRow } from "../../src/components/fields";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";
import type { Lang } from "@parea/shared";

export default function LanguageSetting() {
  const t = useT();
  const language = useStore((s) => s.language);
  const setPrefs = useStore((s) => s.setPrefs);

  return (
    <Screen title={t("languageSetting")}>
      <View style={{ gap: 16 }}>
        {(["el", "en"] as Lang[]).map((code) => (
          <RadioRow
            key={code}
            selected={language === code}
            label={code === "el" ? t("el") : t("en")}
            emoji={code === "el" ? "🇬🇷" : "🇬🇧"}
            onSelect={() => void setPrefs({ language: code })}
          />
        ))}
      </View>
    </Screen>
  );
}
