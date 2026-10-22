// Screen 1 of onboarding: hello, text size picker (the whole screen re-renders
// live as each option is selected) and language. One primary action: Continue.
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Body, Card, Title } from "../src/components/ui";
import { BigButton } from "../src/components/BigButton";
import { RadioRow } from "../src/components/fields";
import { useT } from "../src/i18n";
import { useStore } from "../src/store";
import { useTheme } from "../src/theme";
import type { TextSize } from "@parea/shared";

const SIZES: Array<{ value: TextSize; label: "sizeNormal" | "sizeLarge" | "sizeXLarge" }> = [
  { value: "normal", label: "sizeNormal" },
  { value: "large", label: "sizeLarge" },
  { value: "xlarge", label: "sizeXLarge" },
];

export default function Welcome() {
  const t = useT();
  const { c, space, themeName } = useTheme();
  const router = useRouter();
  const textSize = useStore((s) => s.textSize);
  const language = useStore((s) => s.language);
  const setPrefs = useStore((s) => s.setPrefs);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingTop: 48, paddingBottom: space.xxxl }}
    >
      <View style={{ alignItems: "center", gap: space.m }}>
        {/* The emoji sits in a soft tinted circle — a hero mark, not a
            floating glyph. High contrast keeps the 3 px outline (§4.3). */}
        <View
          style={{
            width: 112,
            height: 112,
            borderRadius: 56,
            backgroundColor: c.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            ...(themeName === "contrast" ? { borderWidth: 3, borderColor: c.border } : {}),
          }}
        >
          <Text style={{ fontSize: 56 }}>🤝</Text>
        </View>
        <Title>{t("welcomeTitle")}</Title>
        <Body muted>{t("welcomeBody")}</Body>
      </View>

      <Card>
        <Body>{t("chooseTextSize")}</Body>
        <View style={{ gap: space.m }}>
          {SIZES.map((size) => (
            <RadioRow
              key={size.value}
              selected={textSize === size.value}
              label={`${t(size.label)}  (Aa)`}
              onSelect={() => void setPrefs({ textSize: size.value })}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Body>{t("languageSetting")}</Body>
        <View style={{ gap: space.m }}>
          <RadioRow
            selected={language === "el"}
            label="Ελληνικά"
            onSelect={() => void setPrefs({ language: "el" })}
          />
          <RadioRow
            selected={language === "en"}
            label="English"
            onSelect={() => void setPrefs({ language: "en" })}
          />
        </View>
      </Card>

      <BigButton label={t("continue_")} size="big" onPress={() => router.push("/onboarding/phone")} />
    </ScrollView>
  );
}
