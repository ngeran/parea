// Bottom tab bar: 4 labeled tabs, always visible, icons with text (never
// icons alone), big labels. The bar floats — inset from the screen edges on
// a soft shadow — so it reads as part of the app, not a system chrome bar.
// Fade-free instant switching.
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useT } from "../../src/i18n";
import { ELEVATION, useTheme } from "../../src/theme";

function TabIcon({ emoji, label }: { emoji: string; label: string }) {
  return <Text accessible accessibilityLabel={label} style={{ fontSize: 30 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const t = useT();
  const { c, f, themeName } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: c.surface,
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 28,
          borderTopWidth: 0,
          // High contrast: the white bar on black bg is its own outline;
          // no shadow decoration there (plan §4.3 keeps shadows out).
          ...(themeName === "contrast"
            ? { borderWidth: 3, borderColor: c.border }
            : { borderWidth: 1, borderColor: c.hairline, ...ELEVATION.md }),
          // Tall enough for the 30 px emoji plus an 18 px+ label (the label
          // follows the user's text size, so the bar grows with it).
          height: 92,
          paddingBottom: 10,
          paddingTop: 8,
          overflow: "hidden",
        },
        tabBarLabelStyle: {
          fontSize: f.label,
          fontWeight: "600",
        },
        // The floating bar overlays the screen, so every tab's content gets
        // bottom padding to stay clear of it (bar 92 + margins 12+16).
        sceneStyle: { backgroundColor: c.bg, marginBottom: 108 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t("home"), tabBarIcon: () => <TabIcon emoji="🏠" label={t("home")} /> }}
      />
      <Tabs.Screen
        name="chats"
        options={{ title: t("chatsTab"), tabBarIcon: () => <TabIcon emoji="💬" label={t("chatsTab")} /> }}
      />
      <Tabs.Screen
        name="plans"
        options={{ title: t("plansTab"), tabBarIcon: () => <TabIcon emoji="📅" label={t("plansTab")} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("settingsTitle"), tabBarIcon: () => <TabIcon emoji="⚙️" label={t("settingsTitle")} /> }}
      />
    </Tabs>
  );
}
