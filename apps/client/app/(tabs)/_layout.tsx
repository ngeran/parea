// Bottom tab bar: 4 labeled tabs, always visible, icons with text (never
// icons alone), big labels. The bar floats — inset from the screen edges on
// a soft shadow — so it reads as part of the app, not a system chrome bar.
// Fade-free instant switching. The focused tab's emoji sits in a soft pill
// tile; selection is carried by the tile + tint (never color alone).
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../src/i18n";
import { ELEVATION, useTheme } from "../../src/theme";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  const { c, themeName } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        minWidth: 52,
        minHeight: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        paddingHorizontal: 10,
        backgroundColor: focused ? c.primarySoft : "transparent",
        borderWidth: focused && themeName === "contrast" ? 3 : 0,
        borderColor: c.outline,
      }}
    >
      <Text accessible={false} style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const t = useT();
  const { c, f, themeName } = useTheme();
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
          backgroundColor: c.surfaceContainer,
          marginHorizontal: 16,
          marginBottom: 10 + insets.bottom,
          // Wide screens: the pill bar centers over the reading column instead
          // of stretching across a tablet (self-sizing keeps phones as-is).
          alignSelf: "center",
          maxWidth: 720,
          borderRadius: 24,
          borderTopWidth: 0,
          // High contrast: the white bar on black bg is its own outline;
          // no shadow decoration there (plan §4.3 keeps shadows out).
          ...(themeName === "contrast"
            ? { borderWidth: 3, borderColor: c.outline }
            : { borderWidth: 1, borderColor: c.outlineVariant, ...ELEVATION.md }),
          // Room for the 22 px emoji plus a 15 px+ label (the label follows
          // the user's text size, so the bar grows with it).
          height: 72,
          paddingBottom: 8,
          paddingTop: 6,
          overflow: "hidden",
        },
        tabBarLabelStyle: {
          fontSize: f.label,
          fontWeight: "600",
        },
        // The floating bar overlays the screen, so every tab's content gets
        // bottom room to stay clear of it (bar 72 + margin 10 + gap) plus the
        // real home-bar inset.
        sceneStyle: { backgroundColor: c.background, marginBottom: 86 + insets.bottom },
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
