// Screen shell: Back + Home always visible in pushed screens, big title,
// optional read-aloud for the whole screen, scrollable body and an optional
// fixed footer (where the single primary action lives).
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTheme } from "../theme";
import { useT, tr } from "../i18n";
import { useStore } from "../store";
import { speak, stopSpeaking } from "../lib/speech";
import { IconAction } from "./BigButton";

export function Screen({
  title,
  children,
  footer,
  back = true,
  showHome = false,
  speakText,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  back?: boolean;
  showHome?: boolean;
  speakText?: string;
}) {
  const { c, f, space, touch, themeName } = useTheme();
  const t = useT();
  const router = useRouter();
  const lang = useStore((s) => s.language);
  const [reading, setReading] = useState(false);
  // High contrast keeps the strong white separator; other themes use the
  // subtle hairline so the header reads as a surface, not a boxed layout.
  const separator = themeName === "contrast" ? c.border : c.hairline;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingHorizontal: space.xl,
          paddingTop: space.xl,
          paddingBottom: space.m,
          gap: space.m,
          borderBottomWidth: 1,
          borderBottomColor: separator,
        }}
      >
        {back || showHome ? (
          <View style={{ flexDirection: "row", gap: space.xl }}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("back")}
                onPress={() => router.canGoBack() && router.back()}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: touch.min, paddingHorizontal: 8, marginHorizontal: -8 })}
              >
                <Text style={{ color: c.primary, fontSize: f.button }}>←</Text>
                <Text style={{ color: c.primary, fontSize: f.button, fontWeight: "600" }}>
                  {t("back")}
                </Text>
              </Pressable>
            ) : null}
            {showHome ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home")}
                onPress={() => router.replace("/home")}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: touch.min, paddingHorizontal: 8, marginHorizontal: -8 })}
              >
                <Text style={{ color: c.primary, fontSize: f.button }}>🏠</Text>
                <Text style={{ color: c.primary, fontSize: f.button, fontWeight: "600" }}>
                  {t("home")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
          <Text
            accessible
            accessibilityRole="header"
            style={{ color: c.text, fontSize: f.title, fontWeight: "700", flex: 1, lineHeight: f.title * 1.25 }}
          >
            {title}
          </Text>
          {speakText ? (
            <IconAction
              icon={reading ? "⏹" : "🔊"}
              label={reading ? t("stop") : t("listen")}
              onPress={() => {
                if (reading) {
                  stopSpeaking();
                  setReading(false);
                } else {
                  speak(speakText, lang);
                  setReading(true);
                }
              }}
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: space.xxxl }}
      >
        {children}
      </ScrollView>

      {footer ? (
        <View
          style={{
            padding: space.xl,
            paddingTop: space.m,
            borderTopWidth: 1,
            borderTopColor: separator,
            backgroundColor: c.bg,
            gap: space.m,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
