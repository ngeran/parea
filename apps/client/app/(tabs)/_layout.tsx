// Bottom tab bar: 4 labeled tabs, always visible, icon over text (never
// icons alone), big labels. The bar floats — a fully-rounded pill inset
// from the screen edges on a soft shadow — so it reads as part of the app,
// not a system chrome bar. Fade-free instant switching. The focused tab
// sits in a primarySoft pill (the fill carries selection; in the contrast
// theme that's a white pill with a black label). Cells stack emoji over
// label so long localized words never truncate the way a side-by-side row
// does in a quarter of a narrow phone, and the bar has no fixed height —
// it grows with the user's text size instead of clipping it.
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../src/i18n";
import { ELEVATION, useTheme } from "../../src/theme";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  const { c, f, themeName } = useTheme();
  const contrast = themeName === "contrast";
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        // Capped so the selected pill stays a pill on wide screens (the bar
        // centers over the reading column on tablets).
        width: "100%",
        maxWidth: 120,
        alignSelf: "center",
        minHeight: 56,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: focused ? c.primarySoft : "transparent",
        // Contrast: the white pill needs its own 3 px edge on the black bar.
        // The border is always reserved (transparent when unfocused) so the
        // cell doesn't jump 3 px when selection moves.
        borderWidth: contrast ? 3 : 0,
        borderColor: focused ? c.outline : "transparent",
      }}
    >
      <Text accessible={false} style={{ fontSize: 22, lineHeight: 26 }}>{emoji}</Text>
      <Text
        accessible={false}
        numberOfLines={1}
        // Long localized words shrink instead of ellipsizing ("Ρυθμίσεις" at
        // xlarge text in a 360 px phone).
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{
          color: focused ? (contrast ? c.onPrimary : c.onSoft) : c.onSurfaceVariant,
          fontSize: f.label,
          lineHeight: f.label * 1.3,
          fontWeight: focused ? "800" : "600",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const t = useT();
  const { c, themeName } = useTheme();
  // The bar floats above the home-indicator/home-bar — lift it by the real
  // inset (zeros on web) instead of a guessed constant.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.onSurfaceVariant,
        tabBarStyle: {
          position: "absolute",
          // White card surface in light (the old container grey sat almost
          // on top of the cool-white page); a lifted container in dark;
          // black in contrast (both resolve through the tokens).
          backgroundColor: themeName === "dark" ? c.surfaceContainerHigh : c.surfaceContainerLowest,
          marginHorizontal: 16,
          marginBottom: 12 + insets.bottom,
          // Wide screens: the pill bar centers over the reading column instead
          // of stretching across a tablet (self-sizing keeps phones as-is).
          alignSelf: "center",
          maxWidth: 720,
          borderRadius: 999,
          borderTopWidth: 0,
          // High contrast: the white bar on black bg is its own outline;
          // no shadow decoration there (plan §4.3 keeps shadows out).
          ...(themeName === "contrast"
            ? { borderWidth: 3, borderColor: c.outline }
            : { borderWidth: 1, borderColor: c.outlineVariant, ...ELEVATION.md }),
          // No fixed height: the 56 px cells (emoji over label, built-in
          // label off) size the bar, so it grows with the user's text size
          // instead of clipping it.
          minHeight: 72,
          paddingVertical: 8,
          overflow: "hidden",
        },
        tabBarShowLabel: false,
        // The floating bar overlays the screen, so every tab's content gets
        // bottom room to stay clear of it (bar 72 + margin 12 + gap) plus the
        // real home-bar inset.
        sceneStyle: { backgroundColor: c.background, marginBottom: 90 + insets.bottom },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t("home"), tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label={t("home")} focused={focused} /> }}
      />
      {/* No unread dot on chats: the API has no read-state, so any dot would
          be a fake signal — honest data only. */}
      <Tabs.Screen
        name="chats"
        options={{ title: t("chatsTab"), tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label={t("chatsTab")} focused={focused} /> }}
      />
      <Tabs.Screen
        name="plans"
        options={{ title: t("plansTab"), tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label={t("plansTab")} focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("settingsTitle"), tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label={t("settingsTitle")} focused={focused} /> }}
      />
    </Tabs>
  );
}
