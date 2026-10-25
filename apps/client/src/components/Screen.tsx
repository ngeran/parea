// Screen shell: Back + Home always visible in pushed screens, big title,
// optional read-aloud for the whole screen, scrollable body and an optional
// fixed footer (where the single primary action lives).
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLUMN, useTheme } from "../theme";
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
  avoidKeyboard = false,
  scroll = true,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  back?: boolean;
  showHome?: boolean;
  speakText?: string;
  /** Wrap the body+footer so the keyboard never covers the focused input
   *  (iOS padding; Android's window resize already handles it). */
  avoidKeyboard?: boolean;
  /** false = the body hosts its own scrollable/FlatList (e.g. nearby) and
   *  this shell renders a plain flex container instead. */
  scroll?: boolean;
}) {
  const { c, f, space, touch, themeName } = useTheme();
  const t = useT();
  const router = useRouter();
  const lang = useStore((s) => s.language);
  const [reading, setReading] = useState(false);
  // Real notch/status-bar/home-bar insets (zeros on web) instead of guessed
  // constants — the header clears the notch, the footer clears the home bar,
  // and landscape phones get side insets so content never hides under the
  // sensor housing.
  const insets = useSafeAreaInsets();
  // High contrast keeps the strong white separator; other themes use the
  // subtle hairline so the header reads as a surface, not a boxed layout.
  const separator = themeName === "contrast" ? c.outline : c.outlineVariant;

  // Body + footer together, so KeyboardAvoidingView (when requested) lifts
  // the fixed footer above the keyboard too — the primary action must stay
  // reachable while typing.
  const bodyAndFooter = (
    <>
      {/* keyboardShouldPersistTaps="handled": one tap dismisses nothing and
          still presses the button — the tap-twice dance is hostile to
          everyone, worse with motor difficulties. */}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            ...COLUMN,
            padding: space.xl,
            paddingLeft: space.xl + insets.left,
            paddingRight: space.xl + insets.right,
            gap: space.xl,
            paddingBottom: space.xxxl,
          }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}

      {footer ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: separator,
            backgroundColor: c.surfaceContainerLowest,
          }}
        >
          <View
            style={{
              ...COLUMN,
              padding: space.xl,
              paddingLeft: space.xl + insets.left,
              paddingRight: space.xl + insets.right,
              paddingTop: space.m,
              paddingBottom: space.xl + insets.bottom,
              gap: space.m,
            }}
          >
            {footer}
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header/footer paint full-width (border + surface), while their
          content stays inside the reading column on wide screens. */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: separator }}>
        <View
          style={{
            ...COLUMN,
            paddingHorizontal: space.xl + insets.left + insets.right,
            paddingTop: Math.max(space.xl, insets.top + space.m),
            paddingBottom: space.m,
            gap: space.m,
          }}
        >
        {/* Header = circular nav buttons + title on one line (the read-aloud
            action joins at the end). Buttons are tappable circles ≥ 48 px. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
          {back || showHome ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={back ? t("back") : t("home")}
              onPress={() =>
                back ? router.canGoBack() && router.back() : router.replace("/home")
              }
              style={({ pressed }) => ({
                width: touch.min,
                height: touch.min,
                borderRadius: touch.min / 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? c.surfaceContainerHighest : c.surfaceContainerHigh,
                borderWidth: themeName === "contrast" ? 3 : 0,
                borderColor: c.outline,
              })}
            >
              <Text style={{ color: c.onSurface, fontSize: f.button }}>
                {back ? "←" : "🏠"}
              </Text>
            </Pressable>
          ) : null}
          <Text
            accessible
            accessibilityRole="header"
            style={{ color: c.onSurface, fontSize: f.title, fontWeight: "800", flex: 1, lineHeight: f.title * 1.25 }}
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
      </View>

      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {bodyAndFooter}
        </KeyboardAvoidingView>
      ) : (
        bodyAndFooter
      )}
    </View>
  );
}
