// Screen 1 of onboarding: a hero band with the tagline (read-aloudable),
// the three things Parea is for, the text size picker (the whole screen
// re-renders live as each option is selected), language, a trust quote and
// one primary action: Continue. "I already have an account" takes the same
// route — the phone step signs existing members in.
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Card, Title } from "../src/components/ui";
import { BigButton, IconAction } from "../src/components/BigButton";
import { IconTile } from "../src/components/IconTile";
import { QuoteWell } from "../src/components/bits";
import { RadioRow } from "../src/components/fields";
import { useT } from "../src/i18n";
import { useStore } from "../src/store";
import { useTheme } from "../src/theme";
import { speak, stopSpeaking } from "../src/lib/speech";
import type { TextSize } from "@parea/shared";

const SIZES: Array<{ value: TextSize; label: "sizeNormal" | "sizeLarge" | "sizeXLarge" }> = [
  { value: "normal", label: "sizeNormal" },
  { value: "large", label: "sizeLarge" },
  { value: "xlarge", label: "sizeXLarge" },
];

export default function Welcome() {
  const t = useT();
  const { c, f, space, themeName } = useTheme();
  const router = useRouter();
  const textSize = useStore((s) => s.textSize);
  const language = useStore((s) => s.language);
  const setPrefs = useStore((s) => s.setPrefs);
  const insets = useSafeAreaInsets();
  const [reading, setReading] = useState(false);

  const pitch = () => {
    if (reading) {
      stopSpeaking();
      setReading(false);
    } else {
      speak(`${t("welcomeTitle")}. ${t("welcomeTagline")}. ${t("trustQuote")}`, language);
      setReading(true);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        padding: space.xl,
        gap: space.xl,
        paddingTop: insets.top + space.xl,
        paddingBottom: space.xxxl,
      }}
    >
      {/* Hero band — mark, title, tagline, read-aloud. */}
      <View style={{ alignItems: "center", gap: space.m }}>
        <View
          style={{
            width: 112,
            height: 112,
            borderRadius: 56,
            backgroundColor: c.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            ...(themeName === "contrast" ? { borderWidth: 3, borderColor: c.outline } : {}),
          }}
        >
          <Text style={{ fontSize: 56 }}>🤝</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.s, width: "100%" }}>
          <View style={{ flex: 1, alignItems: "center", gap: space.s }}>
            <Title>{t("welcomeTitle")}</Title>
            <Text
              style={{
                color: c.primary,
                fontSize: f.body,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              {t("welcomeTagline")}
            </Text>
          </View>
          <IconAction icon={reading ? "⏹" : "🔊"} label={reading ? t("stop") : t("listen")} onPress={pitch} />
        </View>
        <Text
          style={{
            color: c.onSurfaceVariant,
            fontSize: f.body,
            lineHeight: f.body * 1.4,
            textAlign: "center",
          }}
        >
          {t("welcomeBody")}
        </Text>
      </View>

      {/* The trio — what Parea is for (mockup's feature cards). */}
      <View style={{ gap: space.m }}>
        {[
          {
            emoji: "☕",
            hue: "ember" as const,
            title: t("featureCompanionship"),
            body: t("featureCompanionshipBody"),
          },
          {
            emoji: "🚶",
            hue: "cyan" as const,
            title: t("featureActivities"),
            body: t("featureActivitiesBody"),
          },
          {
            emoji: "💜",
            hue: "amber" as const,
            title: t("featureVolunteering"),
            body: t("featureVolunteeringBody"),
          },
        ].map((feature) => (
          <Card key={feature.title}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
              <IconTile emoji={feature.emoji} size={48} hue={feature.hue} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "700" }}>
                  {feature.title}
                </Text>
                <Text style={{ color: c.onSurfaceVariant, fontSize: f.label, lineHeight: f.label * 1.4 }}>
                  {feature.body}
                </Text>
              </View>
            </View>
          </Card>
        ))}
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
            hue="cyan"
            onSelect={() => void setPrefs({ language: "el" })}
          />
          <RadioRow
            selected={language === "en"}
            label="English"
            hue="cyan"
            onSelect={() => void setPrefs({ language: "en" })}
          />
        </View>
      </Card>

      <QuoteWell>{t("trustQuote")}</QuoteWell>

      <BigButton label={t("continue_")} size="big" gradient onPress={() => router.push("/onboarding/phone")} />
      <BigButton label={t("haveAccount")} variant="quiet" onPress={() => router.push("/onboarding/phone")} />
    </ScrollView>
  );
}
